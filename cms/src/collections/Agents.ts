import type { CollectionConfig } from "payload";

/**
 * Agents — trợ lý AI chuyên trách 1 mảng nghiệp vụ.
 *
 * Mỗi agent là 1 record trong DB, admin tự tạo/sửa qua portal — không cần
 * dev code. Engine pipeline load `docs` + `enabledTools` lúc runtime để
 * dựng system prompt + filter MCP tools cho từng request.
 *
 * Một agent có thể được gán cho nhiều topic (reuse): vd `recruitment_agent`
 * serve topic "Tuyển dụng" trong cả Phòng Nhật, Phòng Hàn, Phòng Đài.
 *
 * `enabledTools` là array tên tool (không có prefix `mcp__skillbot__`).
 * Pipeline match với registry và chỉ expose subset cho Claude.
 *
 * `docs` là markdown — admin viết kiểu "training nhân viên mới":
 *   - Vai trò
 *   - Quy trình nghiệp vụ
 *   - Quy tắc bắt buộc
 *   - Hand-off (khi nào chuyển agent khác)
 *   - Ví dụ hội thoại
 * Engine ghép docs này sau base prompt (time + chatter + tool format).
 */

// Tool definitions theo nhóm — render thành checkbox riêng cho từng tool
// trong admin (Payload checkbox field), admin tick/un-tick từng cái rõ ràng.
// Pipeline flatten checkboxes có giá trị true thành single string[] khi
// filter MCP tools.
//
// Tool name DB-friendly: dùng `_` thay `-` vì Payload field name không chấp
// nhận dấu trừ. Convert tại flatten step (vd "list_order_workers" → "list_order-workers").

type ToolDef = { name: string; label: string; toolName?: string };

const cb = (name: string, label: string, toolName?: string): ToolDef => ({
  name,
  label,
  toolName,
});

const WORKER_TOOLS: ToolDef[] = [
  cb("list_workers", "📋 Liệt kê LĐ"),
  cb("get_workers", "🔍 Xem chi tiết 1 LĐ"),
  cb("create_workers", "➕ Tạo hồ sơ LĐ mới"),
  cb("update_workers", "✏️ Cập nhật LĐ"),
  cb("delete_workers", "🗑 Xoá LĐ"),
  cb("worker_summary", "📊 Tóm tắt LĐ"),
];
const ORDER_TOOLS: ToolDef[] = [
  cb("list_orders", "📋 Liệt kê đơn"),
  cb("get_orders", "🔍 Xem chi tiết 1 đơn"),
  cb("create_orders", "➕ Tạo đơn mới"),
  cb("update_orders", "✏️ Cập nhật đơn"),
  cb("delete_orders", "🗑 Xoá đơn"),
  cb("advance_order_status", "➡️ Chuyển bước W1→W8"),
  cb("order_progress_summary", "📊 Tóm tắt tiến độ đơn"),
];
const ORDER_WORKER_TOOLS: ToolDef[] = [
  cb("list_order_workers", "📋 Liệt kê đăng ký LĐ-đơn", "list_order-workers"),
  cb("get_order_workers", "🔍 Xem 1 đăng ký", "get_order-workers"),
  cb("create_order_workers", "➕ Đăng ký LĐ vào đơn", "create_order-workers"),
  cb("update_order_workers", "✏️ Cập nhật đăng ký", "update_order-workers"),
  cb("delete_order_workers", "🗑 Xoá đăng ký", "delete_order-workers"),
];
const CONTRACT_TOOLS: ToolDef[] = [
  cb("list_contracts", "📋 Liệt kê HĐ"),
  cb("get_contracts", "🔍 Xem chi tiết HĐ"),
  cb("create_contracts", "➕ Tạo HĐ mới"),
  cb("update_contracts", "✏️ Cập nhật HĐ"),
  cb("delete_contracts", "🗑 Xoá HĐ"),
];
const WORKFLOW_STAGE_TOOLS: ToolDef[] = [
  cb("list_workflow_stages", "📋 Liệt kê stages", "list_workflow-stages"),
  cb("get_workflow_stages", "🔍 Xem 1 stage", "get_workflow-stages"),
  cb("create_workflow_stages", "➕ Tạo stage mới", "create_workflow-stages"),
  cb("update_workflow_stages", "✏️ Sửa stage", "update_workflow-stages"),
];
const FORM_TOOLS: ToolDef[] = [
  cb("list_forms", "📋 Liệt kê form"),
  cb("get_form", "🔍 Xem 1 form"),
  cb("submit_form", "📝 Nộp form"),
  cb("list_form_submissions", "📋 Liệt kê submission"),
  cb("get_form_submission", "🔍 Xem 1 submission"),
];
const MEDIA_TOOLS: ToolDef[] = [
  cb("search_media", "🔎 Tìm file đã upload"),
  cb("get_media_content", "📄 Đọc nội dung file"),
  cb("redescribe_media", "🔄 Sinh lại mô tả file"),
];
const REMINDER_TOOLS: ToolDef[] = [
  cb("create_reminder", "➕ Tạo lịch nhắc"),
  cb("list_reminders", "📋 Liệt kê lịch nhắc"),
  cb("update_reminder", "✏️ Cập nhật lịch nhắc"),
  cb("snooze_reminder", "⏸ Hoãn lịch nhắc"),
  cb("dismiss_reminder", "🚫 Huỷ lịch nhắc"),
];
const USER_TOOLS: ToolDef[] = [
  cb("list_users", "📋 Liệt kê nhân viên"),
  cb("get_user", "🔍 Xem 1 nhân viên"),
];
const TELEGRAM_IDENTITY_TOOLS: ToolDef[] = [
  cb("lookup_telegram_user", "🔎 Tra cứu user Telegram"),
  cb("list_telegram_groups", "📋 Liệt kê group"),
  cb("list_group_members", "📋 Liệt kê member group"),
];
const EXPORT_TOOLS: ToolDef[] = [
  cb("create_export_file", "📄 Xuất CSV/MD/JSON/TXT"),
  cb("create_xlsx_file", "📊 Xuất Excel xlsx"),
];
const CALENDAR_TOOLS: ToolDef[] = [
  cb("list_calendars", "📋 Liệt kê lịch"),
  cb("get_calendars", "🔍 Xem 1 sự kiện"),
  cb("create_calendars", "➕ Tạo sự kiện mới"),
  cb("update_calendars", "✏️ Cập nhật sự kiện"),
  cb("delete_calendars", "🗑 Xoá sự kiện"),
];
const ASSET_TOOLS: ToolDef[] = [
  cb("list_assets", "📋 Liệt kê tài sản"),
  cb("get_assets", "🔍 Xem 1 tài sản"),
  cb("create_assets", "➕ Tạo tài sản mới"),
  cb("update_assets", "✏️ Cập nhật tài sản"),
  cb("delete_assets", "🗑 Xoá tài sản"),
];
const EMAIL_TOOLS: ToolDef[] = [cb("send_email", "✉️ Gửi email")];

// Build group field từ tool list — mỗi tool thành 1 checkbox field
function toolGroup(name: string, label: string, tools: ToolDef[], description?: string) {
  return {
    name,
    label,
    type: "group" as const,
    admin: description ? { description } : undefined,
    fields: tools.map((t) => ({
      name: t.name,
      label: t.label,
      type: "checkbox" as const,
      defaultValue: false,
    })),
  };
}

export const Agents: CollectionConfig = {
  slug: "agents",
  labels: { singular: "Trợ lý AI", plural: "Trợ lý AI" },
  admin: {
    group: "Multi-Agent",
    useAsTitle: "displayName",
    defaultColumns: ["name", "displayName", "active", "updatedAt"],
    description:
      "Mỗi agent là 1 trợ lý chuyên trách. Tạo agent + viết docs + chọn tools, sau đó map với topic Telegram ở mục TelegramTopics.",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => ["admin", "manager"].includes(user?.role ?? ""),
    update: ({ req: { user } }) => ["admin", "manager"].includes(user?.role ?? ""),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          label: "Tên hệ thống",
          type: "text",
          required: true,
          unique: true,
          index: true,
          admin: {
            width: "50%",
            description:
              "Định danh dạng snake_case, vd: recruitment_agent. Không đổi sau khi tạo (đã được map với topic).",
          },
        },
        {
          name: "displayName",
          label: "Tên hiển thị",
          type: "text",
          required: true,
          admin: {
            width: "50%",
            description: 'Tên thân thiện, vd "🧑‍💼 Trợ lý Tuyển dụng".',
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "active",
          label: "Đang hoạt động",
          type: "checkbox",
          defaultValue: true,
          admin: {
            width: "30%",
            description: "Tắt sẽ khiến topic mapped với agent này không phản hồi.",
          },
        },
        {
          name: "shortDescription",
          label: "Mô tả ngắn",
          type: "text",
          admin: {
            width: "70%",
            placeholder: "vd: Phụ trách tạo hồ sơ LĐ và quản lý trạng thái sàng lọc.",
          },
        },
      ],
    },
    {
      name: "enabledTools",
      label: "Tools được phép gọi",
      type: "group",
      admin: {
        description:
          "Tick từng tool agent này được phép dùng. Mỗi nhóm là 1 module nghiệp vụ. Giữ tối thiểu — chỉ tick những tool agent thực sự cần.",
      },
      fields: [
        toolGroup("workers", "👥 Người lao động (Workers)", WORKER_TOOLS, "Quản lý hồ sơ LĐ"),
        toolGroup("orders", "📦 Đơn tuyển (Orders)", ORDER_TOOLS, "Quản lý đơn + workflow W1-W8"),
        toolGroup(
          "orderWorkers",
          "🔗 Đăng ký LĐ vào đơn",
          ORDER_WORKER_TOOLS,
          "M2M worker × order",
        ),
        toolGroup("contracts", "📜 Hợp đồng (Contracts)", CONTRACT_TOOLS),
        toolGroup(
          "workflowStages",
          "⚙️ Cấu hình workflow stages",
          WORKFLOW_STAGE_TOOLS,
        ),
        toolGroup("forms", "📋 Form template", FORM_TOOLS),
        toolGroup(
          "media",
          "📁 Kho tệp tin (Media)",
          MEDIA_TOOLS,
          "Tìm file + đọc nội dung",
        ),
        toolGroup("reminders", "🔔 Nhắc nhở (Reminders)", REMINDER_TOOLS),
        toolGroup("users", "🧑‍💼 Người dùng hệ thống", USER_TOOLS),
        toolGroup(
          "telegramIdentity",
          "💬 Telegram identity",
          TELEGRAM_IDENTITY_TOOLS,
          "Map @username ↔ telegramUserId",
        ),
        toolGroup(
          "exports",
          "📊 Xuất file (Export)",
          EXPORT_TOOLS,
          "Excel / CSV / Markdown / JSON",
        ),
        toolGroup(
          "calendars",
          "📅 Lịch (Calendars)",
          CALENDAR_TOOLS,
          "Lịch họp, hẹn, sự kiện",
        ),
        toolGroup(
          "assets",
          "🏢 Tài sản (Assets)",
          ASSET_TOOLS,
          "Laptop, xe, máy may, văn phòng phẩm...",
        ),
        toolGroup(
          "email",
          "✉️ Email",
          EMAIL_TOOLS,
          "Gửi email cho lãnh đạo. Cần SMTP config trên server.",
        ),
      ],
    },
    {
      name: "docs",
      label: "Docs (markdown)",
      type: "textarea",
      required: true,
      admin: {
        rows: 25,
        description:
          "Vai trò + Phạm vi + Quy trình nghiệp vụ + Rules + Hand-off + Ví dụ. Viết tiếng Việt tự nhiên kiểu training nhân viên mới. Engine sẽ ghép vào sau base prompt khi runtime.",
      },
      defaultValue: `# Trợ lý [Tên]

## Vai trò
[1-2 câu mô tả trợ lý làm gì]

## Phạm vi
- Việc xử lý:
- Việc KHÔNG xử lý (chuyển agent khác):

## Cách giao tiếp
- Lịch sự, gọi "anh/chị"
- Trả lời ngắn gọn
- Trước khi tạo/sửa data quan trọng → xác nhận với user

## Quy trình nghiệp vụ

### Use case 1: [Tên]
1. Bước 1:
2. Bước 2:

## Quy tắc bắt buộc
- KHÔNG ...
- LUÔN ...

## Hand-off — khi nào chuyển agent khác
- Khi status='X' → notify agent Y trong topic Z

## Ví dụ hội thoại
👤 "..."
🤖 "..."
`,
    },
    {
      type: "collapsible",
      label: "Hand-off rules (tuỳ chọn)",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "handoffRules",
          label: "Quy tắc chuyển giao",
          type: "array",
          labels: { singular: "Rule", plural: "Rules" },
          admin: {
            description:
              "Khi điều kiện xảy ra, agent này tự post notification vào topic kế + tag người. Để trống nếu không có hand-off cứng (agent docs tự xử lý linh hoạt).",
          },
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "trigger",
                  label: "Trigger",
                  type: "text",
                  required: true,
                  admin: {
                    width: "40%",
                    placeholder: 'vd: status="đặt cọc"',
                  },
                },
                {
                  name: "targetAgent",
                  label: "Chuyển sang agent",
                  type: "relationship",
                  relationTo: "agents",
                  admin: { width: "30%" },
                },
                {
                  name: "notifyTemplate",
                  label: "Mẫu thông báo",
                  type: "text",
                  admin: {
                    width: "30%",
                    placeholder: "vd: LĐ {workerCode} sẵn sàng vào lớp N4",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
