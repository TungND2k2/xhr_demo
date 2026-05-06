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
import ExcelJS from "exceljs";
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

/**
 * Tool xuất file Excel (.xlsx) — AI cung cấp data dạng cấu trúc:
 *   sheets: [{ name, headers: ["Cột 1", "Cột 2"], rows: [["a", 1], ...] }]
 * Mỗi sheet 1 worksheet trong workbook. Server dùng ExcelJS chuyển thành
 * file .xlsx UTF-8 đầy đủ tiếng Việt + format cơ bản (header bold).
 */
async function buildXlsxBuffer(
  sheets: Array<{
    name: string;
    headers: string[];
    rows: Array<Array<string | number | boolean | null>>;
  }>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "xHR-bot";
  wb.created = new Date();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31) || "Sheet"); // Excel max 31 chars
    if (sheet.headers.length > 0) {
      const headerRow = ws.addRow(sheet.headers);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      // Auto width: header length + 2 padding
      ws.columns = sheet.headers.map((h) => ({
        width: Math.max(h.length + 2, 12),
      }));
    }
    for (const row of sheet.rows) {
      ws.addRow(row);
    }
    // Freeze header row + auto filter
    if (sheet.headers.length > 0) {
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.headers.length },
      };
    }
  }

  // ExcelJS trả ArrayBuffer-like, convert sang Buffer
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}

const create_xlsx_file = tool(
  "create_xlsx_file",
  `Sinh file Excel (.xlsx) thật từ data cấu trúc và GỬI THẲNG vào chat
Telegram + lưu media (S3). Khác create_export_file (chỉ text), tool này
nhận structured data → ExcelJS sinh xlsx binary với format đẹp:
- Header in đậm + nền xám
- Auto width cột theo độ dài header
- Freeze panes ở dòng 1
- Auto filter dropdown

Workflow:
1. Bạn (AI) gọi data tools cần thiết (list_workers, list_orders, ...)
2. Format thành \`sheets: [{name, headers, rows}]\`. Mỗi sheet là 1 tab
   trong workbook. Tên sheet ≤ 31 ký tự.
3. Gọi tool này. Tool sẽ encode → upload S3 → sendDocument vào chat.

Khi nào dùng xlsx (vs create_export_file CSV):
- xlsx: nhiều sheet (đa chiều), số liệu/ngày tháng cần format, user thực sự dùng Excel
- CSV (create_export_file): nhanh, đơn giản, ≤ 1 bảng phẳng

Ví dụ:
- "Xuất báo cáo tháng 5: workers + orders + contracts" → 3 sheets trong 1 file
- "Danh sách worker đang training" → 1 sheet
- "Đối chiếu phí dịch vụ Q2" → 1 sheet với cột số tiền`,
  {
    chatId: z.string().describe("Telegram chatId hiện tại từ system prompt"),
    filename: z
      .string()
      .min(1)
      .describe('Tên file kèm extension .xlsx, vd "bao-cao-thang-5.xlsx"'),
    sheets: z
      .array(
        z.object({
          name: z.string().describe("Tên sheet/tab (≤ 31 ký tự)"),
          headers: z.array(z.string()).describe("Tên các cột — dòng đầu"),
          rows: z
            .array(
              z.array(
                z.union([
                  z.string(),
                  z.number(),
                  z.boolean(),
                  z.null(),
                ]),
              ),
            )
            .describe("Mảng các dòng data, mỗi dòng = mảng cell theo thứ tự headers"),
        }),
      )
      .min(1)
      .describe("Danh sách sheets (workbook có thể có nhiều tab)"),
    caption: z.string().optional().describe("Caption hiển thị dưới file (tối đa 1024)"),
  },
  async ({ chatId, filename, sheets, caption }) => {
    if (!filename.toLowerCase().endsWith(".xlsx")) {
      filename = filename.replace(/\.[^.]*$/, "") + ".xlsx";
    }
    const totalRows = sheets.reduce((s, sh) => s + sh.rows.length, 0);
    if (totalRows > 50_000) {
      return err(
        `Tổng ${totalRows} dòng > 50k — quá nặng. Phân nhỏ thành nhiều file hoặc paginate.`,
      );
    }

    let buffer: Buffer;
    try {
      buffer = await buildXlsxBuffer(sheets);
    } catch (e) {
      return err(`Sinh xlsx thất bại: ${e instanceof Error ? e.message : e}`);
    }

    const mt =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    // Upload Payload (S3)
    let mediaId: string | null = null;
    try {
      const media = await payload.uploadMedia({
        buffer,
        filename,
        mimeType: mt,
        alt: `Xlsx export tới chat ${chatId}`,
      });
      mediaId = media.id;
      void payload
        .request(`/api/media/${encodeURIComponent(media.id)}`, {
          method: "PATCH",
          body: {
            uploadedFrom: "api",
            kind: "other",
            description:
              `File Excel ${filename} do bot tạo — ` +
              `${sheets.length} sheet, ${totalRows} dòng tổng (${(buffer.length / 1024).toFixed(1)}KB)`,
          },
        })
        .catch((e) => logger.warn("Export", `metadata PATCH xlsx#${media.id} failed: ${e}`));
      logger.info(
        "Export",
        `Uploaded xlsx ${filename} → media#${media.id} (${sheets.length}s/${totalRows}r/${(buffer.length / 1024).toFixed(1)}KB)`,
      );
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : String(e);
      logger.warn("Export", `Payload xlsx upload failed: ${reason}`);
    }

    // Gửi qua Telegram
    const send = await sendTelegramDocument(chatId, filename, buffer, mt, caption);
    if (!send.ok) {
      return err(
        `Đã upload media${mediaId ? ` #${mediaId}` : ""} nhưng gửi Telegram thất bại: ${send.error}`,
      );
    }

    return ok(
      `✅ Đã gửi file Excel **${filename}** (${sheets.length} sheet, ${totalRows} dòng, ${(buffer.length / 1024).toFixed(1)}KB)${mediaId ? ` — lưu media#${mediaId}` : ""}.`,
    );
  },
);

export const exportTools: AnyTool[] = [
  create_export_file as AnyTool,
  create_xlsx_file as AnyTool,
];
