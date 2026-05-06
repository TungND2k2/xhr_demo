/**
 * Tools để AI tự xuất file (CSV / MD / TXT / JSON) — upload vào Payload
 * media (S3) + gửi trực tiếp vào chat Telegram qua sendDocument.
 *
 * Use cases:
 *   - "Xuất danh sách worker đang training ra Excel" → AI sinh CSV
 *   - "Tạo báo cáo tổng hợp đơn tuyển tháng 5" → markdown table
 *   - "Export YCTD ra JSON" → machine-readable cho integration
 *
 * Lưu ý: tool dùng `process.env.TELEGRAM_BOT_TOKEN` trực tiếp để gửi
 * sendDocument (không qua TelegramChannel singleton — giữ tool stateless).
 * chatId AI lấy từ block "Người đang chat với bạn" trong system prompt.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

const MIME_BY_EXT: Record<string, string> = {
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  html: "text/html",
  xml: "application/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
};

function guessMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXT[ext] ?? "text/plain";
}

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

async function sendTelegramDocument(
  chatId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN không set" };

  try {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append(
      "document",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      filename,
    );
    if (caption) form.append("caption", caption.slice(0, 1024));

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Telegram HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const create_export_file = tool(
  "create_export_file",
  `Sinh 1 file text-based (CSV/MD/TXT/JSON/HTML) và GỬI THẲNG vào chat Telegram
hiện tại + lưu vào media collection (S3).

Workflow:
1. Bạn (AI) tự sinh nội dung file dạng string (vd CSV với header + rows).
2. Gọi tool này với chatId (từ system prompt), filename (có extension), content.
3. Tool upload + sendDocument → user thấy file ngay trong chat, click tải về.

Dùng khi user nhờ:
- "Xuất danh sách workers đang training" → CSV (Excel mở được)
- "Tạo báo cáo tổng hợp đơn tuyển tháng 5" → markdown
- "Export đơn XHR-12 ra JSON" → application/json
- "Tổng hợp ứng viên match đơn Toyota" → CSV/MD

Format guidelines:
- CSV: dòng đầu = header, các dòng sau = data. Cell có dấu phẩy/xuống dòng → bao "double quote", escape " thành "". UTF-8 không BOM.
- Markdown: dùng table | col1 | col2 | với separator | --- | --- |.
- JSON: pretty-print 2 space indent.

KHÔNG dùng tool này cho:
- File ảnh (cần raw bytes — tool này chỉ nhận text content).
- File quá dài (>1MB content) — chia nhỏ hoặc paginate.`,
  {
    chatId: z
      .string()
      .describe(
        "Telegram chatId để gửi file vào. Lấy từ 'chatId hiện tại' trong system prompt (xem block 'Người đang chat với bạn').",
      ),
    filename: z
      .string()
      .min(1)
      .describe(
        'Tên file kèm extension, vd "workers-training-2026-05.csv". Extension quyết định mimeType.',
      ),
    content: z.string().min(1).describe("Nội dung file dạng text/UTF-8."),
    mimeType: z
      .string()
      .optional()
      .describe(
        "MIME type override. Default = đoán từ extension (csv→text/csv, md→text/markdown, json→application/json...).",
      ),
    caption: z
      .string()
      .optional()
      .describe(
        "Caption hiển thị dưới file trên Telegram (max 1024 ký tự, vd: 'Đây là báo cáo tháng 5.').",
      ),
  },
  async ({ chatId, filename, content, mimeType, caption }) => {
    const buffer = Buffer.from(content, "utf-8");
    if (buffer.length > 1024 * 1024) {
      return err(
        `File quá lớn (${(buffer.length / 1024).toFixed(1)}KB > 1MB). Chia nhỏ hoặc paginate.`,
      );
    }
    const mt = mimeType ?? guessMime(filename);

    // 1. Upload vào media (S3) — best-effort, không chặn flow nếu fail
    let mediaId: string | null = null;
    try {
      const media = await payload.uploadMedia({
        buffer,
        filename,
        mimeType: mt,
        alt: `Export tới chat ${chatId}`,
      });
      mediaId = media.id;
      // Mark uploadedFrom + extractedText (chính nội dung)
      void payload
        .request(`/api/media/${encodeURIComponent(media.id)}`, {
          method: "PATCH",
          body: {
            uploadedFrom: "api",
            extractedText: content.slice(0, 50_000),
            kind: "other",
            description:
              `File export ${filename} do bot tạo (${(buffer.length / 1024).toFixed(1)}KB, ${mt})`,
          },
        })
        .catch((e) =>
          logger.warn("Export", `metadata PATCH media#${media.id} failed: ${e}`),
        );
      logger.info(
        "Export",
        `Uploaded ${filename} → media#${media.id} (${(buffer.length / 1024).toFixed(1)}KB)`,
      );
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : String(e);
      logger.warn("Export", `Payload upload failed: ${reason}`);
    }

    // 2. Gửi file vào chat qua Telegram sendDocument
    const send = await sendTelegramDocument(chatId, filename, buffer, mt, caption);
    if (!send.ok) {
      return err(
        `Đã upload media${mediaId ? ` #${mediaId}` : ""} nhưng gửi Telegram thất bại: ${send.error}`,
      );
    }

    return ok(
      `✅ Đã gửi file **${filename}** (${(buffer.length / 1024).toFixed(1)}KB, ${mt})${mediaId ? ` — lưu media#${mediaId}` : ""}.`,
    );
  },
);

export const exportTools: AnyTool[] = [create_export_file as AnyTool];
