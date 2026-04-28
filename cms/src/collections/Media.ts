import type { CollectionConfig } from "payload";

/**
 * Media — Payload built-in upload collection.
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
  },
  access: {
    read: () => true, // file URL public; production cần signed URL
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) =>
      ["admin", "manager"].includes(user?.role ?? ""),
  },
  upload: {
    // Cho phép ảnh + PDF (hóa đơn / đề bài / ảnh xác nhận)
    mimeTypes: ["image/*", "application/pdf"],
  },
  fields: [
    {
      name: "alt",
      label: "Mô tả ngắn",
      type: "text",
    },
  ],
};
