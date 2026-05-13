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

// Tools registry chia theo nhóm — admin tick từng nhóm dễ hơn so với 1
// dropdown 45 items. Pipeline flatten lại thành single list khi filter.

const opt = (name: string) => ({ label: name, value: name });

const WORKER_TOOLS = [
  opt("list_workers"),
  opt("get_workers"),
  opt("create_workers"),
  opt("update_workers"),
  opt("delete_workers"),
  opt("worker_summary"),
];
const ORDER_TOOLS = [
  opt("list_orders"),
  opt("get_orders"),
  opt("create_orders"),
  opt("update_orders"),
  opt("delete_orders"),
  opt("advance_order_status"),
  opt("order_progress_summary"),
];
const ORDER_WORKER_TOOLS = [
  opt("list_order-workers"),
  opt("get_order-workers"),
  opt("create_order-workers"),
  opt("update_order-workers"),
  opt("delete_order-workers"),
];
const CONTRACT_TOOLS = [
  opt("list_contracts"),
  opt("get_contracts"),
  opt("create_contracts"),
  opt("update_contracts"),
  opt("delete_contracts"),
];
const WORKFLOW_STAGE_TOOLS = [
  opt("list_workflow-stages"),
  opt("get_workflow-stages"),
  opt("create_workflow-stages"),
  opt("update_workflow-stages"),
];
const FORM_TOOLS = [
  opt("list_forms"),
  opt("get_form"),
  opt("submit_form"),
  opt("list_form_submissions"),
  opt("get_form_submission"),
];
const MEDIA_TOOLS = [
  opt("search_media"),
  opt("get_media_content"),
  opt("redescribe_media"),
];
const REMINDER_TOOLS = [
  opt("create_reminder"),
  opt("list_reminders"),
  opt("update_reminder"),
  opt("snooze_reminder"),
  opt("dismiss_reminder"),
];
const USER_TOOLS = [opt("list_users"), opt("get_user")];
const TELEGRAM_IDENTITY_TOOLS = [
  opt("lookup_telegram_user"),
  opt("list_telegram_groups"),
  opt("list_group_members"),
];
const EXPORT_TOOLS = [opt("create_export_file"), opt("create_xlsx_file")];

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
          "Chọn tools agent được phép dùng — chia theo nhóm cho dễ tick. Giữ tối thiểu (5-10 tool tổng) để agent focus + nhanh. Click vào ô dropdown của 1 nhóm để bật/tắt từng tool, hoặc tick hết để dùng cả nhóm.",
      },
      fields: [
        {
          name: "workers",
          label: "👥 Người lao động (Workers)",
          type: "select",
          hasMany: true,
          options: WORKER_TOOLS,
          admin: { description: "Quản lý hồ sơ LĐ" },
        },
        {
          name: "orders",
          label: "📦 Đơn tuyển (Orders)",
          type: "select",
          hasMany: true,
          options: ORDER_TOOLS,
          admin: { description: "Quản lý đơn từ đối tác + workflow W1-W8" },
        },
        {
          name: "orderWorkers",
          label: "🔗 Đăng ký LĐ vào đơn (Order-Workers)",
          type: "select",
          hasMany: true,
          options: ORDER_WORKER_TOOLS,
          admin: { description: "M2M giữa worker × order" },
        },
        {
          name: "contracts",
          label: "📜 Hợp đồng (Contracts)",
          type: "select",
          hasMany: true,
          options: CONTRACT_TOOLS,
        },
        {
          name: "workflowStages",
          label: "⚙️ Cấu hình workflow stages",
          type: "select",
          hasMany: true,
          options: WORKFLOW_STAGE_TOOLS,
        },
        {
          name: "forms",
          label: "📋 Form template",
          type: "select",
          hasMany: true,
          options: FORM_TOOLS,
        },
        {
          name: "media",
          label: "📁 Kho tệp tin (Media)",
          type: "select",
          hasMany: true,
          options: MEDIA_TOOLS,
          admin: { description: "Tìm file đã upload + đọc nội dung" },
        },
        {
          name: "reminders",
          label: "🔔 Nhắc nhở (Reminders)",
          type: "select",
          hasMany: true,
          options: REMINDER_TOOLS,
        },
        {
          name: "users",
          label: "🧑‍💼 Người dùng hệ thống (Users)",
          type: "select",
          hasMany: true,
          options: USER_TOOLS,
        },
        {
          name: "telegramIdentity",
          label: "💬 Telegram identity",
          type: "select",
          hasMany: true,
          options: TELEGRAM_IDENTITY_TOOLS,
          admin: { description: "Map @username ↔ telegramUserId" },
        },
        {
          name: "exports",
          label: "📊 Xuất file (Export)",
          type: "select",
          hasMany: true,
          options: EXPORT_TOOLS,
          admin: { description: "Excel / CSV / Markdown / JSON" },
        },
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
