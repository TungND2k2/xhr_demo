/**
 * Tool sinh báo cáo văn bản đi/đến (sổ hành chính) chuẩn — phòng HCNS.
 *
 * Yêu cầu buổi họp 18/06/2026 (item #9): "Chuẩn hóa quy trình quản lý văn bản
 * đi/đến, sử dụng một mẫu báo cáo chuẩn và agent khi xuất báo cáo thì sử
 * dụng mẫu đó."
 *
 * Tool này query OfficialDocuments trong khoảng thời gian → gom theo direction
 * (đến / đi / nội bộ) → sinh Excel 1 workbook 3 sheet với format chuẩn cho HCNS.
 * Cột chuẩn khớp sổ VB hiện tại (STT, Số VB, Ngày, Nơi gửi/nhận, ...).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import ExcelJS from "exceljs";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

const DIRECTION_LABEL: Record<string, string> = {
  incoming: "📥 Văn bản đến",
  outgoing: "📤 Văn bản đi",
  internal: "🔁 Văn bản nội bộ",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "📝 Bản nháp",
  sent: "📨 Đã gửi",
  received: "📬 Đã nhận",
  processing: "⚙️ Đang xử lý",
  done: "✅ Hoàn thành",
  archived: "📦 Lưu trữ",
  cancelled: "❌ Hủy",
};

const PRIORITY_LABEL: Record<string, string> = {
  normal: "Bình thường",
  urgent: "Khẩn",
  very_urgent: "Rất khẩn",
  confidential: "Mật",
};

interface DocLite {
  id: string;
  documentCode?: string;
  officialNumber?: string;
  title?: string;
  direction?: string;
  status?: string;
  priority?: string;
  documentType?: string;
  issuedDate?: string;
  receivedDate?: string;
  issuingAuthority?: string;
  recipient?: string;
  signedBy?: string;
  responseRecipient?: string;
  deadline?: string;
  processedAt?: string;
  summary?: string;
  scanFile?: { id: string; filename?: string } | string | null;
  assignedTo?: { id: string; displayName?: string; email?: string } | string | null;
  createdAt?: string;
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function resolveScanFilename(f: DocLite["scanFile"]): string {
  if (!f) return "";
  if (typeof f === "string") return "(có file)";
  return f.filename ? `📎 ${f.filename}` : "(có file)";
}
function resolveAssigned(a: DocLite["assignedTo"]): string {
  if (!a) return "";
  if (typeof a === "string") return "";
  return a.displayName ?? a.email ?? "";
}

/**
 * Build 1 sheet cho 1 direction cụ thể.
 */
function buildSheet(
  ws: ExcelJS.Worksheet,
  docs: DocLite[],
  direction: string,
  periodLabel: string,
) {
  const isIncoming = direction === "incoming";

  // Title rows (trên header — cho sổ hành chính chuẩn)
  ws.addRow(["THỊNH LONG GROUP", "", "", "", "", "", "", "", ""]);
  ws.addRow(["PHÒNG HÀNH CHÍNH — NHÂN SỰ", "", "", "", "", "", "", "", ""]);
  ws.addRow([]);
  ws.addRow([DIRECTION_LABEL[direction] ?? direction, "", "", "", "", "", "", "", ""]);
  ws.addRow([`Kỳ báo cáo: ${periodLabel}`, "", "", "", "", "", "", "", ""]);
  ws.addRow([`Tổng số: ${docs.length} văn bản`, "", "", "", "", "", "", "", ""]);
  ws.addRow([]);

  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getRow(2).font = { bold: true, size: 11 };
  ws.getRow(4).font = { bold: true, size: 12 };
  ws.getRow(5).font = { italic: true, color: { argb: "FF666666" } };
  ws.getRow(6).font = { italic: true, color: { argb: "FF666666" } };

  // Header row
  const headers = [
    "STT",
    "Số văn bản",
    isIncoming ? "Ngày ban hành" : "Ngày phát hành",
    isIncoming ? "Ngày TLG nhận" : "Ngày gửi",
    isIncoming ? "Cơ quan gửi" : "Nơi nhận",
    "Loại VB",
    "Trích yếu nội dung",
    "Người ký",
    "Người xử lý (TLG)",
    "Trạng thái",
    "Độ khẩn",
    "Hạn xử lý",
    "File scan",
    "Ghi chú",
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E40AF" }, // xanh navy
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 32;

  // Data rows
  docs.forEach((d, i) => {
    ws.addRow([
      i + 1,
      d.officialNumber ?? d.documentCode ?? "",
      fmtDate(d.issuedDate),
      fmtDate(d.receivedDate),
      isIncoming ? (d.issuingAuthority ?? "") : (d.recipient ?? ""),
      d.documentType ?? "",
      d.title ?? d.summary ?? "",
      d.signedBy ?? "",
      resolveAssigned(d.assignedTo),
      STATUS_LABEL[d.status ?? ""] ?? d.status ?? "",
      PRIORITY_LABEL[d.priority ?? ""] ?? d.priority ?? "",
      fmtDate(d.deadline),
      resolveScanFilename(d.scanFile),
      "",
    ]);
  });

  // Set column widths
  ws.columns = [
    { width: 5 },   // STT
    { width: 15 },  // Số VB
    { width: 12 },  // Ngày ban hành
    { width: 12 },  // Ngày nhận
    { width: 25 },  // Cơ quan/Nơi nhận
    { width: 18 },  // Loại
    { width: 40 },  // Trích yếu
    { width: 18 },  // Người ký
    { width: 18 },  // Người xử lý
    { width: 15 },  // Trạng thái
    { width: 12 },  // Độ khẩn
    { width: 12 },  // Hạn xử lý
    { width: 20 },  // File scan
    { width: 20 },  // Ghi chú
  ];

  // Wrap text cho trích yếu + apply border tất cả data cells
  const startDataRow = 8; // header at row 8
  const endDataRow = startDataRow + docs.length;
  for (let r = startDataRow; r <= endDataRow; r += 1) {
    const row = ws.getRow(r);
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
    });
  }

  // Footer
  ws.addRow([]);
  ws.addRow([]);
  const footerRow1 = ws.addRow(["", "", "", "", "", "", "", "Ngày ...  tháng ... năm ...."]);
  footerRow1.font = { italic: true };
  const footerRow2 = ws.addRow(["Tổng Giám đốc", "", "", "", "", "", "", "Phòng Tổ chức Hành chính"]);
  footerRow2.font = { bold: true };
  footerRow2.alignment = { horizontal: "center" };

  // Freeze title + header
  ws.views = [{ state: "frozen", ySplit: startDataRow }];
}

const export_official_documents_report = tool(
  "export_official_documents_report",
  `Xuất báo cáo sổ Văn bản đi/đến (Phòng HCNS) theo mẫu chuẩn TLG.

Tool tự query OfficialDocuments trong khoảng thời gian → xuất Excel 3 sheet:
- 📥 Văn bản đến (direction=incoming)
- 📤 Văn bản đi (direction=outgoing)
- 🔁 Văn bản nội bộ (direction=internal)

Format sheet chuẩn HCNS: title 6 dòng (Thịnh Long Group, phòng HC, kỳ báo cáo,
tổng số) → header xanh navy → data table đầy đủ cột (STT, Số VB, Ngày, Nơi
gửi/nhận, Loại, Trích yếu, Người ký, Người xử lý, Trạng thái, Độ khẩn, Hạn,
File scan) → footer chữ ký.

Khi nào dùng:
- User hỏi "@bot xuất sổ văn bản tháng 5" / "báo cáo VB đi đến quý 2" /
  "danh sách công văn tháng này" → gọi tool này.
- Nếu chỉ cần 1 chiều (đi hoặc đến) → truyền directionFilter.
- Nếu không truyền month → xuất cả năm.

Tham số:
- chatId: Telegram chatId hiện tại (từ system prompt)
- threadId: topic ID (nếu forum)
- year: năm báo cáo (bắt buộc, vd 2026)
- month: 1-12 (optional — bỏ trống = cả năm)
- directionFilter: 'incoming' / 'outgoing' / 'internal' — chỉ xuất 1 sheet.
  Bỏ trống = xuất cả 3 sheet.`,
  {
    chatId: z.string().describe("Telegram chatId từ system prompt"),
    threadId: z.string().optional().describe("message_thread_id nếu forum"),
    year: z.number().int().min(2020).max(2100).describe("Năm báo cáo, vd 2026"),
    month: z.number().int().min(1).max(12).optional().describe("Tháng 1-12, bỏ trống = cả năm"),
    directionFilter: z
      .enum(["incoming", "outgoing", "internal"])
      .optional()
      .describe("Chỉ xuất 1 direction. Bỏ trống = cả 3."),
  },
  async ({ chatId, threadId, year, month, directionFilter }) => {
    // 1. Tính range
    let fromIso: string;
    let toIso: string;
    let periodLabel: string;
    if (month) {
      const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      fromIso = from.toISOString();
      toIso = to.toISOString();
      periodLabel = `Tháng ${String(month).padStart(2, "0")}/${year}`;
    } else {
      fromIso = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
      toIso = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
      periodLabel = `Năm ${year}`;
    }

    // 2. Query — dùng OR cho issuedDate hoặc receivedDate rơi trong khoảng
    const where: Record<string, unknown> = {
      or: [
        { issuedDate: { greater_than_equal: fromIso, less_than_equal: toIso } },
        { receivedDate: { greater_than_equal: fromIso, less_than_equal: toIso } },
      ],
    };
    if (directionFilter) {
      where.direction = { equals: directionFilter };
    }

    let docs: DocLite[];
    try {
      const res = await payload.request<{ docs: DocLite[]; totalDocs: number }>(
        `/api/official-documents`,
        {
          query: {
            where,
            limit: 2000,
            depth: 1,
            sort: "-issuedDate",
          },
        },
      );
      docs = res.docs;
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : String(e);
      return err(`Query công văn thất bại: ${reason}`);
    }

    if (docs.length === 0) {
      return ok(`Không có công văn nào trong ${periodLabel}${directionFilter ? ` (chiều ${directionFilter})` : ""}.`);
    }

    // 3. Group theo direction
    const groups: Record<string, DocLite[]> = { incoming: [], outgoing: [], internal: [] };
    for (const d of docs) {
      const dir = d.direction ?? "internal";
      (groups[dir] ??= []).push(d);
    }

    // 4. Build workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "xHR-bot (HCNS)";
    wb.created = new Date();

    const directionsToBuild = directionFilter
      ? [directionFilter]
      : ["incoming", "outgoing", "internal"];
    for (const dir of directionsToBuild) {
      const list = groups[dir] ?? [];
      const sheetName =
        dir === "incoming" ? "VB Đến"
        : dir === "outgoing" ? "VB Đi"
        : "VB Nội bộ";
      const ws = wb.addWorksheet(sheetName);
      buildSheet(ws, list, dir, periodLabel);
    }

    const arrayBuffer = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);

    const filename = `so-van-ban-${month ? `T${String(month).padStart(2, "0")}-` : ""}${year}.xlsx`;
    const mt = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    // 5. Upload Media (S3)
    let mediaId: string | null = null;
    try {
      const media = await payload.uploadMedia({
        buffer,
        filename,
        mimeType: mt,
        alt: `Sổ văn bản ${periodLabel}`,
      });
      mediaId = media.id;
      void payload
        .request(`/api/media/${encodeURIComponent(media.id)}`, {
          method: "PATCH",
          body: {
            uploadedFrom: "api",
            kind: "other",
            description: `Sổ Văn bản đi/đến ${periodLabel} — HCNS — do bot sinh (${docs.length} VB).`,
          },
        })
        .catch((e) => logger.warn("Export", `metadata PATCH ${filename} failed: ${e}`));
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : String(e);
      logger.warn("Export", `Media upload failed: ${reason}`);
    }

    // 6. Send Telegram
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) throw new Error("TELEGRAM_BOT_TOKEN không set");
      const url = `https://api.telegram.org/bot${token}/sendDocument`;
      const form = new FormData();
      form.append("chat_id", chatId);
      if (threadId) form.append("message_thread_id", threadId);
      form.append(
        "caption",
        `📊 Sổ Văn bản đi/đến — ${periodLabel}\n` +
          `Đến: ${groups.incoming.length} · Đi: ${groups.outgoing.length} · Nội bộ: ${groups.internal.length}`,
      );
      const blob = new Blob([new Uint8Array(buffer)], { type: mt });
      form.append("document", blob, filename);
      const r = await fetch(url, { method: "POST", body: form });
      if (!r.ok) throw new Error(`Telegram HTTP ${r.status}: ${await r.text()}`);
    } catch (e) {
      return err(
        `Đã lưu media${mediaId ? ` #${mediaId}` : ""} nhưng gửi Telegram thất bại: ${e instanceof Error ? e.message : e}`,
      );
    }

    const summary =
      `✅ Đã xuất sổ VB **${periodLabel}** (${docs.length} công văn)\n` +
      `- 📥 Đến: ${groups.incoming.length}\n` +
      `- 📤 Đi: ${groups.outgoing.length}\n` +
      `- 🔁 Nội bộ: ${groups.internal.length}\n` +
      `File: ${filename} — ${(buffer.length / 1024).toFixed(1)}KB${mediaId ? ` — media#${mediaId}` : ""}`;
    return ok(summary);
  },
);

export const officialDocumentWorkflowTools: AnyTool[] = [
  export_official_documents_report as AnyTool,
];
