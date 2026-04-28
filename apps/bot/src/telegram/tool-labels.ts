/**
 * Map tool name + args → câu mô tả Tiếng Việt cụ thể cho user thấy
 * AI đang làm gì.
 *
 * Thứ tự match:
 *  1. Hàm custom theo tên tool (đọc args, sinh câu cụ thể)
 *  2. Pattern generic (list_*, get_*, create_*, update_*, delete_*)
 *  3. Fallback: tool name nguyên bản
 */

type ArgsBag = Record<string, unknown>;

const ENTITY_LABEL: Record<string, string> = {
  orders: "đơn tuyển",
  workers: "người lao động",
  "order-workers": "ứng viên × đơn",
  contracts: "hợp đồng",
  "workflow-stages": "bước workflow",
  forms: "form mẫu",
  "form-submissions": "submissions",
};

function entityLabel(slug: string): string {
  return ENTITY_LABEL[slug] ?? slug;
}

/** Lấy giá trị string đầu tiên từ args để chèn vào mô tả. */
function pickFilter(args: ArgsBag, keys: string[]): string | null {
  for (const k of keys) {
    const v = args[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Custom labels cho từng tool có context riêng (workflow, queries, forms). */
const CUSTOM: Record<string, (args: ArgsBag) => string> = {
  advance_order_status: (a) => {
    const id = a.orderId ?? "";
    const to = a.toStatus ?? "";
    return `📤 Chuyển đơn ${id} → ${to}`.trim();
  },
  order_progress_summary: (a) => {
    const code = a.orderCode ?? a.id ?? "";
    return code ? `📊 Xem tiến độ đơn ${code}` : "📊 Xem tiến độ đơn";
  },
  worker_summary: (a) => {
    const code = a.workerCode ?? a.id ?? "";
    return code ? `👤 Xem hồ sơ LĐ ${code}` : "👤 Xem hồ sơ lao động";
  },
  list_forms: () => "📋 Tìm form mẫu",
  get_form: (a) => `📋 Xem chi tiết form ${a.id ?? ""}`.trim(),
  submit_form: (a) => `✉️ Nộp form ${a.formId ?? ""}`.trim(),
  list_submissions: (a) =>
    a.formId ? `📜 Xem submissions của form ${a.formId}` : "📜 Xem submissions",
};

export function describeToolCall(rawName: string, args: ArgsBag = {}): string {
  // Strip MCP prefix nếu có (mcp__skillbot__list_orders → list_orders)
  const name = rawName.replace(/^mcp__\w+__/, "");

  const custom = CUSTOM[name];
  if (custom) return custom(args);

  // Generic CRUD patterns
  const m = name.match(/^(list|get|create|update|delete)_(.+)$/);
  if (m) {
    const verb = m[1];
    const slug = m[2];
    const label = entityLabel(slug);

    switch (verb) {
      case "list": {
        const filter = pickFilter(args, [
          "status",
          "fullName",
          "employer",
          "position",
          "market",
          "workerCode",
          "orderCode",
          "phone",
          "code",
        ]);
        return filter
          ? `🔍 Tìm ${label} (${filter})`
          : `🔍 Liệt kê ${label}`;
      }
      case "get":
        return `📄 Xem chi tiết ${label}${args.id ? ` #${args.id}` : ""}`;
      case "create": {
        const title = pickFilter(args, [
          "fullName",
          "orderCode",
          "contractCode",
          "employer",
          "name",
        ]);
        return title
          ? `✏️ Tạo ${label} "${title}"`
          : `✏️ Tạo ${label} mới`;
      }
      case "update":
        return `📝 Cập nhật ${label}${args.id ? ` #${args.id}` : ""}`;
      case "delete":
        return `🗑 Xoá ${label}${args.id ? ` #${args.id}` : ""}`;
    }
  }

  return `🔧 ${name}`;
}
