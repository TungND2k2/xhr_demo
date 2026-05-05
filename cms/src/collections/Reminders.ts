import type { CollectionConfig } from "payload";

/**
 * Reminders — lịch nhắc nhở do user (CEO/quản lý) tự đặt.
 *
 * Khác `Order.remindersSent` (auto theo workflow stage), collection này là
 * lịch tự do: "nhắc tôi gọi đối tác Toyota 9h thứ 6", "nhắc team tuyển dụng
 * follow-up đơn XHR-12 sau 3 ngày", v.v.
 *
 * Cron `every-minute-user-reminders` ở bot scan các bản ghi `status=pending
 * && dueAt <= now && (snoozeUntil IS null OR snoozeUntil <= now)`, resolve
 * recipient → DM Telegram → set status=sent + sentAt.
 *
 * recipient có 2 dạng:
 *  - "user": gửi 1 user cụ thể (relationship users)
 *  - "role": broadcast tất cả user thuộc role (vd "recruiter" = cả team
 *    tuyển dụng)
 */
export const Reminders: CollectionConfig = {
  slug: "reminders",
  labels: { singular: "Lịch nhắc", plural: "Lịch nhắc" },
  admin: {
    group: "Form & Quy trình",
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "dueAt",
      "recipientType",
      "status",
      "sentAt",
    ],
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) =>
      ["admin", "manager"].includes(user?.role ?? "") || !!user,
    delete: ({ req: { user } }) =>
      ["admin", "manager"].includes(user?.role ?? ""),
  },
  fields: [
    {
      name: "title",
      label: "Tiêu đề",
      type: "text",
      required: true,
      admin: {
        description: "Câu ngắn — sẽ hiện ngay đầu DM Telegram khi đến giờ.",
      },
    },
    {
      name: "description",
      label: "Mô tả chi tiết",
      type: "textarea",
      admin: {
        rows: 4,
        description:
          "Context bổ sung: số đơn liên quan, tài liệu cần chuẩn bị, người liên hệ...",
      },
    },
    {
      name: "dueAt",
      label: "Đến hạn lúc",
      type: "date",
      required: true,
      admin: {
        date: { pickerAppearance: "dayAndTime" },
        description: "Thời điểm gửi nhắc nhở (giờ VN).",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "recipientType",
          label: "Gửi tới",
          type: "select",
          required: true,
          defaultValue: "chat",
          options: [
            { label: "💬 Chat (DM hoặc group cụ thể)", value: "chat" },
            { label: "👤 1 nhân viên (account hệ thống)", value: "user" },
            { label: "📞 1 user Telegram (chưa link account)", value: "telegram_user" },
            { label: "🏢 Cả phòng ban (theo vai trò)", value: "role" },
          ],
          admin: { width: "40%" },
        },
        {
          name: "recipientChatId",
          label: "Chat ID",
          type: "text",
          admin: {
            condition: (data) => data?.recipientType === "chat",
            width: "60%",
            description:
              "Telegram chat ID — số dương (DM với user) hoặc âm (group/supergroup). Bot bắn message thẳng vào chat này.",
          },
        },
        {
          name: "recipientUser",
          label: "Người nhận (account hệ thống)",
          type: "relationship",
          relationTo: "users",
          admin: {
            condition: (data) => data?.recipientType === "user",
            width: "60%",
          },
        },
        {
          name: "recipientTelegramUserId",
          label: "Telegram User ID",
          type: "text",
          admin: {
            condition: (data) => data?.recipientType === "telegram_user",
            width: "60%",
            description: "Bot DM trực tiếp telegramUserId này, không cần link system user",
          },
        },
        {
          name: "recipientRole",
          label: "Phòng ban / Vai trò",
          type: "select",
          options: [
            { label: "👑 Chủ DN / GĐ (Admin)", value: "admin" },
            { label: "📋 Quản lý điều hành", value: "manager" },
            { label: "🧑‍💼 Tuyển dụng", value: "recruiter" },
            { label: "🎓 Giảng viên đào tạo", value: "trainer" },
            { label: "🛂 Chuyên viên visa", value: "visa_specialist" },
            { label: "💰 Kế toán", value: "accountant" },
            { label: "🏥 Y tế / Khám SK", value: "medical" },
          ],
          admin: {
            condition: (data) => data?.recipientType === "role",
            width: "60%",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          required: true,
          defaultValue: "pending",
          options: [
            { label: "⏳ Chờ tới giờ", value: "pending" },
            { label: "✅ Đã gửi", value: "sent" },
            { label: "🚫 Đã huỷ", value: "dismissed" },
          ],
          admin: { width: "40%" },
        },
        {
          name: "sentAt",
          label: "Đã gửi lúc",
          type: "date",
          admin: {
            readOnly: true,
            date: { pickerAppearance: "dayAndTime" },
            width: "60%",
          },
        },
      ],
    },
    {
      name: "snoozeUntil",
      label: "Tạm hoãn tới",
      type: "date",
      admin: {
        date: { pickerAppearance: "dayAndTime" },
        description:
          "Nếu set, cron sẽ bỏ qua reminder cho tới khi qua thời điểm này.",
      },
    },
    {
      type: "collapsible",
      label: "Liên kết (tuỳ chọn)",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "relatedOrder",
              label: "Đơn tuyển liên quan",
              type: "relationship",
              relationTo: "orders",
              admin: { width: "50%" },
            },
            {
              name: "relatedWorker",
              label: "Người LĐ liên quan",
              type: "relationship",
              relationTo: "workers",
              admin: { width: "50%" },
            },
          ],
        },
      ],
    },
    {
      name: "createdBy",
      label: "Người tạo",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true },
    },
  ],
};
