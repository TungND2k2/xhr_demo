import type { GlobalConfig } from "payload";

/**
 * EmailSettings — cấu hình SMTP để bot gửi email.
 *
 * Global (singleton): 1 record duy nhất, edit qua portal `/admin/globals/email-settings`.
 * Bot fetch config qua `/api/globals/email-settings` mỗi lần gửi (có cache nhẹ).
 *
 * Khi field rỗng → bot fallback dùng env (SMTP_HOST/SMTP_USER...) để giữ
 * backward compat. Khi field có giá trị → ưu tiên dùng giá trị này.
 *
 * App password (Gmail): bật 2FA → tạo App Password tại
 * https://myaccount.google.com/apppasswords → dán vào field `pass` (bỏ khoảng trắng).
 */
export const EmailSettings: GlobalConfig = {
  slug: "email-settings",
  label: "Cấu hình Email",
  admin: {
    group: "Hệ thống",
    description:
      "Cấu hình SMTP để bot gửi email cho lãnh đạo. Hỗ trợ Gmail (App Password), Google Workspace, hoặc bất kỳ SMTP server nào.",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "enabled",
      label: "Bật tính năng gửi email",
      type: "checkbox",
      defaultValue: false,
      admin: {
        description: "Tắt = bot không gửi email (tool send_email báo lỗi).",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "host",
          label: "SMTP Host",
          type: "text",
          required: true,
          defaultValue: "smtp.gmail.com",
          admin: { width: "60%", placeholder: "smtp.gmail.com / smtp.office365.com" },
        },
        {
          name: "port",
          label: "Port",
          type: "number",
          required: true,
          defaultValue: 587,
          admin: { width: "20%", description: "587 (TLS) hoặc 465 (SSL)" },
        },
        {
          name: "secure",
          label: "SSL (port 465)",
          type: "checkbox",
          defaultValue: false,
          admin: { width: "20%", description: "Tick nếu dùng 465" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "user",
          label: "Tài khoản (email login)",
          type: "text",
          required: true,
          admin: { width: "50%", placeholder: "admindev67@gmail.com" },
        },
        {
          name: "pass",
          label: "App Password (Gmail) hoặc password SMTP",
          type: "text",
          required: true,
          admin: {
            width: "50%",
            placeholder: "16 ký tự (Gmail App Password)",
            description:
              "Gmail: tạo App Password tại myaccount.google.com/apppasswords (cần bật 2FA trước).",
          },
        },
      ],
    },
    {
      name: "from",
      label: "Display From",
      type: "text",
      admin: {
        placeholder: 'vd: "xHR Bot <bot.tlg@gmail.com>"',
        description:
          "Tên + email hiển thị ở phần From của email. Có thể trùng hoặc khác user — Gmail thường ép = user.",
      },
    },
    {
      name: "allowedRecipients",
      label: "Whitelist địa chỉ nhận",
      type: "array",
      labels: { singular: "Địa chỉ", plural: "Địa chỉ" },
      admin: {
        description:
          "Danh sách email được phép nhận. Để trống = bot có thể gửi tới mọi email (KHÔNG khuyến nghị — rủi ro AI gửi nhầm).",
      },
      fields: [
        {
          name: "email",
          label: "Email",
          type: "text",
          required: true,
          admin: { placeholder: "huong@tlg.vn" },
        },
        {
          name: "note",
          label: "Ghi chú",
          type: "text",
          admin: { placeholder: "vd: c.Hương HCNS" },
        },
      ],
    },
  ],
};
