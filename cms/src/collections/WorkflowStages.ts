import type { CollectionConfig } from "payload";

/**
 * WorkflowStages — định nghĩa 6 bước workflow đơn hàng may thêu xuất khẩu.
 *
 * Đây là **metadata** (cấu hình), không phải instance — mỗi `Orders.status`
 * tham chiếu vào `code` ở đây để biết: thời gian dự kiến, ai phụ trách,
 * ai duyệt, output cần có, lúc nào nhắc.
 *
 * AI đọc qua Payload REST → biết "đơn này đang ở B3, theo cấu hình B3 mất
 * 7 ngày, đã quá hạn 2 ngày → nhắc". Cron worker (apps/bot) dùng dữ liệu
 * này để scan + notify.
 *
 * Admin/manager edit được — kéo dài hạn thêu, đổi người phụ trách, etc.
 */
export const WorkflowStages: CollectionConfig = {
  slug: "workflow-stages",
  labels: { singular: "Bước workflow", plural: "Workflow đơn hàng" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["order", "code", "name", "durationDays", "responsibleRole"],
    group: "Hệ thống",
  },
  defaultSort: "order",
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => ["admin", "manager"].includes(user?.role ?? ""),
    update: ({ req: { user } }) => ["admin", "manager"].includes(user?.role ?? ""),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "workflow",
      label: "Thuộc workflow",
      type: "relationship",
      relationTo: "workflows",
      required: true,
      admin: { description: "Bước này thuộc quy trình nào" },
    },
    {
      type: "row",
      fields: [
        {
          name: "order",
          label: "Thứ tự",
          type: "number",
          required: true,
          min: 1,
          admin: { width: "20%", description: "1, 2, 3, ... (unique trong cùng workflow)" },
        },
        {
          name: "code",
          label: "Mã bước",
          type: "select",
          required: true,
          options: [
            { label: "W1 — Tuyển dụng", value: "w1" },
            { label: "W2 — Khám sức khoẻ", value: "w2" },
            { label: "W3 — Đào tạo", value: "w3" },
            { label: "W4 — Phỏng vấn đối tác", value: "w4" },
            { label: "W5 — Ký hợp đồng", value: "w5" },
            { label: "W6 — Xin visa", value: "w6" },
            { label: "W7 — Xuất cảnh", value: "w7" },
            { label: "W8 — Quản lý sau xuất cảnh", value: "w8" },
            { label: "✅ Hoàn thành", value: "done" },
          ],
          admin: { width: "30%" },
        },
        {
          name: "name",
          label: "Tên bước",
          type: "text",
          required: true,
          admin: { width: "50%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "durationDays",
          label: "Thời gian dự kiến (ngày)",
          type: "number",
          min: 0,
          admin: { width: "33%", description: "Nếu là khoảng (15-20), nhập số trên" },
        },
        {
          name: "minDurationDays",
          label: "Tối thiểu (ngày)",
          type: "number",
          min: 0,
          admin: { width: "33%" },
        },
        {
          name: "maxDurationDays",
          label: "Tối đa (ngày)",
          type: "number",
          min: 0,
          admin: { width: "33%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "responsibleRole",
          label: "Người phụ trách",
          type: "select",
          required: true,
          options: [
            { label: "👑 Admin", value: "admin" },
            { label: "📋 Manager", value: "manager" },
            { label: "🧑‍💼 Recruiter / Tuyển dụng", value: "recruiter" },
            { label: "🎓 Trainer / Giảng viên", value: "trainer" },
            { label: "🛂 Visa specialist", value: "visa_specialist" },
            { label: "💰 Accountant / Kế toán", value: "accountant" },
            { label: "🏥 Y tế / Cơ sở khám", value: "medical" },
          ],
          admin: { width: "50%" },
        },
        {
          name: "approverRoles",
          label: "Người duyệt",
          type: "select",
          hasMany: true,
          options: [
            { label: "Admin", value: "admin" },
            { label: "Manager", value: "manager" },
            { label: "Accountant", value: "accountant" },
            { label: "Visa specialist", value: "visa_specialist" },
          ],
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "description",
      label: "Mô tả công việc",
      type: "textarea",
      admin: { rows: 4, description: "Hướng dẫn chi tiết, AI sẽ đọc để tham khảo" },
    },
    {
      name: "deliverables",
      label: "Output / Bàn giao",
      type: "array",
      fields: [{ name: "item", type: "text", required: true }],
      admin: { description: "Những thứ phải có khi kết thúc bước" },
    },
    {
      name: "qualityChecks",
      label: "Kiểm tra chất lượng",
      type: "array",
      fields: [{ name: "check", type: "text", required: true }],
    },
    {
      name: "reminders",
      label: "Lịch nhắc",
      type: "array",
      admin: { description: "Cron sẽ gửi Telegram theo các mốc này" },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "atDay",
              label: "Sau N ngày kể từ start bước",
              type: "number",
              required: true,
              admin: { width: "30%" },
            },
            {
              name: "recipients",
              label: "Gửi cho",
              type: "select",
              hasMany: true,
              required: true,
              options: [
                { label: "Recruiter phụ trách đơn", value: "recruiter" },
                { label: "Manager", value: "manager" },
                { label: "Admin", value: "admin" },
                { label: "Người phụ trách bước", value: "responsible" },
                { label: "Trainer", value: "trainer" },
                { label: "Visa specialist", value: "visa_specialist" },
                { label: "Accountant", value: "accountant" },
                { label: "Y tế", value: "medical" },
              ],
              admin: { width: "30%" },
            },
            {
              name: "kind",
              label: "Loại",
              type: "select",
              required: true,
              defaultValue: "checkin",
              options: [
                { label: "📅 Check-in (đến hạn cập nhật)", value: "checkin" },
                { label: "⚠️ Cảnh báo trễ", value: "overdue" },
                { label: "🚨 Trễ nghiêm trọng", value: "critical" },
              ],
              admin: { width: "40%" },
            },
          ],
        },
        {
          name: "message",
          label: "Nội dung nhắc",
          type: "textarea",
          required: true,
          admin: { description: "Hỗ trợ {orderCode}, {customer}, {daysSinceStart}, {daysOverdue}" },
        },
      ],
    },
    {
      name: "isActive",
      label: "Đang dùng",
      type: "checkbox",
      defaultValue: true,
    },
  ],
  timestamps: true,
};
