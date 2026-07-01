/**
 * Telegram channel — long-poll Telegram Bot API, push messages onto
 * the queue, run pipeline, send reply back.
 *
 * File handling:
 *  - Document (PDF/DOCX/...) → upload Payload media (S3/disk) +
 *    chuyển sang text qua MarkItDown service → đính text vào message AI.
 *  - Photo (image) → upload Payload media + gửi thẳng buffer cho Claude
 *    vision.
 *  - Text-only → bỏ qua bước tải file.
 */
import type { Config } from "../config.js";
import { logger } from "../utils/logger.js";
import { newId } from "../utils/id.js";
import { MessageQueue, type QueueJob } from "../queue/message-queue.js";
import { runPipeline, type PipelineAttachment } from "../pipeline/pipeline.js";
import { mdToTelegramHtml, splitMessage } from "./format.js";
import { describeToolCall } from "./tool-labels.js";
import { convertToMarkdown, MarkItDownError } from "../extraction/markitdown.js";
import {
  needsLegacyConvert,
  convertLegacyOffice,
  LegacyOfficeError,
} from "../extraction/legacy-office.js";
import { describeDocument, describeImage, describeScannedPdf } from "../extraction/describe.js";
import { pdfToImages, PdfToImagesError, type PdfPageImage } from "../extraction/pdf-to-images.js";
import { payload, PayloadError } from "../payload/client.js";
import { syncOnIncomingMessage, lookupAgentForMessage } from "../payload/telegram-sync.js";
import { validateFile } from "../extraction/file-validator.js";

interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}
interface TgDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}
interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width: number;
  height: number;
}
interface TgMessageEntity {
  type: string;
  offset: number;
  length: number;
  user?: TgUser;
}
interface TgForumTopicCreated {
  name: string;
  icon_color?: number;
  icon_custom_emoji_id?: string;
}
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string; title?: string; is_forum?: boolean };
  text?: string;
  caption?: string;
  entities?: TgMessageEntity[];
  caption_entities?: TgMessageEntity[];
  document?: TgDocument;
  photo?: TgPhotoSize[];
  reply_to_message?: TgMessage;
  /** Forum topic — message_thread_id chỉ có khi group là supergroup + Forum bật.
   *  Tin trong topic mặc định (General) có thread_id = 1. */
  message_thread_id?: number;
  is_topic_message?: boolean;
  /** Khi event "topic được tạo" — bot có thể lấy tên topic từ đây. */
  forum_topic_created?: TgForumTopicCreated;
  /** Telegram media album: khi user gửi 2-10 file cùng lúc, các message
   *  chia sẻ chung media_group_id. Chỉ caption của message đầu có thật,
   *  các message sau caption rỗng. */
  media_group_id?: string;
  date: number;
}
interface TgUpdate { update_id: number; message?: TgMessage }
interface TgUpdatesResponse { ok: boolean; result: TgUpdate[] }

const SUPPORTED_IMAGE_MIME: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

function inferMimeFromName(name: string): string | undefined {
  const ext = name.toLowerCase().split(".").pop();
  if (!ext) return undefined;
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext];
}

export class TelegramChannel {
  private offset = 0;
  private polling = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollDelay = 1000;
  private readonly queue: MessageQueue;

  /** Bot identity từ getMe() — dùng để detect mention / reply / command suffix
   *  trong group. Lazy-load lần đầu cần đến nếu chưa có. */
  private botId: number | null = null;
  private botUsername: string | null = null;

  /** Per-(chatId + threadId) conversation history. KEY = `chatId:threadId`.
   *  Mỗi topic forum giữ history riêng — tránh lẫn context giữa các topic
   *  cùng group (vd topic Nhân sự, topic HĐCU cùng supergroup).
   *  In-memory; mất khi bot restart. */
  private readonly chatHistory = new Map<
    string,
    Array<{ role: "user" | "assistant"; text: string; attachmentNote?: string }>
  >();
  private readonly MAX_HISTORY = 12;

  private historyKey(chatId: number, threadId?: number): string {
    return `${chatId}:${threadId ?? 0}`;
  }

  /** Per-chatId serial chain — đảm bảo trong cùng 1 chat (đặc biệt group),
   *  các message được xử lý tuần tự để không có race khi đọc/ghi chatHistory.
   *  Chat khác nhau vẫn parallel theo QUEUE_CONCURRENCY. */
  /** Per-(chatId+threadId) serial chain — 2 topic cùng group được xử lý
   *  song song. Key string "chatId:threadId". */
  private readonly chatChains = new Map<string, Promise<void>>();

  constructor(
    private readonly botToken: string,
    private readonly config: Config,
  ) {
    this.queue = new MessageQueue(config);
  }

  private get apiBase(): string {
    const base = (this.config.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");
    return `${base}/bot${this.botToken}`;
  }

  private get fileApiBase(): string {
    const base = (this.config.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");
    return `${base}/file/bot${this.botToken}`;
  }

  start(): void {
    if (this.polling) return;
    this.polling = true;
    void this.fetchBotIdentity();
    this.poll();
    logger.info("Telegram", "Polling started");
  }

  /** Lấy bot id + username từ getMe(). Gọi 1 lần lúc start; nếu fail
   *  thì lazy-retry ở fetchUpdates (group filter cần thông tin này). */
  private async fetchBotIdentity(): Promise<void> {
    if (this.botId !== null) return;
    try {
      const res = await fetch(`${this.apiBase}/getMe`, {
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json()) as {
        ok: boolean;
        result?: { id: number; username?: string };
      };
      if (data.ok && data.result) {
        this.botId = data.result.id;
        this.botUsername = data.result.username ?? null;
        logger.info(
          "Telegram",
          `Identity: @${this.botUsername ?? "?"} (id=${this.botId})`,
        );
      }
    } catch (e) {
      logger.warn("Telegram", `getMe failed: ${e}`);
    }
  }

  stop(): void {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.queue.stop();
  }

  /** Send a message to a chat — also exposed for cron worker notifications.
   *  Hỗ trợ `messageThreadId` để bot reply trong đúng topic của Forum group. */
  async sendMessage(
    chatId: number,
    text: string,
    messageThreadId?: number,
  ): Promise<void> {
    const html = mdToTelegramHtml(text);
    for (const chunk of splitMessage(html)) {
      try {
        const body: Record<string, unknown> = {
          chat_id: chatId,
          text: chunk,
          parse_mode: "HTML",
        };
        if (messageThreadId !== undefined) {
          body.message_thread_id = messageThreadId;
        }
        await fetch(`${this.apiBase}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (e) {
        logger.warn("Telegram", `sendMessage failed: ${e}`);
      }
    }
  }

  // ── Polling loop ──────────────────────────────────────────────

  private poll(): void {
    if (!this.polling) return;
    this.fetchUpdates()
      .catch((err) => logger.warn("Telegram", `poll error: ${err}`))
      .finally(() => {
        if (this.polling) {
          this.pollTimer = setTimeout(() => this.poll(), this.pollDelay);
        }
      });
  }

  private async fetchUpdates(): Promise<void> {
    const url = `${this.apiBase}/getUpdates?timeout=25&offset=${this.offset}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

    if (!res.ok) {
      if (res.status === 409) {
        // Another instance is polling; back off.
        this.pollDelay = Math.min(this.pollDelay * 2, 30_000);
        logger.warn("Telegram", `409 conflict, backing off ${this.pollDelay}ms`);
      } else {
        logger.warn("Telegram", `getUpdates HTTP ${res.status}`);
      }
      return;
    }
    this.pollDelay = 1000;

    const data = (await res.json()) as TgUpdatesResponse;
    if (!data.ok || data.result.length === 0) return;

    for (const update of data.result) {
      this.offset = update.update_id + 1;
      const msg = update.message;
      if (!msg) continue;

      const chatType = msg.chat.type;
      if (chatType !== "private" && chatType !== "group" && chatType !== "supergroup") {
        continue; // channel posts, etc — bỏ qua
      }

      const hasContent = !!(msg.text || msg.caption || msg.document || msg.photo);
      if (!hasContent) continue;

      if (chatType === "private") {
        this.handleMessage(msg, /*strippedText*/ undefined);
        continue;
      }

      // Group / supergroup: chỉ trả lời khi được gọi tên.
      // Nếu chưa biết bot identity thì retry getMe() đồng bộ — Privacy Mode
      // bật nên updates đã được Telegram lọc, nhưng vẫn cần username để strip.
      if (this.botId === null) await this.fetchBotIdentity();

      const addressed = this.parseGroupAddress(msg);

      // Media album: nếu message thuộc media_group_id đã match → cũng match.
      const mgid = msg.media_group_id;
      let mediaGroupMatched = false;
      if (mgid && !addressed.match) {
        if (this.matchedMediaGroups.has(mgid)) mediaGroupMatched = true;
      }

      // Burst buffer: khi user gửi 11-20 ảnh, Telegram chia 2 album, caption
      // chỉ ở album cuối. Album đầu không có @mention → sẽ bị reject.
      // Buffer 8s: nếu trong window có message addressed từ cùng user
      // → flush buffer cũng coi là match.
      const burstKey = msg.from
        ? `${msg.chat.id}:${msg.message_thread_id ?? 0}:${msg.from.id}`
        : null;
      const hasAtt = !!(msg.photo?.length || msg.document);

      if (!addressed.match && !mediaGroupMatched) {
        if (burstKey && hasAtt) {
          const existing = this.pendingRejectBuf.get(burstKey);
          if (existing) clearTimeout(existing.timer);
          const msgs = existing ? [...existing.msgs, msg] : [msg];
          const timer = setTimeout(() => {
            this.pendingRejectBuf.delete(burstKey);
          }, 8_000);
          this.pendingRejectBuf.set(burstKey, { msgs, timer });
        }
        continue;
      }

      // Matched: kiểm pendingRejectBuf để rescue album đầu (đã reject trước
      // khi caption đến).
      if (burstKey) {
        const buf = this.pendingRejectBuf.get(burstKey);
        if (buf) {
          clearTimeout(buf.timer);
          this.pendingRejectBuf.delete(burstKey);
          logger.info(
            "Telegram",
            `[${msg.chat.id}] rescue ${buf.msgs.length} message bị reject trước (burst window)`,
          );
          for (const rescued of buf.msgs) {
            this.handleMessage(rescued, undefined);
          }
        }
      }
      if (mgid && addressed.match) {
        this.matchedMediaGroups.add(mgid);
        // GC: giới hạn 200 entries để tránh leak (1 album thường <30s)
        if (this.matchedMediaGroups.size > 200) {
          const first = this.matchedMediaGroups.values().next().value;
          if (first) this.matchedMediaGroups.delete(first);
        }
      }

      this.handleMessage(msg, addressed.cleanedText);
    }
  }

  /** Cache media_group_id đã match ở message đầu album — các message sau
   *  cùng group không có @mention nhưng vẫn cần handle. */
  private readonly matchedMediaGroups = new Set<string>();

  /** Buffer message attachment bị reject (không @mention), giữ 8s. Nếu
   *  trong window có message addressed từ cùng user → rescue tất cả vào
   *  handleMessage. Cover case: 20 ảnh = 2 album, caption chỉ ở album cuối. */
  private readonly pendingRejectBuf = new Map<
    string,
    { msgs: TgMessage[]; timer: NodeJS.Timeout }
  >();

  /**
   * Trong group, bot CHỈ trả lời khi:
   *  - là /command (có hoặc không kèm @username)
   *  - text/caption có @mention bot (entity type "mention" hoặc "text_mention")
   *  - reply trực tiếp vào message của bot
   * Trả về text đã strip @YourBot / @YourBot trong /cmd@YourBot để pipeline
   * không thấy nhiễu.
   */
  private parseGroupAddress(msg: TgMessage): { match: boolean; cleanedText: string } {
    const raw = msg.text ?? msg.caption ?? "";
    const entities = msg.entities ?? msg.caption_entities ?? [];
    const username = this.botUsername;
    const botId = this.botId;

    let match = false;

    // Reply tới message của bot
    if (msg.reply_to_message?.from?.id && botId && msg.reply_to_message.from.id === botId) {
      match = true;
    }

    // Mention qua entities (chính xác hơn substring matching)
    if (!match && username) {
      const usernameLower = username.toLowerCase();
      for (const ent of entities) {
        if (ent.type === "mention") {
          const mention = raw.slice(ent.offset, ent.offset + ent.length); // "@username"
          if (mention.slice(1).toLowerCase() === usernameLower) {
            match = true;
            break;
          }
        } else if (ent.type === "text_mention" && ent.user?.id === botId) {
          match = true;
          break;
        }
      }
    }

    // Command: "/cmd" hoặc "/cmd@YourBot"
    let isCommand = false;
    if (entities.length > 0 && entities[0].type === "bot_command" && entities[0].offset === 0) {
      const cmd = raw.slice(0, entities[0].length); // "/cmd" hoặc "/cmd@YourBot"
      const at = cmd.indexOf("@");
      if (at === -1) {
        // /cmd không kèm username: hợp lệ trong private, group thì chấp nhận
        // (Privacy Mode bật vẫn cho qua command). Coi như addressed.
        isCommand = true;
      } else if (username && cmd.slice(at + 1).toLowerCase() === username.toLowerCase()) {
        isCommand = true;
      }
    }
    if (isCommand) match = true;

    if (!match) return { match: false, cleanedText: raw };

    // Strip @username khỏi text để pipeline không thấy "@YourBot"
    let cleaned = raw;
    if (username) {
      const re = new RegExp(`@${username}\\b`, "gi");
      cleaned = cleaned.replace(re, "").replace(/\s{2,}/g, " ").trim();
    } else {
      cleaned = cleaned.trim();
    }
    return { match: true, cleanedText: cleaned };
  }

  // Batch multi-file upload: khi user gửi nhiều file liên tiếp (Telegram
  // gửi từng file thành 1 message), gom thành 1 batch để bot xử lý chung
  // → AI thấy tất cả file cùng lúc thay vì gọi pipeline N lần.
  //
  // Key = `${chatId}:${threadId}` (mỗi topic forum batch riêng).
  // Timer reset mỗi lần có message mới → đợi 5s yên lặng → flush.
  private readonly BATCH_WINDOW_MS = 5_000;
  private readonly pendingBatches = new Map<
    string,
    { msgs: TgMessage[]; timer: NodeJS.Timeout }
  >();

  private hasAttachment(msg: TgMessage): boolean {
    return !!(msg.photo?.length || msg.document);
  }

  private handleMessage(msg: TgMessage, overrideText?: string): void {
    if (!msg.from) return;
    const chatId = msg.chat.id;
    const text = (overrideText ?? msg.text ?? msg.caption ?? "").trim();

    // Auto-track Telegram identity (user + group + membership + topic).
    void syncOnIncomingMessage(msg.from, msg.chat, {
      message_thread_id: msg.message_thread_id,
      forum_topic_created: msg.forum_topic_created,
    }).then((res) => {
      if (res.blocked) {
        logger.info(
          "Telegram",
          `[${chatId}] from=${msg.from?.id} blocked by admin — skipping`,
        );
      }
    });

    // Batch attachments: nếu message có file, KHÔNG enqueue ngay; gom 5s
    // rồi enqueue 1 lần cho tất cả file.
    if (this.hasAttachment(msg)) {
      const key = `${chatId}:${msg.message_thread_id ?? 0}`;
      const existing = this.pendingBatches.get(key);
      if (existing) clearTimeout(existing.timer);
      const msgs = existing ? [...existing.msgs, msg] : [msg];
      const timer = setTimeout(() => {
        this.pendingBatches.delete(key);
        this.enqueueBatchedAttachments(chatId, msgs, overrideText);
      }, this.BATCH_WINDOW_MS);
      this.pendingBatches.set(key, { msgs, timer });
      if (msgs.length > 1) {
        logger.info("Telegram", `[${chatId}] batching attachment ${msgs.length}/N (chờ thêm ${this.BATCH_WINDOW_MS}ms)`);
      }
      return;
    }

    // Message không có file → enqueue ngay
    const job: QueueJob = {
      id: newId(),
      priority: 1,
      enqueuedAt: Date.now(),
      run: () => this.runOnChat(chatId, msg.message_thread_id, () => this.processMessage(chatId, text, msg)),
    };

    if (!this.queue.enqueue(job)) {
      this.sendMessage(
        chatId,
        "Hệ thống đang bận, vui lòng thử lại sau giây lát.",
        msg.message_thread_id,
      ).catch(() => {});
    }
  }

  /** Flush batch các message có attachment: gộp caption + chuyển batch sang pipeline. */
  private enqueueBatchedAttachments(chatId: number, msgs: TgMessage[], overrideText?: string): void {
    if (msgs.length === 0) return;

    // Caption: lấy của msg cuối có caption non-empty (user thường gõ caption
    // ở file cuối khi gửi loạt).
    const captionMsg = [...msgs].reverse().find((m) => (m.caption ?? m.text)?.trim()) ?? msgs[0];
    const caption = (overrideText ?? captionMsg.caption ?? captionMsg.text ?? "").trim();
    const text =
      msgs.length > 1
        ? `${caption ? caption + "\n\n" : ""}[Đã gửi ${msgs.length} file đính kèm — phân tích từng cái hoặc tổng hợp tuỳ ngữ cảnh.]`
        : caption;

    if (msgs.length > 1) {
      logger.info("Telegram", `[${chatId}] flush batch ${msgs.length} attachments`);
    }

    const primary = msgs[0]; // dùng làm context (chatId, threadId, from)
    const job: QueueJob = {
      id: newId(),
      priority: 1,
      enqueuedAt: Date.now(),
      run: () => this.runOnChat(chatId, primary.message_thread_id, () => this.processMessage(chatId, text, primary, msgs)),
    };
    if (!this.queue.enqueue(job)) {
      this.sendMessage(
        chatId,
        "Hệ thống đang bận, vui lòng thử lại sau giây lát.",
        primary.message_thread_id,
      ).catch(() => {});
    }
  }

  /** GET file_path qua getFile + tải bytes. */
  private async downloadTelegramFile(
    fileId: string,
  ): Promise<{ buffer: Buffer; filePath: string; reason?: string } | null> {
    try {
      const r1 = await fetch(`${this.apiBase}/getFile?file_id=${encodeURIComponent(fileId)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      const j1 = (await r1.json()) as {
        ok: boolean;
        result?: { file_path: string };
        error_code?: number;
        description?: string;
      };
      if (!j1.ok || !j1.result?.file_path) {
        const desc = j1.description ?? "unknown";
        logger.warn("Telegram", `getFile failed for ${fileId}: ${desc}`);
        // Telegram Bot API cloud cap download tại 20MB hard limit
        if (/too big/i.test(desc)) {
          return { buffer: Buffer.alloc(0), filePath: "", reason: "file_too_big" };
        }
        return null;
      }
      const filePath = j1.result.file_path;
      // Local Bot API Server trả absolute path (vd /var/lib/telegram-bot-api/...)
      // Cloud trả relative path. Detect + xử lý.
      let downloadUrl: string;
      if (filePath.startsWith("/")) {
        // Local server: file đã save sẵn trên disk
        downloadUrl = `file://${filePath}`;
      } else {
        downloadUrl = `${this.fileApiBase}/${filePath}`;
      }

      let buf: Buffer;
      if (downloadUrl.startsWith("file://")) {
        // Read từ disk (local Bot API Server)
        const fs = await import("node:fs/promises");
        buf = await fs.readFile(filePath);
      } else {
        const r2 = await fetch(downloadUrl, {
          signal: AbortSignal.timeout(120_000),
        });
        if (!r2.ok) {
          logger.warn("Telegram", `download ${filePath} HTTP ${r2.status}`);
          return null;
        }
        buf = Buffer.from(await r2.arrayBuffer());
      }
      return { buffer: buf, filePath };
    } catch (err) {
      logger.warn("Telegram", `downloadTelegramFile threw: ${err}`);
      return null;
    }
  }

  /**
   * Xử lý attachment từ Telegram message:
   *  - Document: tải → upload Payload media → MarkItDown → text
   *  - Photo (chọn size lớn nhất): tải → upload Payload media → buffer cho vision
   * Mỗi bước có log rõ để debug. Trả về list attachments cho pipeline +
   * 1 mảng note để hiển thị status trên Telegram.
   */
  private async resolveAttachments(
    msg: TgMessage,
    onStatus: (note: string) => void,
  ): Promise<PipelineAttachment[]> {
    const out: PipelineAttachment[] = [];

    // Document
    if (msg.document) {
      const d = msg.document;
      const name = d.file_name ?? `${d.file_id}.bin`;
      const mime = d.mime_type ?? inferMimeFromName(name) ?? "application/octet-stream";

      // Pre-check size từ message metadata — tránh gọi getFile vô ích nếu file quá lớn.
      // Cap cứng: 100MB (tổng giới hạn của bot, dù dùng cloud hay local server).
      // Cap mềm cloud: 20MB (Telegram cloud Bot API). >20MB cần local server.
      const sizeMb = (d.file_size ?? 0) / (1024 * 1024);
      const HARD_LIMIT_MB = 100;
      const CLOUD_LIMIT_MB = 20;
      const isLocalServer = this.apiBase.includes("localhost") || this.apiBase.includes("127.0.0.1");
      if (sizeMb > HARD_LIMIT_MB) {
        onStatus(`⚠️ Không upload được — file **${name}** ${sizeMb.toFixed(1)}MB vượt giới hạn 100MB.`);
        return out;
      }
      if (!isLocalServer && sizeMb > CLOUD_LIMIT_MB) {
        onStatus(
          `⚠️ Không upload được — file **${name}** ${sizeMb.toFixed(1)}MB vượt 20MB (giới hạn Telegram cloud).\n` +
          `Vui lòng upload qua portal /admin/collections/media (kéo thả file, không giới hạn).`,
        );
        return out;
      }

      onStatus(`📥 Tải tệp ${name}...`);
      const dl = await this.downloadTelegramFile(d.file_id);
      if (!dl) {
        onStatus(`⚠️ Không tải được tệp ${name}`);
        return out;
      }
      if (dl.reason === "file_too_big") {
        onStatus(
          `⚠️ Không upload được — file **${name}** vượt giới hạn server hiện tại. ` +
          `Vui lòng upload qua portal /admin/collections/media.`,
        );
        return out;
      }
      logger.info("Telegram", `Downloaded ${name} (${(dl.buffer.length / 1024).toFixed(1)}KB)`);

      // Magika file type sniff — bảo vệ pipeline khỏi file giả mạo
      // (.exe/.scr đổi đuôi .pdf, script độc, executable embed trong ảnh...)
      const validation = await validateFile(dl.buffer, name);
      if (!validation.allowed) {
        onStatus(`🛑 ${name}: ${validation.reason}`);
        logger.warn(
          "Telegram",
          `Reject ${name}: claimed=${mime} detected=${validation.detectedLabel} score=${validation.score.toFixed(2)} — ${validation.reason}`,
        );
        return out;
      }
      logger.debug(
        "Telegram",
        `Magika OK ${name}: ${validation.detectedLabel} (${(validation.score * 100).toFixed(0)}%)`,
      );

      // Nếu document thực ra là ảnh (PNG/JPG) → đẩy qua nhánh vision
      // (MarkItDown sẽ trả 0 chars vì không OCR mặc định, AI cần "nhìn" ảnh).
      if (mime.startsWith("image/")) {
        const claudeMime = SUPPORTED_IMAGE_MIME[mime] ?? "image/jpeg";
        let mediaId: string | null = null;
        try {
          onStatus(`📤 Lưu ảnh vào kho media...`);
          const media = await payload.uploadMedia({
            buffer: dl.buffer,
            filename: name,
            mimeType: mime,
            alt: `Telegram chat ${msg.chat.id}`,
          });
          mediaId = media.id;
          logger.info("Telegram", `Uploaded image-doc → media#${media.id}`);
        } catch (err) {
          const reason = err instanceof PayloadError ? err.message : String(err);
          onStatus(`⚠️ Lưu media thất bại (${reason}) — vẫn gửi AI xem ảnh`);
        }
        out.push({ type: "image", name, mediaType: claudeMime, buffer: dl.buffer });

        if (mediaId) {
          const id = mediaId;
          const buf = dl.buffer;
          void describeImage(name, buf, claudeMime)
            .then((descRes) =>
              payload.request(`/api/media/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: {
                  uploadedFrom: "telegram",
                  kind: descRes.kind,
                  description: descRes.description,
                },
              }),
            )
            .then(() =>
              logger.info("Telegram", `media#${id} described (image-doc, ${name})`),
            )
            .catch((e) =>
              logger.warn("Telegram", `describe/PATCH image-doc media#${id} failed: ${e}`),
            );
        }
        return out;
      }

      // Upload Payload media (best-effort — không chặn flow nếu fail)
      let mediaId: string | null = null;
      try {
        onStatus(`📤 Lưu tệp vào kho media...`);
        const media = await payload.uploadMedia({
          buffer: dl.buffer,
          filename: name,
          mimeType: mime,
          alt: `Telegram chat ${msg.chat.id}`,
        });
        mediaId = media.id;
        logger.info("Telegram", `Uploaded ${name} → media#${media.id}`);
      } catch (err) {
        const reason = err instanceof PayloadError ? err.message : String(err);
        logger.warn("Telegram", `Payload upload failed: ${reason}`);
        onStatus(`⚠️ Lưu media thất bại (${reason}) — vẫn tiếp tục đọc nội dung`);
      }

      // Legacy MS Office (.doc / .xls / .ppt / .rtf / .wps / .odt...) →
      // MarkItDown không đọc được. Pre-convert sang .docx/.xlsx/.pptx bằng
      // LibreOffice headless trước khi gửi sang MarkItDown.
      let extractBuf: Buffer = dl.buffer;
      let extractName: string = name;
      if (needsLegacyConvert(name)) {
        onStatus(`🔄 Chuyển ${name} từ định dạng Office cũ → .docx ...`);
        try {
          const conv = await convertLegacyOffice(dl.buffer, name);
          extractBuf = conv.buffer;
          extractName = conv.filename;
          logger.info(
            "Telegram",
            `LegacyOffice ${name} → ${conv.filename} (${conv.buffer.length} bytes)`,
          );
        } catch (err) {
          const reason = err instanceof LegacyOfficeError ? err.message : String(err);
          logger.warn("Telegram", `LegacyOffice convert failed: ${reason}`);
          // Để fallback xuống MarkItDown thử (sẽ fail, hiển thị friendly msg)
        }
      }

      // MarkItDown — extract text from document. Nếu PDF scan (không có
      // text layer) thì sẽ trả empty → fallback OCR qua Claude vision bằng
      // cách convert PDF pages → PNG → push như image attachment.
      let markdown: string | null = null;
      let pdfFallbackPages = 0;
      let scannedPdfPages: PdfPageImage[] = [];
      try {
        onStatus(`🔍 Đọc nội dung qua MarkItDown...`);
        markdown = await convertToMarkdown(extractBuf, extractName);
        logger.info("Telegram", `MarkItDown ${extractName} → ${markdown.length} chars`);

        if (markdown.trim().length < 50 && mime === "application/pdf") {
          onStatus(`👁 PDF không có text — OCR qua Claude vision...`);
          try {
            const pages = await pdfToImages(dl.buffer, { maxPages: 5, dpi: 150 });
            scannedPdfPages = pages;
            pdfFallbackPages = pages.length;
            for (const pg of pages) {
              out.push({
                type: "image",
                name: `${name} (trang ${pg.page})`,
                mediaType: "image/png",
                buffer: pg.buffer,
              });
            }
            onStatus(`✓ Đã chuyển ${pages.length} trang PDF thành ảnh để AI đọc`);
          } catch (err) {
            const reason = err instanceof PdfToImagesError ? err.message : String(err);
            logger.warn("Telegram", `pdf-to-images failed: ${reason}`);
            onStatus(`⚠️ Không OCR được (${reason})`);
          }
        } else {
          out.push({ type: "document", name, markdown });
        }
      } catch (err) {
        const reason = err instanceof MarkItDownError ? err.message : String(err);
        logger.warn("Telegram", `MarkItDown failed: ${reason}`);
        const lower = name.toLowerCase();
        const isLegacyOffice =
          lower.endsWith(".doc") ||
          lower.endsWith(".xls") ||
          lower.endsWith(".ppt") ||
          lower.endsWith(".wps") ||
          lower.endsWith(".rtf");
        if (isLegacyOffice) {
          onStatus(
            `⚠️ File ${name} đang ở định dạng cũ (Word/Excel 97-2003). ` +
            `Em chưa đọc trực tiếp được — anh/chị mở file, "Save As" thành ` +
            `**.docx / .xlsx / .pptx** (hoặc xuất PDF) rồi gửi lại giúp em ạ. ` +
            `File đã được lưu vào kho media, có thể tải lại trong admin.`,
          );
        } else {
          onStatus(
            `⚠️ Em không đọc được nội dung ${name} (định dạng chưa hỗ trợ). ` +
            `File đã được lưu, nhưng AI search/extract sẽ không tìm được nội dung bên trong. ` +
            `Anh/chị thử gửi lại dạng .docx, .pdf, .xlsx, hoặc ảnh chụp giúp em.`,
          );
        }
      }

      // Background tasks — không chặn pipeline trả lời user.
      if (mediaId) {
        const id = mediaId;
        const md = markdown ?? "";

        // Step 1: luôn PATCH metadata cơ bản (uploadedFrom + extractedText)
        // dù describe có thành công hay không.
        void payload
          .request(`/api/media/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: {
              uploadedFrom: "telegram",
              extractedText: md.slice(0, 50_000),
            },
          })
          .catch((e) =>
            logger.warn("Telegram", `metadata PATCH media#${id} failed: ${e}`),
          );

        // Step 2: nếu có content thì describe, không thì gắn kind="other"
        // và description chung dựa filename.
        if (md.trim().length > 50) {
          void describeDocument(name, md)
            .then((d) =>
              payload.request(`/api/media/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: { kind: d.kind, description: d.description },
              }),
            )
            .then(() =>
              logger.info("Telegram", `media#${id} described + saved (${name})`),
            )
            .catch((e) =>
              logger.warn("Telegram", `describe/PATCH media#${id} failed: ${e}`),
            );
        } else if (pdfFallbackPages > 0 && scannedPdfPages.length > 0) {
          // PDF scan: gọi vision OCR trong background để lưu cả `extractedText`
          // (cho `get_media_content` / `redescribe_media` sau này) lẫn `kind`
          // và `description`. Chạy lần thứ 2 vì lần 1 (pipeline reply) chỉ
          // sinh text trả lời user, không persist vào DB.
          const pgs = scannedPdfPages.map((p) => ({
            page: p.page,
            buffer: p.buffer,
            mediaType: "image/png" as const,
          }));
          void describeScannedPdf(name, pgs)
            .then((d) =>
              payload.request(`/api/media/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: {
                  kind: d.kind,
                  description: d.description,
                  extractedText: d.fullText.slice(0, 50_000),
                },
              }),
            )
            .then(() =>
              logger.info(
                "Telegram",
                `media#${id} OCR'd via vision (${pgs.length} pages, ${name})`,
              ),
            )
            .catch((e) =>
              logger.warn("Telegram", `OCR describe failed for media#${id}: ${e}`),
            );
        } else {
          logger.warn(
            "Telegram",
            `MarkItDown returned empty for ${name} (likely scanned PDF) — skipped describe`,
          );
          void payload
            .request(`/api/media/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: {
                kind: "other",
                description:
                  `Không trích được text từ ${name} (có thể là PDF scan/ảnh). ` +
                  `Cần OCR riêng hoặc gửi lại dưới dạng ảnh để Claude vision đọc.`,
              },
            })
            .catch(() => {});
        }
      }
      return out;
    }

    // Photo — Telegram trả mảng size, lấy size lớn nhất
    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo.reduce(
        (a, b) => ((a.width * a.height) >= (b.width * b.height) ? a : b),
      );
      const name = `photo_${largest.file_unique_id}.jpg`;
      onStatus(`📥 Tải ảnh ${largest.width}×${largest.height}...`);
      const dl = await this.downloadTelegramFile(largest.file_id);
      if (!dl) {
        onStatus(`⚠️ Không tải được ảnh`);
        return out;
      }
      if (dl.reason === "file_too_big") {
        onStatus(`⚠️ Ảnh vượt 20MB — vui lòng nén bớt hoặc upload qua portal`);
        return out;
      }
      logger.info("Telegram", `Downloaded photo ${name} (${(dl.buffer.length / 1024).toFixed(1)}KB)`);

      // Magika sniff — Telegram nén ảnh nên ít rủi ro hơn document, nhưng vẫn
      // cảnh giác với polyglot file (ảnh chứa exploit / script).
      const validation = await validateFile(dl.buffer, name);
      if (!validation.allowed) {
        onStatus(`🛑 ${name}: ${validation.reason}`);
        logger.warn(
          "Telegram",
          `Reject photo ${name}: detected=${validation.detectedLabel} — ${validation.reason}`,
        );
        return out;
      }

      // Telegram thường trả jpeg, nhưng có thể là png nếu user gửi qua "send as file"
      const ext = dl.filePath.split(".").pop()?.toLowerCase();
      const mime = ext === "png" ? "image/png" :
                   ext === "webp" ? "image/webp" :
                   ext === "gif" ? "image/gif" : "image/jpeg";
      const claudeMime = SUPPORTED_IMAGE_MIME[mime] ?? "image/jpeg";

      let mediaId: string | null = null;
      try {
        onStatus(`📤 Lưu ảnh vào kho media...`);
        const media = await payload.uploadMedia({
          buffer: dl.buffer,
          filename: name,
          mimeType: mime,
          alt: `Telegram chat ${msg.chat.id}`,
        });
        mediaId = media.id;
        logger.info("Telegram", `Uploaded photo → media#${media.id}`);
      } catch (err) {
        const reason = err instanceof PayloadError ? err.message : String(err);
        logger.warn("Telegram", `Payload upload (photo) failed: ${reason}`);
        onStatus(`⚠️ Lưu media thất bại (${reason}) — vẫn tiếp tục gửi AI xem`);
      }

      out.push({ type: "image", name, mediaType: claudeMime, buffer: dl.buffer });

      // AI tóm tắt ảnh (background) — Claude vision sinh kind + description
      if (mediaId) {
        const id = mediaId;
        const buf = dl.buffer;
        void describeImage(name, buf, claudeMime)
          .then((d) =>
            payload.request(`/api/media/${encodeURIComponent(id)}`, {
              method: "PATCH",
              body: {
                kind: d.kind,
                description: d.description,
                uploadedFrom: "telegram",
              },
            }),
          )
          .then(() =>
            logger.info("Telegram", `media#${id} described + saved (${name})`),
          )
          .catch((e) =>
            logger.warn("Telegram", `describe/PATCH photo media#${id} failed: ${e}`),
          );
      }

      return out;
    }

    return out;
  }

  private async processMessage(
    chatId: number,
    text: string,
    msg: TgMessage,
    /** Multi-file batch: nếu set, resolve attachments từ TẤT CẢ messages
     *  thay vì chỉ msg primary. Caller (enqueueBatchedAttachments) gom các
     *  message có file gửi liên tiếp trong 5s thành 1 batch. */
    batchMsgs?: TgMessage[],
  ): Promise<void> {
    // Quick commands — không qua pipeline. Pass thread_id để reply trong
    // cùng topic Forum.
    const tid = msg.message_thread_id;
    if (text === "/reset" || text === "/clear") {
      this.clearChatHistory(chatId);
      await this.sendMessage(
        chatId,
        "🧹 Đã xoá lịch sử trò chuyện. Bắt đầu lại từ đầu nhé.",
        tid,
      );
      return;
    }
    if (text === "/whoami" || text === "/myid") {
      const u = msg.from;
      const lines = [
        "🆔 Thông tin Telegram của bạn:",
        `• userId: \`${u?.id ?? "?"}\``,
        `• username: ${u?.username ? "@" + u.username : "(không có)"}`,
        `• tên: ${[u?.first_name, u?.last_name].filter(Boolean).join(" ")}`,
        `• chatId hiện tại: \`${chatId}\` (${msg.chat.type})`,
        tid !== undefined ? `• topic_id: \`${tid}\`` : "",
        "",
        "Admin set field `Telegram User ID` trong portal = userId trên để bot DM được bạn.",
      ].filter(Boolean);
      await this.sendMessage(chatId, lines.join("\n"), tid);
      return;
    }

    const summary = text
      ? `text "${text.slice(0, 80)}"`
      : msg.document
        ? `document ${msg.document.file_name ?? msg.document.file_id}`
        : msg.photo
          ? `photo ${msg.photo[msg.photo.length - 1].width}×${msg.photo[msg.photo.length - 1].height}`
          : "(empty)";
    const senderTag = msg.from
      ? `from=${msg.from.id}${msg.from.username ? ` @${msg.from.username}` : ""}`
      : "from=?";
    logger.info("Telegram", `[${chatId}] ${senderTag} ${summary}`);

    // Topic info — nếu message ở trong Forum topic, mọi reply phải kèm
    // message_thread_id để giữ trong cùng topic. undefined = chat thường / DM.
    const threadId = msg.message_thread_id;

    // Initial status message — edit it as tools are called.
    const statusMsgId = await this.sendPlainMessage(chatId, "💭 Đang nghĩ...", threadId);
    const activityLog: string[] = [];
    let lastEditAt = 0;
    let pendingEdit: NodeJS.Timeout | null = null;

    const refreshTyping = () => {
      const body: Record<string, unknown> = { chat_id: chatId, action: "typing" };
      if (threadId !== undefined) body.message_thread_id = threadId;
      void fetch(`${this.apiBase}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});
    };
    refreshTyping();

    const flushEdit = () => {
      if (statusMsgId === null) return;
      lastEditAt = Date.now();
      const body = activityLog.join("\n");
      void this.editMessage(chatId, statusMsgId, body || "💭 Đang nghĩ...");
    };

    const queueEdit = () => {
      if (statusMsgId === null) return;
      const now = Date.now();
      const sinceLast = now - lastEditAt;
      if (sinceLast > 800) {
        // Edit ngay
        if (pendingEdit) { clearTimeout(pendingEdit); pendingEdit = null; }
        flushEdit();
      } else if (!pendingEdit) {
        // Trì hoãn để gom edit, tránh rate-limit Telegram
        pendingEdit = setTimeout(() => {
          pendingEdit = null;
          flushEdit();
        }, 800 - sinceLast);
      }
    };

    // Resolve attachments BEFORE pipeline (cần text từ MarkItDown để inject)
    const onStatus = (note: string) => {
      activityLog.push(note);
      refreshTyping();
      queueEdit();
    };
    // Nếu batch (multi-file): resolve TỪNG msg → gộp attachments.
    let attachments: PipelineAttachment[] = [];
    const msgsToResolve = batchMsgs && batchMsgs.length > 0 ? batchMsgs : [msg];
    if (msgsToResolve.length > 1) {
      onStatus(`📥 Nhận ${msgsToResolve.length} file — đang xử lý song song...`);
    }
    for (const m of msgsToResolve) {
      const part = await this.resolveAttachments(m, onStatus);
      attachments.push(...part);
    }

    // Multi-agent: lookup agent gán cho topic này. Nếu trả null → pipeline
    // dùng SYSTEM_PROMPT mặc định + full tool set (behavior cũ).
    const agent = await lookupAgentForMessage(chatId, threadId);
    if (agent) {
      onStatus(`🤖 ${agent.displayName ?? agent.name}`);
    }

    // Build attachmentNote cho lịch sử (để turn sau AI biết user trước đã gửi gì)
    const attachmentNote = attachments
      .map((a) => `${a.type === "image" ? "🖼" : "📄"} ${a.name}`)
      .join(", ");

    // Lấy history của (chat, topic) này — tách theo thread để tránh lẫn
    // context giữa các topic forum cùng group.
    const histKey = this.historyKey(chatId, threadId);
    const history = this.chatHistory.get(histKey) ?? [];

    // Heartbeat khi pipeline đang chạy — Claude vision/reasoning có thể mất
    // 10-30s trước khi emit tool/text đầu tiên. Update line cuối với elapsed
    // time để user biết bot không treo.
    activityLog.push("💭 AI đang đọc và phân tích...");
    queueEdit();
    const pipelineStartedAt = Date.now();
    const heartbeat = setInterval(() => {
      const sec = Math.round((Date.now() - pipelineStartedAt) / 1000);
      const last = activityLog[activityLog.length - 1] ?? "";
      // Chỉ update nếu line cuối vẫn là dòng "đang đọc" — tránh đè lên
      // tool call hoặc thinking line đã được pipeline emit.
      if (last.startsWith("💭 AI đang đọc và phân tích")) {
        activityLog[activityLog.length - 1] = `💭 AI đang đọc và phân tích... (${sec}s)`;
        refreshTyping();
        queueEdit();
      } else {
        // Pipeline đã có hoạt động → chỉ giữ typing indicator nhấp nháy
        refreshTyping();
      }
    }, 5_000);

    const result = await runPipeline({
      message: text,
      attachments,
      priorMessages: history,
      agent,
      currentChatter: msg.from
        ? {
            telegramUserId: msg.from.id,
            username: msg.from.username,
            firstName: msg.from.first_name,
            lastName: msg.from.last_name,
            chatId: msg.chat.id,
            chatType: msg.chat.type,
            chatTitle: msg.chat.title,
            messageThreadId: threadId,
          }
        : undefined,
      onToolCall: (name, args) => {
        const label = describeToolCall(name, args);
        activityLog.push(label);
        refreshTyping();
        queueEdit();
      },
      onThinking: (txt) => {
        // AI có suy nghĩ trước khi gọi tool — preview ngắn lên status.
        const preview = txt.split("\n")[0].slice(0, 80);
        if (preview) activityLog.push(`💭 ${preview}${txt.length > 80 ? "…" : ""}`);
        queueEdit();
      },
    });
    clearInterval(heartbeat);

    // Cập nhật history ring-buffer cho chat này
    history.push({
      role: "user",
      text: text || "(file đính kèm)",
      attachmentNote: attachmentNote || undefined,
    });
    history.push({ role: "assistant", text: result.reply });
    if (history.length > this.MAX_HISTORY) {
      history.splice(0, history.length - this.MAX_HISTORY);
    }
    this.chatHistory.set(histKey, history);

    if (pendingEdit) clearTimeout(pendingEdit);
    if (statusMsgId !== null) await this.deleteMessage(chatId, statusMsgId);

    // Khi reply trong topic forum và có agent gán cho topic → prepend header
    // `**<displayName>**` để user biết agent nào đang trả lời. DM / chat
    // thường không cần (chỉ có 1 "voice").
    const finalReply = agent?.displayName && threadId !== undefined
      ? `**${agent.displayName}**\n\n${result.reply}`
      : result.reply;
    await this.sendMessage(chatId, finalReply, threadId);
  }

  /** Cho user clear context khi cần (vd: /reset). Không expose qua Telegram
   *  command yet — chỉ programmatic. */
  clearChatHistory(chatId: number, threadId?: number): void {
    if (threadId === undefined) {
      // Clear all topics in chat
      for (const k of Array.from(this.chatHistory.keys())) {
        if (k.startsWith(`${chatId}:`)) this.chatHistory.delete(k);
      }
    } else {
      this.chatHistory.delete(this.historyKey(chatId, threadId));
    }
  }

  /**
   * Serialize work cho cùng 1 chatId qua Promise chain. Chat khác nhau
   * vẫn chạy song song bởi MessageQueue.QUEUE_CONCURRENCY.
   *
   * Trade-off: nếu 1 chat dồn nhiều message liền nhau, các job sau sẽ chờ
   * job trước xong (block 1 slot concurrency). Chấp nhận được vì:
   *  - DM: cùng chatId = cùng 1 user → không ai spam vô nghĩa
   *  - Group: tuần tự là điều ta muốn, để history & context đúng thứ tự
   */
  private async runOnChat(
    chatId: number,
    threadId: number | undefined,
    fn: () => Promise<void>,
  ): Promise<void> {
    const key = `${chatId}:${threadId ?? 0}`;
    const prev = this.chatChains.get(key) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    this.chatChains.set(key, next);
    try {
      await next;
    } finally {
      if (this.chatChains.get(key) === next) {
        this.chatChains.delete(key);
      }
    }
  }

  private async sendPlainMessage(
    chatId: number,
    text: string,
    messageThreadId?: number,
  ): Promise<number | null> {
    try {
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (messageThreadId !== undefined) body.message_thread_id = messageThreadId;
      const res = await fetch(`${this.apiBase}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
      return data.ok && data.result ? data.result.message_id : null;
    } catch { return null; }
  }

  private async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
    try {
      await fetch(`${this.apiBase}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch { /* ignore */ }
  }

  private async deleteMessage(chatId: number, messageId: number): Promise<void> {
    try {
      await fetch(`${this.apiBase}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch { /* ignore */ }
  }
}
