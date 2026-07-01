/**
 * Notify Telegram khi NLĐ submit FormInvite:
 *  1. Lookup invite (notifyChatId/notifyThreadId + worker + form fields)
 *  2. Load submission data
 *  3. Build text summary (theo từng section, có label tiếng Việt)
 *  4. Generate Excel file từ data (1 sheet: Field — Giá trị)
 *  5. Bot bắn message + sendDocument (Excel) vào đúng topic recruiter
 *
 * Best-effort: lỗi không throw — chỉ log warn.
 */
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

import { payload } from "../payload/client.js";
import { logger } from "../utils/logger.js";

// Đường dẫn template HSN-M01: <root>/templates/hsn-m01.xlsx
// Khi build dist/, copy template ra dist/templates/ thông qua tsconfig hoặc
// dùng src path khi dev. Ở đây dùng env override + fallback relative path.
const TEMPLATE_PATH = process.env.HSN_M01_TEMPLATE
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../templates/hsn-m01.xlsx");

interface NotifyArgs {
  inviteId: string;
  formId: string;
  submissionId: string;
  workerId?: string;
  workerName?: string;
  fullName?: string | null;
  phone?: string | null;
}

interface FormField {
  blockType: string;
  name?: string;
  label?: string;
  options?: Array<{ label: string; value: string }>;
}

interface SubmissionData {
  field: string;
  value: unknown;
}

interface InviteDoc {
  id: string;
  notifyChatId?: string;
  notifyThreadId?: string;
  createdByTelegram?: string;
  worker?: { id: string; workerCode?: string; fullName?: string } | string;
}

interface FormDoc {
  id: string;
  title: string;
  fields: FormField[];
}

interface SubmissionDoc {
  id: string;
  submissionData: SubmissionData[];
  createdAt: string;
}

function labelOf(field: FormField | undefined, fieldName: string): string {
  if (!field) return fieldName;
  return field.label ?? fieldName;
}

function valueOf(field: FormField | undefined, raw: unknown): string {
  const s = String(raw ?? "");
  if (!field) return s;
  // Radio/select → map value → label
  if ((field.blockType === "radio" || field.blockType === "select") && field.options) {
    const opt = field.options.find((o) => o.value === s);
    if (opt) return opt.label;
  }
  return s;
}

// Map field name → cell address trong template "Form TV" của HSN-M01.
// Một số field overwrite cả label + ":" (vd "ĐƠN HÀNG ĐĂNG KÝ: <value>").
//
// Dấu ".cellOnly" = chỉ write giá trị thô vào cell (không kèm prefix).
// Dấu ".prefix" = write "<prefix>: <value>" overwrite cả label.
interface CellMap {
  cell: string;
  prefix?: string;
}
const FIELD_TO_CELL: Record<string, CellMap> = {
  // Header
  orderCode:        { cell: "A3", prefix: "ĐƠN HÀNG ĐĂNG KÝ" },
  interviewDate:    { cell: "A4", prefix: "Ngày thi tuyển" },
  learningSource:   { cell: "O4" },        // sau M4:N4 "Học nguồn" label
  learningEntrance: { cell: "S4" },        // sau P4:R4 "Học thi tuyển" label

  // Lý lịch cơ bản
  fullName:         { cell: "B5" },        // B5:I5 merged value
  katakanaName:     { cell: "K5" },        // K5:L5 merged
  gender:           { cell: "O5" },        // O5:P5 "Nam"
  dateOfBirth:      { cell: "B6" },        // B6:I6
  age:              { cell: "K6" },        // K6:L6
  heightCm:         { cell: "O6" },
  weightKg:         { cell: "Q6" },
  idNumber:         { cell: "B7" },        // B7:I7
  idIssuedDate:     { cell: "K7" },        // K7:L7
  tattoo:           { cell: "O7" },        // O7:R7

  // Sức khoẻ
  eyeSightLeft:     { cell: "C8" },        // C8:E8
  eyeSightRight:    { cell: "H8" },        // H8:I8
  colorBlind:       { cell: "K8" },        // K8:K9
  bloodTypeBP:      { cell: "O8" },        // O8:R8
  drinker:          { cell: "B9" },        // B9:C9
  smoker:           { cell: "H9" },        // H9:I9
  healthCheck:      { cell: "O9" },        // O9:R9

  // Hôn nhân + tôn giáo
  maritalStatus:    { cell: "B10" },       // B10:C10
  religion:         { cell: "H10" },       // H10:I10
  handDominant:     { cell: "K10" },       // K10:L10
  highestDegree:    { cell: "O10" },       // O10:R10

  // Địa chỉ + gia đình
  address:          { cell: "O11" },       // O11:U12 (large)
  hasChildren:      { cell: "D12" },       // D12:I12
  travelAbroad:     { cell: "K12" },       // K12:L12 (text dump)

  // Học vấn, công tác, gia đình — KHÔNG dùng FIELD_TO_CELL (dump 1 ô)
  // Xử lý riêng qua fillTableRows() bên dưới.

  // Tiền sử
  visaJapanBefore:  { cell: "J18" },       // overwrite "Chưa" placeholder
  criminalRecord:   { cell: "P18" },       // P18:U18 overwrite "không"

  // Định hướng (đã đúng — các merge B25:K25 / M25:U25 / etc)
  orderReason:      { cell: "B24" },       // B24:U24 (overwrite sample)
  strengths:        { cell: "B25" },       // B25:K25
  weaknesses:       { cell: "M25" },       // M25:U25
  hobbies:          { cell: "B26" },       // B26:K26
  expertise:        { cell: "M26" },       // M26:U26
  japanReason:      { cell: "B27" },       // B27:K27
  targetAmountAfter3y: { cell: "M27" },    // M27:U27
  planAfterReturn:  { cell: "B28" },       // B28:K28
  relativeInJapan:  { cell: "M28" },       // M28:U28

  // Bảo lãnh — FIX: nhiều cell trước đây trỏ vào LABEL không phải VALUE
  consentFrom:      { cell: "D37" },       // D37:H37 overwrite "Bố mẹ"
  consentDuration:  { cell: "K37" },       // K37 single cell overwrite "Nửa năm"
  enrollmentDate:   { cell: "N37" },       // N37:P37 value (was M37 — wrong, label area)
  applicationDate:  { cell: "T37" },       // T37:U37 value (was R37 — wrong)
  guarantorRelation:{ cell: "D38" },       // D38:K38 value (was B38 — label area)
  guarantorName:    { cell: "Q38" },       // Q38:U38 value (was M38 — label area)
  personalPhone:    { cell: "E39" },       // E39:J39 value (was B39 — label)
  guarantorPhone:   { cell: "N39" },       // N39:U39 value (was M39 — label)
  managerName:      { cell: "E40" },       // E40:J40 value (was B40 — label)
  managerPhone:     { cell: "N40" },       // N40:U40 value (was M40 — label)
};

async function buildExcel(form: FormDoc, submission: SubmissionDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(TEMPLATE_PATH);
  } catch (e) {
    logger.error(
      "FormNotify",
      `Template HSN-M01 không đọc được tại ${TEMPLATE_PATH}: ${e}. Fallback dùng layout đơn giản.`,
    );
    return buildExcelFallback(form, submission);
  }

  const ws = wb.getWorksheet("Form TV") ?? wb.worksheets[0];
  if (!ws) return buildExcelFallback(form, submission);

  const fieldMap = new Map(form.fields.filter((f) => f.name).map((f) => [f.name!, f] as const));

  // Build map field → raw value
  const valMap = new Map<string, string>();
  for (const sd of submission.submissionData) {
    const f = fieldMap.get(sd.field);
    const val = valueOf(f, sd.value);
    if (val && val.trim() !== "") valMap.set(sd.field, val);
  }

  // 1. Single-cell fields (theo FIELD_TO_CELL)
  for (const [field, val] of valMap) {
    const map = FIELD_TO_CELL[field];
    if (!map) continue;
    const cell = ws.getCell(map.cell);
    cell.value = map.prefix ? `${map.prefix}: ${val}` : val;
  }

  // 2. Multi-row tables — split lines, parse cells, write to multiple rows
  fillTableRows(ws, valMap.get("educationHistory"), {
    rows: [14, 15, 16, 17],
    extract: (parts) => {
      const [yearRange, school, major, years, jpHours] = parts;
      const [startY, endY] = (yearRange ?? "").split(/[-–—]/).map((s) => s.trim());
      return [
        ["B", startY], ["G", endY],
        ["J", school],
        ["M", years],
        ["N", major],
        ["R", jpHours],
      ];
    },
  });

  fillTableRows(ws, valMap.get("workHistory"), {
    rows: [20, 21, 22, 23],
    extract: (parts) => {
      const [yearRange, company, industry, place, salary, years] = parts;
      const [startY, endY] = (yearRange ?? "").split(/[-–—]/).map((s) => s.trim());
      return [
        ["B", startY], ["G", endY],
        ["J", company],
        ["M", years],
        ["N", industry],
        ["Q", place],
        ["T", salary],
      ];
    },
  });

  fillTableRows(ws, valMap.get("familyMembers"), {
    rows: [30, 31, 32, 33, 34, 35, 36],
    extract: (parts) => {
      const [relation, name, age, place, job, income] = parts;
      return [
        ["B", relation], ["D", name], ["L", age],
        ["N", place], ["Q", job], ["T", income],
      ];
    },
  });

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

function fillTableRows(
  ws: ExcelJS.Worksheet,
  raw: string | undefined,
  opts: { rows: number[]; extract: (cells: string[]) => Array<[string, string | undefined]> },
): void {
  if (!raw) return;
  const lines = raw.split(/<br\s*\/?>|\n/).map((s) => s.trim()).filter(Boolean);
  lines.slice(0, opts.rows.length).forEach((line, idx) => {
    const cells = line.split("|").map((c) => c.trim());
    const rowNum = opts.rows[idx];
    for (const [col, val] of opts.extract(cells)) {
      if (val && val.trim() !== "") {
        ws.getCell(`${col}${rowNum}`).value = val.trim();
      }
    }
  });
}

/** Fallback khi template thiếu: tạo workbook 3 cột đơn giản (cũ). */
async function buildExcelFallback(form: FormDoc, submission: SubmissionDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "xHR-bot";
  wb.created = new Date();

  const ws = wb.addWorksheet("Đăng ký");
  ws.columns = [
    { header: "STT", width: 6 },
    { header: "Mục", width: 40 },
    { header: "Giá trị", width: 60 },
  ];
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

  ws.insertRow(1, [form.title]);
  ws.mergeCells("A1:C1");
  const titleRow = ws.getRow(1);
  titleRow.font = { bold: true, size: 14 };
  titleRow.alignment = { horizontal: "center" };

  ws.insertRow(2, [`Nộp lúc: ${new Date(submission.createdAt).toLocaleString("vi-VN")}`]);
  ws.mergeCells("A2:C2");
  ws.getRow(2).alignment = { horizontal: "center" };

  const fieldMap = new Map(form.fields.filter((f) => f.name).map((f) => [f.name!, f] as const));
  let stt = 1;
  for (const sd of submission.submissionData) {
    const f = fieldMap.get(sd.field);
    ws.addRow([stt++, labelOf(f, sd.field), valueOf(f, sd.value)]);
  }

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

function buildTextSummary(
  form: FormDoc,
  submission: SubmissionDoc,
  args: NotifyArgs,
  suggestedOrders: SuggestedOrder[],
): string {
  const portalUrl = process.env.PORTAL_URL ?? "https://x-hr.portal.x-or.cloud";
  const lines: string[] = [];
  lines.push(`📥 **NLĐ đã nộp form: ${form.title}**`);
  lines.push("");
  if (args.fullName) lines.push(`👤 **Họ tên:** ${args.fullName}`);
  if (args.phone) lines.push(`📞 **SĐT:** ${args.phone}`);
  lines.push(`⏰ **Thời điểm:** ${new Date(submission.createdAt).toLocaleString("vi-VN")}`);

  // Một số field quan trọng inline (không dump hết — Excel có đủ)
  const fieldMap = new Map(form.fields.filter((f) => f.name).map((f) => [f.name!, f] as const));
  const highlightFields = ["dateOfBirth", "idNumber", "address", "highestDegree", "japanReason"];
  const highlights: string[] = [];
  for (const fname of highlightFields) {
    const sd = submission.submissionData.find((x) => x.field === fname);
    if (sd?.value) {
      const f = fieldMap.get(fname);
      highlights.push(`• ${labelOf(f, fname)}: ${valueOf(f, sd.value)}`);
    }
  }
  if (highlights.length > 0) {
    lines.push("");
    lines.push("**📌 Highlight:**");
    lines.push(...highlights);
  }

  // Suggested orders cho LĐ — chọn 3 đơn đang tuyển W1-W4 (chưa khoá tuyển)
  if (suggestedOrders.length > 0) {
    lines.push("");
    lines.push("**💼 Đơn đang tuyển — gợi ý cho LĐ:**");
    for (const o of suggestedOrders) {
      lines.push(`• ${o.orderCode ?? "?"} — ${o.employer ?? "(không rõ employer)"} · ${o.position ?? "(không rõ vị trí)"} · cần ${o.quantityNeeded ?? "?"} LĐ`);
    }
  }

  // Portal links
  lines.push("");
  if (args.workerId) {
    lines.push(`🔗 **Hồ sơ LĐ:** ${portalUrl}/workers/${args.workerId}`);
  }
  lines.push(`📦 **Đơn đang tuyển:** ${portalUrl}/orders`);
  lines.push("");
  lines.push(`📎 File Excel đầy đủ đính kèm bên dưới. Sau khi review, nhắn em "LĐ X đồng ý đơn Y" để chuyển sang W2 Khám SK.`);
  return lines.join("\n");
}

interface SuggestedOrder {
  id: string;
  orderCode?: string;
  employer?: string;
  position?: string;
  quantityNeeded?: number;
  market?: string;
}

async function suggestOrders(workerMarket: string = "jp"): Promise<SuggestedOrder[]> {
  try {
    const r = await payload.request<{ docs: SuggestedOrder[] }>(`/api/orders`, {
      query: {
        where: {
          and: [
            { market: { equals: workerMarket } },
            { status: { in: "w1,w2,w3,w4" } },
          ],
        },
        limit: 3,
        depth: 0,
        sort: "-orderDate",
      },
    });
    return r.docs ?? [];
  } catch (e) {
    logger.debug("FormNotify", `suggestOrders failed: ${e}`);
    return [];
  }
}

async function sendTelegram(opts: {
  chatId: string;
  threadId?: string;
  text: string;
  buffer: Buffer;
  filename: string;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("FormNotify", "TELEGRAM_BOT_TOKEN missing — skip notify");
    return;
  }
  const apiBase = `https://api.telegram.org/bot${token}`;

  // 1. Send text message (HTML parse mode)
  const html = opts.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const msgBody: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: html,
    parse_mode: "HTML",
  };
  if (opts.threadId) msgBody.message_thread_id = Number(opts.threadId);

  await fetch(`${apiBase}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msgBody),
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => logger.warn("FormNotify", `sendMessage: ${e}`));

  // 2. Send Excel document
  const form = new FormData();
  form.append("chat_id", opts.chatId);
  if (opts.threadId) form.append("message_thread_id", String(opts.threadId));
  form.append(
    "document",
    new Blob([new Uint8Array(opts.buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    opts.filename,
  );
  form.append("caption", "📎 File Excel dữ liệu đăng ký");

  await fetch(`${apiBase}/sendDocument`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  }).catch((e) => logger.warn("FormNotify", `sendDocument: ${e}`));
}

export async function handleFormSubmitted(args: NotifyArgs): Promise<void> {
  // 1. Load invite
  const invite = await payload.request<InviteDoc>(
    `/api/form-invites/${encodeURIComponent(args.inviteId)}`,
  );
  if (!invite.notifyChatId) {
    logger.info("FormNotify", `invite ${args.inviteId}: no notifyChatId — skip`);
    return;
  }

  // 2. Load form + submission
  const [form, submission] = await Promise.all([
    payload.request<FormDoc>(`/api/forms/${encodeURIComponent(args.formId)}`),
    payload.request<SubmissionDoc>(`/api/form-submissions/${encodeURIComponent(args.submissionId)}`),
  ]);

  // 3. Build text + Excel + lookup suggested orders
  const orders = await suggestOrders("jp");
  const text = buildTextSummary(form, submission, args, orders);
  const xlsx = await buildExcel(form, submission);

  // 4. Send
  const safeFullName = (args.fullName ?? args.workerName ?? "NLD").replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `Dang-ky-${safeFullName}-${args.submissionId.slice(-6)}.xlsx`;
  await sendTelegram({
    chatId: invite.notifyChatId,
    threadId: invite.notifyThreadId,
    text,
    buffer: xlsx,
    filename,
  });

  logger.info(
    "FormNotify",
    `Sent submission ${args.submissionId} → chat ${invite.notifyChatId}${invite.notifyThreadId ? "/" + invite.notifyThreadId : ""}`,
  );
}
