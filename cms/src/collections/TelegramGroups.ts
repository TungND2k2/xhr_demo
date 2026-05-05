import type { CollectionConfig } from "payload";

/**
 * TelegramGroups — registry mọi group/supergroup bot được add vào.
 *
 * Bot tự upsert khi nhận message từ chat type=group/supergroup. Field
 * `active` tự set false nếu bot không nhận tin từ group đó trong N ngày
 * (job scheduled — chưa wire, để v2). Admin có thể đặt thuộc tính custom
 * như `purpose` để phân loại group.
 */
export const TelegramGroups: CollectionConfig = {
  slug: "telegram-groups",
  labels: { singular: "Group Telegram", plural: "Group Telegram" },
  admin: {
    group: "Telegram",
    useAsTitle: "title",
    defaultColumns: [
      "telegramChatId",
      "title",
      "type",
      "active",
      "lastActivityAt",
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
      name: "telegramChatId",
      label: "Telegram Chat ID",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Chat ID âm cho group/supergroup, vd "-1001234..."' },
    },
    {
      name: "title",
      label: "Tên group",
      type: "text",
      admin: { description: "Cập nhật mỗi lần nhận message từ group" },
    },
    {
      type: "row",
      fields: [
        {
          name: "type",
          label: "Loại",
          type: "select",
          options: [
            { label: "Group", value: "group" },
            { label: "Supergroup", value: "supergroup" },
            { label: "Channel", value: "channel" },
          ],
          admin: { width: "33%" },
        },
        {
          name: "active",
          label: "Đang hoạt động",
          type: "checkbox",
          defaultValue: true,
          admin: {
            width: "33%",
            description: "Bot vẫn còn ở group này",
          },
        },
        {
          name: "lastActivityAt",
          label: "Hoạt động gần nhất",
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
      name: "purpose",
      label: "Mục đích",
      type: "select",
      options: [
        { label: "Nội bộ — quản lý chung", value: "internal_general" },
        { label: "Nội bộ — phòng ban", value: "internal_dept" },
        { label: "Đối tác", value: "partner" },
        { label: "Ứng viên", value: "candidates" },
        { label: "Khác", value: "other" },
      ],
      admin: {
        description: "Dùng để phân quyền sau (vd group đối tác ≠ group nội bộ)",
      },
    },
    {
      name: "messageCount",
      label: "Tổng tin nhắn",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "botJoinedAt",
      label: "Bot vào group lúc",
      type: "date",
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};
