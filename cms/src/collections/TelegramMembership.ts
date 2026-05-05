import type { CollectionConfig } from "payload";

/**
 * TelegramMembership — bảng trung gian M2M giữa TelegramUsers ↔
 * TelegramGroups. 1 user có thể trong nhiều group, 1 group có nhiều user.
 *
 * Bot lazy-upsert khi user gửi message trong group. Trên Payload v3 không
 * có composite unique index sẵn, nên uniqueness (telegramUser + telegramGroup)
 * được enforce bằng find-then-create trong sync helper bên bot. Nếu race
 * tạo ra 2 row trùng, có thể dedup bằng cron defrag (chưa cần V1).
 *
 * Khi Telegram event chat_member trả về user.status='left' / 'kicked',
 * bot có thể PATCH `leftAt` để biết user đã rời. V1 chỉ track joinedAt
 * theo first-seen.
 */
export const TelegramMembership: CollectionConfig = {
  slug: "telegram-membership",
  labels: { singular: "Thành viên Telegram", plural: "Thành viên Telegram" },
  admin: {
    group: "Telegram",
    defaultColumns: [
      "telegramUser",
      "telegramGroup",
      "role",
      "joinedAt",
      "leftAt",
    ],
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "telegramUser",
          label: "Người dùng",
          type: "relationship",
          relationTo: "telegram-users",
          required: true,
          index: true,
          admin: { width: "50%" },
        },
        {
          name: "telegramGroup",
          label: "Group",
          type: "relationship",
          relationTo: "telegram-groups",
          required: true,
          index: true,
          admin: { width: "50%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "role",
          label: "Vai trò trong group",
          type: "select",
          options: [
            { label: "Thành viên", value: "member" },
            { label: "Admin", value: "admin" },
            { label: "Owner / Creator", value: "owner" },
          ],
          defaultValue: "member",
          admin: { width: "33%" },
        },
        {
          name: "joinedAt",
          label: "Tham gia lúc",
          type: "date",
          admin: {
            readOnly: true,
            date: { pickerAppearance: "dayAndTime" },
            width: "33%",
          },
        },
        {
          name: "leftAt",
          label: "Rời group lúc",
          type: "date",
          admin: {
            date: { pickerAppearance: "dayAndTime" },
            width: "34%",
            description: "Set khi Telegram báo user rời/bị kick",
          },
        },
      ],
    },
    {
      name: "messageCount",
      label: "Tin nhắn trong group này",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "lastSeenAt",
      label: "Tin gần nhất trong group",
      type: "date",
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};
