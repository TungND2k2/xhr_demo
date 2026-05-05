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
import { describeDocument, describeImage, describeScannedPdf } from "../extraction/describe.js";
import { pdfToImages, PdfToImagesError, type PdfPageImage } from "../extraction/pdf-to-images.js";
import { payload, PayloadError } from "../payload/client.js";
import { syncOnIncomingMessage } from "../payload/telegram-sync.js";

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
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string; title?: string };
  text?: string;
  caption?: string;
  entities?: TgMessageEntity[];
  caption_entities?: TgMessageEntity[];
  document?: TgDocument;
  photo?: TgPhotoSize[];
  reply_to_message?: TgMessage;
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

  /** Per-chatId conversation history — last MAX_HISTORY items rolling window.
   *  In-memory; mất khi bot restart (chấp nhận được — user chat lại context). */
  private readonly chatHistory = new Map<
    number,
    Array<{ role: "user" | "assistant"; text: string; attachmentNote?: string }>
  >();
  private readonly MAX_HISTORY = 12;

  /** Per-chatId serial chain — đảm bảo trong cùng 1 chat (đặc biệt group),
   *  các message được xử lý tuần tự để không có race khi đọc/ghi chatHistory.
   *  Chat khác nhau vẫn parallel theo QUEUE_CONCURRENCY. */
  private readonly chatChains = new Map<number, Promise<void>>();

  constructor(
    private readonly botToken: string,
    private readonly config: Config,
  ) {
    this.queue = new MessageQueue(config);
  }

  private get apiBase(): string {
    return `https://api.telegram.org/bot${this.botToken}`;
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

  /** Send a message to a chat — also exposed for cron worker notifications. */
  async sendMessage(chatId: number, text: string): Promise<void> {
    const html = mdToTelegramHtml(text);
    for (const chunk of splitMessage(html)) {
      try {
        await fetch(`${this.apiBase}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: "HTML",
          }),
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
      if (!addressed.match) continue;
      this.handleMessage(msg, addressed.cleanedText);
    }
  }

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

  private handleMessage(msg: TgMessage, overrideText?: string): void {
    if (!msg.from) return;
    const chatId = msg.chat.id;
    const text = (overrideText ?? msg.text ?? msg.caption ?? "").trim();

    // Auto-track Telegram identity (user + group + membership). Fire-and-
    // forget — không block xử lý message. syncOnIncomingMessage tự find-
    // before-create để không tạo duplicate.
    void syncOnIncomingMessage(msg.from, msg.chat).then((res) => {
      if (res.blocked) {
        logger.info(
          "Telegram",
          `[${chatId}] from=${msg.from?.id} blocked by admin — skipping`,
        );
      }
    });

    const job: QueueJob = {
      id: newId(),
      priority: 1,
      enqueuedAt: Date.now(),
      run: () => this.runOnChat(chatId, () => this.processMessage(chatId, text, msg)),
    };

    if (!this.queue.enqueue(job)) {
      this.sendMessage(chatId, "Hệ thống đang bận, vui lòng thử lại sau giây lát.")
        .catch(() => {});
    }
  }

  /** GET file_path qua getFile + tải bytes. */
  private async downloadTelegramFile(
    fileId: string,
  ): Promise<{ buffer: Buffer; filePath: string } | null> {
    try {
      const r1 = await fetch(`${this.apiBase}/getFile?file_id=${encodeURIComponent(fileId)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      const j1 = (await r1.json()) as { ok: boolean; result?: { file_path: string } };
      if (!j1.ok || !j1.result?.file_path) {
        logger.warn("Telegram", `getFile failed for ${fileId}`);
        return null;
      }
      const filePath = j1.result.file_path;
      const r2 = await fetch(`https://api.telegram.org/file/bot${this.botToken}/${filePath}`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!r2.ok) {
        logger.warn("Telegram", `download ${filePath} HTTP ${r2.status}`);
        return null;
      }
      const buf = Buffer.from(await r2.arrayBuffer());
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
      onStatus(`📥 Tải tệp ${name}...`);
      const dl = await this.downloadTelegramFile(d.file_id);
      if (!dl) {
        onStatus(`⚠️ Không tải được tệp ${name}`);
        return out;
      }
      logger.info("Telegram", `Downloaded ${name} (${(dl.buffer.length / 1024).toFixed(1)}KB)`);

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

      // MarkItDown — extract text from document. Nếu PDF scan (không có
      // text layer) thì sẽ trả empty → fallback OCR qua Claude vision bằng
      // cách convert PDF pages → PNG → push như image attachment.
      let markdown: string | null = null;
      let pdfFallbackPages = 0;
      let scannedPdfPages: PdfPageImage[] = [];
      try {
        onStatus(`🔍 Đọc nội dung qua MarkItDown...`);
        markdown = await convertToMarkdown(dl.buffer, name);
        logger.info("Telegram", `MarkItDown ${name} → ${markdown.length} chars`);

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
        onStatus(`⚠️ Không đọc được nội dung tệp (${reason})`);
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
      logger.info("Telegram", `Downloaded photo ${name} (${(dl.buffer.length / 1024).toFixed(1)}KB)`);

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
  ): Promise<void> {
    // Quick commands — không qua pipeline.
    if (text === "/reset" || text === "/clear") {
      this.clearChatHistory(chatId);
      await this.sendMessage(
        chatId,
        "🧹 Đã xoá lịch sử trò chuyện. Bắt đầu lại từ đầu nhé.",
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
        "",
        "Admin set field `Telegram User ID` trong portal = userId trên để bot DM được bạn.",
      ];
      await this.sendMessage(chatId, lines.join("\n"));
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

    // Initial status message — edit it as tools are called.
    const statusMsgId = await this.sendPlainMessage(chatId, "💭 Đang nghĩ...");
    const activityLog: string[] = [];
    let lastEditAt = 0;
    let pendingEdit: NodeJS.Timeout | null = null;

    const refreshTyping = () => {
      void fetch(`${this.apiBase}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action: "typing" }),
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
    const attachments = await this.resolveAttachments(msg, onStatus);

    // Build attachmentNote cho lịch sử (để turn sau AI biết user trước đã gửi gì)
    const attachmentNote = attachments
      .map((a) => `${a.type === "image" ? "🖼" : "📄"} ${a.name}`)
      .join(", ");

    // Lấy history của chat này
    const history = this.chatHistory.get(chatId) ?? [];

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
      currentChatter: msg.from
        ? {
            telegramUserId: msg.from.id,
            username: msg.from.username,
            firstName: msg.from.first_name,
            lastName: msg.from.last_name,
            chatId: msg.chat.id,
            chatType: msg.chat.type,
            chatTitle: msg.chat.title,
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
    this.chatHistory.set(chatId, history);

    if (pendingEdit) clearTimeout(pendingEdit);
    if (statusMsgId !== null) await this.deleteMessage(chatId, statusMsgId);
    await this.sendMessage(chatId, result.reply);
  }

  /** Cho user clear context khi cần (vd: /reset). Không expose qua Telegram
   *  command yet — chỉ programmatic. */
  clearChatHistory(chatId: number): void {
    this.chatHistory.delete(chatId);
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
  private async runOnChat(chatId: number, fn: () => Promise<void>): Promise<void> {
    const prev = this.chatChains.get(chatId) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    this.chatChains.set(chatId, next);
    try {
      await next;
    } finally {
      // Cleanup khi chain rỗng — tránh leak Map theo thời gian
      if (this.chatChains.get(chatId) === next) {
        this.chatChains.delete(chatId);
      }
    }
  }

  private async sendPlainMessage(chatId: number, text: string): Promise<number | null> {
    try {
      const res = await fetch(`${this.apiBase}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
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
