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

// Tools registry — cập nhật khi thêm tool mới. Admin chọn từ list này.
const TOOL_OPTIONS = [
  // Workers CRUD
  { label: "list_workers", value: "list_workers" },
  { label: "get_workers", value: "get_workers" },
  { label: "create_workers", value: "create_workers" },
  { label: "update_workers", value: "update_workers" },
  { label: "delete_workers", value: "delete_workers" },
  // Orders CRUD
  { label: "list_orders", value: "list_orders" },
  { label: "get_orders", value: "get_orders" },
  { label: "create_orders", value: "create_orders" },
  { label: "update_orders", value: "update_orders" },
  { label: "delete_orders", value: "delete_orders" },
  // OrderWorkers
  { label: "list_order-workers", value: "list_order-workers" },
  { label: "get_order-workers", value: "get_order-workers" },
  { label: "create_order-workers", value: "create_order-workers" },
  { label: "update_order-workers", value: "update_order-workers" },
  { label: "delete_order-workers", value: "delete_order-workers" },
  // Contracts
  { label: "list_contracts", value: "list_contracts" },
  { label: "get_contracts", value: "get_contracts" },
  { label: "create_contracts", value: "create_contracts" },
  { label: "update_contracts", value: "update_contracts" },
  { label: "delete_contracts", value: "delete_contracts" },
  // Workflow stages
  { label: "list_workflow-stages", value: "list_workflow-stages" },
  { label: "get_workflow-stages", value: "get_workflow-stages" },
  { label: "create_workflow-stages", value: "create_workflow-stages" },
  { label: "update_workflow-stages", value: "update_workflow-stages" },
  // Custom workflow
  { label: "advance_order_status", value: "advance_order_status" },
  { label: "order_progress_summary", value: "order_progress_summary" },
  { label: "worker_summary", value: "worker_summary" },
  // Forms
  { label: "list_forms", value: "list_forms" },
  { label: "get_form", value: "get_form" },
  { label: "submit_form", value: "submit_form" },
  { label: "list_form_submissions", value: "list_form_submissions" },
  { label: "get_form_submission", value: "get_form_submission" },
  // Media
  { label: "search_media", value: "search_media" },
  { label: "get_media_content", value: "get_media_content" },
  { label: "redescribe_media", value: "redescribe_media" },
  // Reminders
  { label: "create_reminder", value: "create_reminder" },
  { label: "list_reminders", value: "list_reminders" },
  { label: "update_reminder", value: "update_reminder" },
  { label: "snooze_reminder", value: "snooze_reminder" },
  { label: "dismiss_reminder", value: "dismiss_reminder" },
  // Users
  { label: "list_users", value: "list_users" },
  { label: "get_user", value: "get_user" },
  // Telegram identity
  { label: "lookup_telegram_user", value: "lookup_telegram_user" },
  { label: "list_telegram_groups", value: "list_telegram_groups" },
  { label: "list_group_members", value: "list_group_members" },
  // Export
  { label: "create_export_file", value: "create_export_file" },
  { label: "create_xlsx_file", value: "create_xlsx_file" },
];

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
      type: "select",
      hasMany: true,
      options: TOOL_OPTIONS,
      admin: {
        description:
          "Chọn các tool agent này được phép dùng. Giữ tối thiểu (5-10) để agent focus + chạy nhanh.",
      },
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
