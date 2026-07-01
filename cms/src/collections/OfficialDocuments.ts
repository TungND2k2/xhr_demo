import type { CollectionConfig } from "payload";
import { makeSyncMediaBacklinks, makeRemoveAllMediaBacklinks } from "../hooks/shared/sync-media-backlinks";

const extractOfficialDocMedia = (doc: any) => [
  doc?.scanFile,
  ...(Array.isArray(doc?.attachments) ? doc.attachments : []),
];

/**
 * OfficialDocuments — Công văn đến / đi của TLG.
 *
 * Phân loại nghiệp vụ:
 *  - incoming: công văn TLG NHẬN từ cơ quan / đối tác (Sở LĐ, Cục XKLĐ,
 *    ĐSQ, BHXH, Thuế, đối tác Nhật, đối tác trong nước...)
 *  - outgoing: công văn TLG PHÁT HÀNH gửi đi
 *  - internal: công văn nội bộ giữa các phòng (vd quyết định nhân sự,
 *    thông báo họp, quy chế công ty)
 *
 * Workflow: draft → sent/received → processing → completed → archived
 *
 * File scan lưu Media; có thể link với workers/orders/contracts/partners
 * qua field `relatedRecords` (polymorphic) — sau này tìm công văn liên
 * quan đối tác X / LĐ Y dễ.
 */
export const OfficialDocuments: CollectionConfig = {
  slug: "official-documents",
  labels: { singular: "Công văn", plural: "Công văn" },
  admin: {
    group: "Hành chính",
    useAsTitle: "documentCode",
    defaultColumns: [
      "documentCode",
      "direction",
      "title",
      "issuedDate",
      "issuingAuthority",
      "status",
      "priority",
    ],
    description:
      "Công văn đến / đi / nội bộ của TLG. Quản bởi Phòng Hành chính.",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) =>
      ["admin", "manager", "accountant"].includes(user?.role ?? ""),
    update: ({ req: { user } }) =>
      ["admin", "manager", "accountant"].includes(user?.role ?? ""),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    afterChange: [
      makeSyncMediaBacklinks({ ownerSlug: "official-documents", extract: extractOfficialDocMedia }),
    ],
    afterDelete: [
      makeRemoveAllMediaBacklinks({ ownerSlug: "official-documents", extract: extractOfficialDocMedia }),
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Thông tin chung",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "documentCode",
                  label: "Mã công văn nội bộ",
                  type: "text",
                  required: true,
                  unique: true,
                  index: true,
                  admin: {
                    width: "30%",
                    placeholder: "CV-2024-001 / CV-DEN-001",
                    description: "Mã quản lý nội bộ TLG (auto-incremented khuyến nghị).",
                  },
                },
                {
                  name: "direction",
                  label: "Hướng",
                  type: "select",
                  required: true,
                  defaultValue: "incoming",
                  options: [
                    { label: "📥 Công văn đến (nhận)", value: "incoming" },
                    { label: "📤 Công văn đi (phát hành)", value: "outgoing" },
                    { label: "🔁 Nội bộ", value: "internal" },
                  ],
                  admin: { width: "35%" },
                },
                {
                  name: "status",
                  label: "Trạng thái",
                  type: "select",
                  required: true,
                  defaultValue: "received",
                  options: [
                    { label: "📝 Bản nháp", value: "draft" },
                    { label: "📨 Đã gửi", value: "sent" },
                    { label: "📬 Đã nhận", value: "received" },
                    { label: "⚙️ Đang xử lý", value: "processing" },
                    { label: "✅ Hoàn thành", value: "completed" },
                    { label: "📦 Lưu trữ", value: "archived" },
                    { label: "❌ Hủy", value: "cancelled" },
                  ],
                  admin: { width: "35%" },
                },
              ],
            },
            {
              name: "title",
              label: "Tiêu đề / Trích yếu",
              type: "text",
              required: true,
              admin: { placeholder: "Trích yếu nội dung công văn" },
            },
            {
              type: "row",
              fields: [
                {
                  name: "officialNumber",
                  label: "Số văn bản",
                  type: "text",
                  admin: {
                    width: "33%",
                    placeholder: "1234/QĐ-LĐTBXH / 567/CV-CXKL",
                    description: "Số do cơ quan ban hành cấp",
                  },
                },
                {
                  name: "issuedDate",
                  label: "Ngày ban hành",
                  type: "date",
                  required: true,
                  admin: {
                    width: "33%",
                    date: { pickerAppearance: "dayOnly" },
                  },
                },
                {
                  name: "receivedDate",
                  label: "Ngày TLG nhận/gửi",
                  type: "date",
                  admin: {
                    width: "34%",
                    date: { pickerAppearance: "dayOnly" },
                    description: "Có thể khác ngày ban hành (gửi qua bưu điện...)",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "issuingAuthority",
                  label: "Cơ quan ban hành",
                  type: "text",
                  admin: {
                    width: "50%",
                    placeholder: "vd: Bộ LĐTBXH / Cục QLLĐNN / Sở LĐ Hà Nội / ĐSQ Nhật",
                    description: "Bên ban hành — nếu là outgoing thì để TLG",
                  },
                },
                {
                  name: "recipient",
                  label: "Nơi nhận",
                  type: "text",
                  admin: {
                    width: "50%",
                    placeholder: "vd: TLG (đến) / Cục QLLĐNN (đi)",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "signedBy",
                  label: "Người ký",
                  type: "text",
                  admin: { width: "33%", placeholder: "vd: Cục trưởng Nguyễn Văn A" },
                },
                {
                  name: "responseRecipient",
                  label: "Đơn vị nhận hồi lời",
                  type: "text",
                  admin: {
                    width: "34%",
                    placeholder: "vd: Phòng NB, Phòng HC, Giám đốc...",
                    description: "Bộ phận/người cần phúc đáp lại văn bản đi này",
                    condition: (data: any) => data?.direction === "outgoing",
                  },
                },
                {
                  name: "copiesCount",
                  label: "Số lượng bản",
                  type: "number",
                  defaultValue: 1,
                  min: 1,
                  admin: {
                    width: "16%",
                    description: "Bản phát hành",
                    condition: (data: any) => data?.direction !== "incoming",
                  },
                },
                {
                  name: "priority",
                  label: "Cấp độ",
                  type: "select",
                  defaultValue: "normal",
                  options: [
                    { label: "📄 Thường", value: "normal" },
                    { label: "⚡ Khẩn", value: "urgent" },
                    { label: "🚨 Hỏa tốc", value: "very_urgent" },
                    { label: "🔒 Mật", value: "confidential" },
                  ],
                  admin: { width: "17%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "incomingSequence",
                  label: "Số đến (sổ)",
                  type: "number",
                  admin: {
                    width: "25%",
                    placeholder: "VD: 7 → hiển thị 007/2025",
                    description: "Số thứ tự trong sổ công văn đến — điền thủ công theo sổ giấy",
                    condition: (data: any) => data?.direction === "incoming",
                  },
                },
                {
                  name: "documentType",
                  label: "Loại công văn",
                  type: "select",
                  admin: { width: "75%" },
                  options: [
                    { label: "📋 Quyết định", value: "decision" },
                    { label: "📜 Thông tư", value: "circular" },
                    { label: "📨 Công văn", value: "official_letter" },
                    { label: "📢 Thông báo", value: "notice" },
                    { label: "📝 Tờ trình", value: "report" },
                    { label: "📑 Hợp đồng/Phụ lục", value: "contract" },
                    { label: "🪪 Giấy phép/Chứng nhận", value: "license" },
                    { label: "📧 Email/Thư từ", value: "letter" },
                    { label: "🌐 Khác", value: "other" },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Xử lý",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "assignedTo",
                  label: "Giao xử lý",
                  type: "relationship",
                  relationTo: "employees",
                  admin: {
                    width: "50%",
                    description: "Nhân sự được giao xử lý công văn này",
                  },
                },
                {
                  name: "deadline",
                  label: "Hạn xử lý",
                  type: "date",
                  admin: {
                    width: "50%",
                    date: { pickerAppearance: "dayAndTime" },
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "processedAt",
                  label: "Ngày xử lý xong",
                  type: "date",
                  admin: {
                    width: "50%",
                    date: { pickerAppearance: "dayAndTime" },
                  },
                },
                {
                  name: "processingNotes",
                  label: "Ghi chú xử lý",
                  type: "textarea",
                  admin: { width: "50%", rows: 2 },
                },
              ],
            },
            {
              name: "responseDocument",
              label: "Công văn phúc đáp (nếu có)",
              type: "relationship",
              relationTo: "official-documents",
              admin: {
                description: "Link tới công văn ta đã gửi đi để phúc đáp công văn này",
              },
            },
          ],
        },
        {
          label: "File & Liên kết",
          fields: [
            {
              name: "scanFile",
              label: "File scan / PDF chính",
              type: "relationship",
              relationTo: "media",
              admin: { description: "File scan hoặc PDF gốc của công văn" },
            },
            {
              name: "attachments",
              label: "Tệp đính kèm",
              type: "relationship",
              relationTo: "media",
              hasMany: true,
              admin: { description: "Phụ lục, biểu mẫu kèm theo..." },
            },
            {
              name: "relatedRecords",
              label: "Liên quan đến",
              type: "relationship",
              relationTo: ["workers", "orders", "supply-contracts", "partners", "employees", "contracts"],
              hasMany: true,
              admin: {
                description:
                  "Công văn về Worker nào / Order nào / Đối tác nào? Link để dễ tra cứu chéo.",
              },
            },
          ],
        },
        {
          label: "Nội dung",
          fields: [
            {
              name: "summary",
              label: "Tóm tắt nội dung",
              type: "textarea",
              admin: {
                rows: 5,
                description: "4-8 câu tóm tắt — AI có thể tự sinh khi extract từ file scan.",
              },
            },
            {
              name: "extractedText",
              label: "Nội dung text gốc (raw OCR)",
              type: "textarea",
              admin: {
                rows: 6,
                readOnly: true,
                description: "Output OCR/MarkItDown. Để tra cứu full-text search.",
              },
            },
            {
              name: "tags",
              label: "Tags",
              type: "array",
              labels: { singular: "Tag", plural: "Tags" },
              admin: { description: 'vd: "BHXH", "xuất cảnh", "kiểm tra", "thuế"' },
              fields: [{ name: "tag", type: "text", required: true }],
            },
            {
              name: "notes",
              label: "Ghi chú nội bộ",
              type: "textarea",
              admin: { rows: 3 },
            },
          ],
        },
      ],
    },
  ],
};
