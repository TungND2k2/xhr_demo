import type { CollectionConfig } from "payload";

/**
 * Media — Payload built-in upload collection.
 *
 * Khi user gửi file/ảnh qua Telegram, bot:
 *  1. Tải về → upload vào collection này
 *  2. Document → MarkItDown extract markdown → AI tóm tắt vào `description`
 *  3. Image → AI vision tóm tắt nội dung → `description`
 *
 * `description` là text dài (vài đoạn), do LLM tự sinh — mục đích để
 * tra cứu sau này. AI khi cần tìm file ("hồ sơ Nguyễn Văn A đâu", "HĐ
 * tháng 3") query Payload với `where[description][contains]=...`.
 *
 * Dev: lưu vào ./media (bên trong cms/), Payload serve qua /media/...
 * Prod: nên cấu hình S3 adapter (@payloadcms/storage-s3) — chưa wire.
 */
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Tệp tin", plural: "Tệp tin" },
  admin: {
    group: "Hệ thống",
    useAsTitle: "filename",
    defaultColumns: ["filename", "alt", "kind", "uploadedAt"],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) =>
      ["admin", "manager"].includes(user?.role ?? ""),
  },
  upload: {
    mimeTypes: ["image/*", "application/pdf", "application/*"],
  },
  fields: [
    {
      name: "alt",
      label: "Tên / nhãn ngắn",
      type: "text",
      admin: {
        description:
          "Cho user dễ nhận diện trong list. AI thường set theo nguồn (vd: 'Telegram chat 12345 / hộ chiếu LD-001').",
      },
    },
    {
      name: "kind",
      label: "Loại tài liệu (AI suy luận)",
      type: "select",
      admin: {
        description: "AI tự đoán khi nhận file — giúp lọc nhanh trong admin.",
      },
      options: [
        { label: "🆔 Hộ chiếu / CCCD / Giấy tờ tuỳ thân", value: "id_doc" },
        { label: "🏥 Giấy khám sức khoẻ", value: "health_cert" },
        { label: "📜 Hợp đồng / HĐ lao động", value: "contract" },
        { label: "🛂 Visa / COE / Giấy phép cư trú", value: "visa_doc" },
        { label: "✈️ Vé máy bay / Lịch trình", value: "flight" },
        { label: "💼 CV / Sơ yếu lý lịch", value: "cv" },
        { label: "🖼 Ảnh chân dung", value: "portrait" },
        { label: "💰 Hoá đơn / Phiếu thu", value: "invoice" },
        { label: "📋 Đơn / Form / Phiếu", value: "form" },
        { label: "📄 Tài liệu đối tác", value: "partner_doc" },
        { label: "📝 Khác", value: "other" },
      ],
    },
    {
      name: "description",
      label: "Mô tả đầy đủ (AI tóm tắt nội dung)",
      type: "textarea",
      admin: {
        rows: 8,
        description:
          "Bot dùng LLM tóm tắt nội dung file/ảnh khi upload. AI sau này " +
          "đọc cái này để tìm tệp liên quan đến truy vấn của user. Càng " +
          "nhiều thông tin (tên người, ngày, số HĐ, loại giấy tờ, ...) " +
          "càng dễ tìm.",
      },
    },
    {
      name: "extractedText",
      label: "Nội dung text gốc (raw markdown)",
      type: "textarea",
      admin: {
        rows: 6,
        description:
          "Output thô của MarkItDown. Chỉ có với document; ảnh thì để trống.",
        readOnly: true,
        initCollapsed: true,
      },
    },
    {
      name: "uploadedFrom",
      label: "Nguồn upload",
      type: "select",
      defaultValue: "admin",
      options: [
        { label: "Web admin", value: "admin" },
        { label: "Telegram bot", value: "telegram" },
        { label: "API", value: "api" },
      ],
      admin: { readOnly: true },
    },
    {
      name: "uploadedAt",
      label: "Ngày tải lên",
      type: "date",
      defaultValue: () => new Date().toISOString(),
      admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } },
    },
  ],
};
