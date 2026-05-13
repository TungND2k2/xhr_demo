import type { CollectionConfig } from "payload";

/**
 * TelegramTopics — chủ đề (topic / forum thread) trong supergroup Telegram,
 * map với agent tương ứng.
 *
 * Bot auto-upsert khi nhận message có `message_thread_id` (Forum mode).
 * Trường `agent` ban đầu null — admin vào portal chọn agent từ dropdown.
 *
 * Composite "unique" (telegramGroup + topicId) được enforce app-side trong
 * sync helper (Payload v3 chưa hỗ trợ composite unique index).
 *
 * Khi bot nhận message, lookup chain:
 *   1. Tìm TelegramTopic theo (chatId, message_thread_id)
 *   2. Lấy agent từ topic
 *   3. Load agent docs + tools subset → build pipeline
 *
 * Nếu topic chưa có agent → fallback supervisor agent (mặc định).
 */
export const TelegramTopics: CollectionConfig = {
  slug: "telegram-topics",
  labels: { singular: "Chủ đề Telegram", plural: "Chủ đề Telegram" },
  admin: {
    group: "Multi-Agent",
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "telegramGroup",
      "topicId",
      "agent",
      "active",
      "lastSeenAt",
    ],
    description:
      "Map mỗi chủ đề Telegram với 1 trợ lý. Bot tự tạo entry khi nhận tin trong topic mới — admin chỉ cần chọn agent từ dropdown.",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => !!user, // bot tự tạo
    update: ({ req: { user } }) =>
      ["admin", "manager"].includes(user?.role ?? ""),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "telegramGroup",
          label: "Nhóm Telegram",
          type: "relationship",
          relationTo: "telegram-groups",
          required: true,
          index: true,
          admin: {
            width: "50%",
            description: "Group chứa topic này. Bot tự gán khi sync.",
          },
        },
        {
          name: "topicId",
          label: "Topic ID",
          type: "text",
          required: true,
          index: true,
          admin: {
            width: "25%",
            description:
              "message_thread_id từ Telegram. Topic chính (General) = 1.",
          },
        },
        {
          name: "active",
          label: "Đang hoạt động",
          type: "checkbox",
          defaultValue: true,
          admin: { width: "25%" },
        },
      ],
    },
    {
      name: "title",
      label: "Tên chủ đề",
      type: "text",
      required: true,
      admin: {
        description:
          'Tên hiển thị (vd: "Tuyển dụng", "Đào tạo"). Bot lấy từ Telegram khi có, admin có thể override.',
      },
    },
    {
      name: "agent",
      label: "Trợ lý phụ trách",
      type: "relationship",
      relationTo: "agents",
      admin: {
        description:
          "Chọn trợ lý xử lý mọi tin nhắn trong topic này. Để trống = dùng Supervisor agent mặc định.",
      },
    },
    {
      name: "description",
      label: "Mô tả (tuỳ chọn)",
      type: "textarea",
      admin: {
        rows: 3,
        description:
          "Note cho admin — vd quy ước phân quyền topic, ai phụ trách, mục đích.",
      },
    },
    {
      type: "collapsible",
      label: "Thống kê (auto)",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "messageCount",
              label: "Số tin nhắn",
              type: "number",
              defaultValue: 0,
              admin: { readOnly: true, width: "33%" },
            },
            {
              name: "lastSeenAt",
              label: "Tin nhắn gần nhất",
              type: "date",
              admin: {
                readOnly: true,
                date: { pickerAppearance: "dayAndTime" },
                width: "33%",
              },
            },
            {
              name: "firstSeenAt",
              label: "Lần đầu thấy",
              type: "date",
              admin: {
                readOnly: true,
                date: { pickerAppearance: "dayAndTime" },
                width: "34%",
              },
            },
          ],
        },
      ],
    },
  ],
};
