import type { CollectionConfig } from "payload";

/**
 * TelegramUsers — registry mọi người từng chat với bot.
 *
 * Bot tự upsert mỗi khi nhận message (fire-and-forget). Không phải mọi
 * TelegramUser đều là nhân viên — ứng viên LĐ, đối tác, người lạ chat
 * vào DM cũng được lưu. Admin có thể link `linkedSystemUser` để biết
 * Telegram user này tương ứng với account `users` nào trong hệ thống.
 *
 * Lookup chính: `telegramUserId` (số ID Telegram, unique). `username` có
 * thể đổi nên không dùng làm khoá.
 */
export const TelegramUsers: CollectionConfig = {
  slug: "telegram-users",
  labels: { singular: "Người dùng Telegram", plural: "Người dùng Telegram" },
  admin: {
    group: "Telegram",
    useAsTitle: "displayName",
    defaultColumns: [
      "telegramUserId",
      "username",
      "displayName",
      "linkedSystemUser",
      "lastSeenAt",
    ],
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => !!user, // bot và admin
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "telegramUserId",
      label: "Telegram User ID",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "ID dạng số (vd 123456789), unique" },
    },
    {
      type: "row",
      fields: [
        {
          name: "username",
          label: "Username",
          type: "text",
          admin: { width: "33%", description: "Không có @, có thể đổi" },
        },
        {
          name: "firstName",
          label: "Tên",
          type: "text",
          admin: { width: "33%" },
        },
        {
          name: "lastName",
          label: "Họ",
          type: "text",
          admin: { width: "34%" },
        },
      ],
    },
    {
      name: "displayName",
      label: "Tên hiển thị",
      type: "text",
      admin: {
        readOnly: true,
        description: "Tự sinh = firstName + lastName + (@username nếu có)",
      },
    },
    {
      name: "linkedSystemUser",
      label: "Account hệ thống",
      type: "relationship",
      relationTo: "users",
      admin: {
        description:
          "Link Telegram user này với account đăng nhập (nếu là nhân viên).",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "isBot",
          label: "Là bot?",
          type: "checkbox",
          defaultValue: false,
          admin: { width: "33%" },
        },
        {
          name: "blocked",
          label: "Bị chặn",
          type: "checkbox",
          defaultValue: false,
          admin: {
            width: "33%",
            description: "Bot sẽ bỏ qua tin nhắn từ user này",
          },
        },
        {
          name: "lastSeenAt",
          label: "Lần cuối hoạt động",
          type: "date",
          admin: {
            readOnly: true,
            date: { pickerAppearance: "dayAndTime" },
            width: "34%",
          },
        },
      ],
    },
    {
      name: "messageCount",
      label: "Tổng số tin nhắn",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Auto-sinh displayName từ first/last/username
        const parts = [data.firstName, data.lastName].filter(Boolean);
        const name = parts.join(" ").trim();
        const at = data.username ? `@${data.username}` : "";
        const display = name && at
          ? `${name} (${at})`
          : name || at || data.telegramUserId;
        return { ...data, displayName: display };
      },
    ],
  },
};
