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
import { payload, PayloadError } from "../payload/client.js";

interface TgUser {
  id: number;
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
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  document?: TgDocument;
  photo?: TgPhotoSize[];
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
    this.poll();
    logger.info("Telegram", "Polling started");
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
      if (!msg || msg.chat.type !== "private") continue;
      const hasContent = !!(msg.text || msg.caption || msg.document || msg.photo);
      if (hasContent) this.handleMessage(msg);
    }
  }

  private handleMessage(msg: TgMessage): void {
    if (!msg.from) return;
    const chatId = msg.chat.id;
    const text = (msg.text ?? msg.caption ?? "").trim();

    const job: QueueJob = {
      id: newId(),
      priority: 1,
      enqueuedAt: Date.now(),
      run: () => this.processMessage(chatId, text, msg),
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

      // Upload Payload media (best-effort — không chặn flow nếu fail)
      try {
        onStatus(`📤 Lưu tệp vào kho media...`);
        const media = await payload.uploadMedia({
          buffer: dl.buffer,
          filename: name,
          mimeType: mime,
          alt: `Telegram chat ${msg.chat.id}`,
        });
        logger.info("Telegram", `Uploaded ${name} → media#${media.id}`);
      } catch (err) {
        const reason = err instanceof PayloadError ? err.message : String(err);
        logger.warn("Telegram", `Payload upload failed: ${reason}`);
        onStatus(`⚠️ Lưu media thất bại (${reason}) — vẫn tiếp tục đọc nội dung`);
      }

      // MarkItDown
      try {
        onStatus(`🔍 Đọc nội dung qua MarkItDown...`);
        const markdown = await convertToMarkdown(dl.buffer, name);
        logger.info("Telegram", `MarkItDown ${name} → ${markdown.length} chars`);
        out.push({ type: "document", name, markdown });
      } catch (err) {
        const reason = err instanceof MarkItDownError ? err.message : String(err);
        logger.warn("Telegram", `MarkItDown failed: ${reason}`);
        onStatus(`⚠️ Không đọc được nội dung tệp (${reason})`);
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

      try {
        onStatus(`📤 Lưu ảnh vào kho media...`);
        const media = await payload.uploadMedia({
          buffer: dl.buffer,
          filename: name,
          mimeType: mime,
          alt: `Telegram chat ${msg.chat.id}`,
        });
        logger.info("Telegram", `Uploaded photo → media#${media.id}`);
      } catch (err) {
        const reason = err instanceof PayloadError ? err.message : String(err);
        logger.warn("Telegram", `Payload upload (photo) failed: ${reason}`);
        onStatus(`⚠️ Lưu media thất bại (${reason}) — vẫn tiếp tục gửi AI xem`);
      }

      out.push({ type: "image", name, mediaType: claudeMime, buffer: dl.buffer });
      return out;
    }

    return out;
  }

  private async processMessage(
    chatId: number,
    text: string,
    msg: TgMessage,
  ): Promise<void> {
    const summary = text
      ? `text "${text.slice(0, 80)}"`
      : msg.document
        ? `document ${msg.document.file_name ?? msg.document.file_id}`
        : msg.photo
          ? `photo ${msg.photo[msg.photo.length - 1].width}×${msg.photo[msg.photo.length - 1].height}`
          : "(empty)";
    logger.info("Telegram", `[${chatId}] ${summary}`);

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

    const result = await runPipeline({
      message: text,
      attachments,
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

    if (pendingEdit) clearTimeout(pendingEdit);
    if (statusMsgId !== null) await this.deleteMessage(chatId, statusMsgId);
    await this.sendMessage(chatId, result.reply);
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
