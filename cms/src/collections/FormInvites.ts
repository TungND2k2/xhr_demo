import type { CollectionConfig } from "payload";
import crypto from "node:crypto";

/**
 * FormInvites — link 1-lần dùng cho NLĐ điền form (vd Sơ yếu lý lịch).
 *
 * Flow:
 *   1. Recruiter chat Telegram "Tạo link form cho NLĐ Nguyễn Văn A"
 *   2. Bot tool `generate_form_link` → tạo invite record + token + URL
 *   3. NLĐ click link → page `/forms/<token>` → điền form → submit
 *   4. Submit handler:
 *      - Tạo FormSubmission (plugin)
 *      - Update FormInvite.status = "submitted" + linkedSubmission
 *      - Tạo/update Worker từ data → set worker
 *      - Notify Telegram bot (W1 topic) — call internal HTTP
 *
 * Token: 24 ký tự URL-safe (random hex). Unique index.
 */
export const FormInvites: CollectionConfig = {
  slug: "form-invites",
  labels: { singular: "Link form", plural: "Link form" },
  admin: {
    group: "Form & Quy trình",
    useAsTitle: "token",
    defaultColumns: ["token", "form", "worker", "status", "expiresAt", "createdAt"],
    description:
      "Mỗi NLĐ nhận 1 token unique để điền form đăng ký. Bot Telegram tự tạo.",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    // Public submit qua API endpoint riêng, KHÔNG dùng access này.
    create: ({ req: { user } }) =>
      ["admin", "manager", "recruiter"].includes(user?.role ?? ""),
    update: ({ req: { user } }) =>
      ["admin", "manager", "recruiter"].includes(user?.role ?? ""),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === "create" && !data.token) {
          data.token = crypto.randomBytes(16).toString("hex"); // 32 hex chars
        }
        if (operation === "create" && !data.expiresAt) {
          // Default expire 7 ngày
          data.expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();
        }
        return data;
      },
    ],
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "token",
          label: "Token",
          type: "text",
          required: true,
          unique: true,
          index: true,
          admin: {
            width: "60%",
            readOnly: true,
            description: "Random URL-safe, auto-generated khi create.",
          },
        },
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          required: true,
          defaultValue: "pending",
          options: [
            { label: "⏳ Chờ điền", value: "pending" },
            { label: "👀 Đã mở link", value: "opened" },
            { label: "✅ Đã nộp", value: "submitted" },
            { label: "❌ Hết hạn", value: "expired" },
            { label: "🚫 Đã thu hồi", value: "revoked" },
          ],
          admin: { width: "40%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "form",
          label: "Form template",
          type: "relationship",
          relationTo: "forms",
          required: true,
          admin: { width: "50%" },
        },
        {
          name: "expiresAt",
          label: "Hết hạn",
          type: "date",
          required: true,
          admin: {
            width: "50%",
            date: { pickerAppearance: "dayAndTime" },
            description: "Default 7 ngày sau khi tạo.",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "worker",
          label: "Worker (LĐ) đã link",
          type: "relationship",
          relationTo: "workers",
          admin: {
            width: "50%",
            description: "Trống = chưa có Worker, sẽ tạo mới khi NLĐ submit.",
          },
        },
        {
          name: "submission",
          label: "Form submission",
          type: "relationship",
          relationTo: "form-submissions",
          admin: {
            width: "50%",
            readOnly: true,
            description: "Tự link khi NLĐ submit thành công.",
          },
        },
      ],
    },
    {
      name: "prefillData",
      label: "Pre-fill (tuỳ chọn)",
      type: "array",
      labels: { singular: "Field", plural: "Fields" },
      admin: {
        description:
          "Điền sẵn 1 số field (vd họ tên, SĐT đã biết) — NLĐ chỉ cần kiểm tra + điền phần còn lại.",
      },
      fields: [
        {
          type: "row",
          fields: [
            { name: "field", label: "Field name", type: "text", required: true, admin: { width: "40%" } },
            { name: "value", label: "Giá trị", type: "text", required: true, admin: { width: "60%" } },
          ],
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "createdByTelegram",
          label: "Người tạo (Telegram User ID)",
          type: "text",
          admin: { width: "33%", readOnly: true },
        },
        {
          name: "notifyChatId",
          label: "Chat Telegram để notify",
          type: "text",
          admin: { width: "33%", readOnly: true, description: "Bot bắn vào đây khi NLĐ submit" },
        },
        {
          name: "notifyThreadId",
          label: "Topic ID notify",
          type: "text",
          admin: { width: "34%", readOnly: true, description: "message_thread_id" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "openedAt",
          label: "Đã mở lúc",
          type: "date",
          admin: { width: "50%", readOnly: true, date: { pickerAppearance: "dayAndTime" } },
        },
        {
          name: "submittedAt",
          label: "Đã nộp lúc",
          type: "date",
          admin: { width: "50%", readOnly: true, date: { pickerAppearance: "dayAndTime" } },
        },
      ],
    },
    {
      name: "notes",
      label: "Ghi chú",
      type: "textarea",
      admin: { rows: 3 },
    },
  ],
};
