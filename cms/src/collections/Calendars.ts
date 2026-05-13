import type { CollectionConfig } from "payload";

/**
 * Calendars — lịch họp / lịch hẹn / lịch sự kiện.
 *
 * Khác Reminders (chỉ là 1 thông báo bắn 1 lần đúng giờ), Calendar event
 * có start + end, attendees, location — phục vụ:
 *  - Họp nội bộ giữa phòng ban
 *  - Phỏng vấn ứng viên (interviewer + worker)
 *  - Hẹn đối tác
 *  - Lịch bay xuất cảnh
 *  - Lịch khám SK định kỳ
 *
 * AI có thể tự tạo + xem qua tools để check "tuần này tôi có lịch gì",
 * "đặt lịch họp với Toyota thứ 5 14h".
 */
export const Calendars: CollectionConfig = {
  slug: "calendars",
  labels: { singular: "Lịch", plural: "Lịch" },
  admin: {
    group: "Form & Quy trình",
    useAsTitle: "title",
    defaultColumns: [
      "title",
      "eventType",
      "startAt",
      "endAt",
      "location",
      "status",
    ],
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) =>
      ["admin", "manager"].includes(user?.role ?? ""),
  },
  fields: [
    {
      name: "title",
      label: "Tiêu đề",
      type: "text",
      required: true,
    },
    {
      type: "row",
      fields: [
        {
          name: "eventType",
          label: "Loại sự kiện",
          type: "select",
          required: true,
          defaultValue: "meeting",
          options: [
            { label: "🤝 Họp nội bộ", value: "meeting" },
            { label: "📞 Họp đối tác", value: "partner_meeting" },
            { label: "🎯 Phỏng vấn ứng viên", value: "interview" },
            { label: "🏥 Khám sức khoẻ", value: "health_check" },
            { label: "✈️ Bay xuất cảnh", value: "flight" },
            { label: "📚 Lớp đào tạo", value: "training_class" },
            { label: "🎓 Thi tuyển", value: "exam" },
            { label: "📝 Khác", value: "other" },
          ],
          admin: { width: "33%" },
        },
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          required: true,
          defaultValue: "scheduled",
          options: [
            { label: "📅 Đã đặt lịch", value: "scheduled" },
            { label: "✅ Đã diễn ra", value: "completed" },
            { label: "❌ Đã huỷ", value: "cancelled" },
            { label: "⏸ Hoãn lại", value: "postponed" },
          ],
          admin: { width: "33%" },
        },
        {
          name: "allDay",
          label: "Cả ngày",
          type: "checkbox",
          defaultValue: false,
          admin: { width: "34%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "startAt",
          label: "Bắt đầu",
          type: "date",
          required: true,
          admin: {
            date: { pickerAppearance: "dayAndTime" },
            width: "50%",
          },
        },
        {
          name: "endAt",
          label: "Kết thúc",
          type: "date",
          admin: {
            date: { pickerAppearance: "dayAndTime" },
            width: "50%",
            description: "Để trống nếu không xác định giờ kết thúc",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "location",
          label: "Địa điểm",
          type: "text",
          admin: {
            width: "60%",
            placeholder: "vd: Văn phòng tầng 5 / Online Google Meet",
          },
        },
        {
          name: "meetingLink",
          label: "Link họp online",
          type: "text",
          admin: {
            width: "40%",
            placeholder: "https://meet.google.com/...",
          },
        },
      ],
    },
    {
      name: "description",
      label: "Nội dung / Agenda",
      type: "textarea",
      admin: { rows: 4 },
    },
    {
      name: "attendees",
      label: "Người tham dự",
      type: "array",
      labels: { singular: "Người tham dự", plural: "Người tham dự" },
      admin: {
        description: "Danh sách nhân viên + worker tham gia",
      },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "user",
              label: "Nhân viên",
              type: "relationship",
              relationTo: "users",
              admin: { width: "50%" },
            },
            {
              name: "worker",
              label: "Người lao động",
              type: "relationship",
              relationTo: "workers",
              admin: { width: "50%" },
            },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "role",
              label: "Vai trò",
              type: "select",
              options: [
                { label: "Người dự (required)", value: "required" },
                { label: "Người dự (optional)", value: "optional" },
                { label: "Chủ trì / Tổ chức", value: "organizer" },
              ],
              defaultValue: "required",
              admin: { width: "50%" },
            },
            {
              name: "rsvp",
              label: "Phản hồi tham dự",
              type: "select",
              options: [
                { label: "Chưa phản hồi", value: "pending" },
                { label: "Sẽ tham dự", value: "yes" },
                { label: "Không tham dự", value: "no" },
                { label: "Có thể", value: "maybe" },
              ],
              defaultValue: "pending",
              admin: { width: "50%" },
            },
          ],
        },
      ],
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
              label: "Đơn tuyển",
              type: "relationship",
              relationTo: "orders",
              admin: { width: "50%" },
            },
            {
              name: "relatedContract",
              label: "Hợp đồng",
              type: "relationship",
              relationTo: "contracts",
              admin: { width: "50%" },
            },
          ],
        },
      ],
    },
    {
      type: "collapsible",
      label: "Nhắc nhở",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "remindBeforeMinutes",
          label: "Nhắc trước (phút)",
          type: "number",
          admin: {
            description:
              "Bot sẽ gửi nhắc Telegram cho attendees trước event N phút. Để trống = không nhắc tự động.",
            placeholder: "30",
          },
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
