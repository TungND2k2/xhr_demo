import type { CollectionConfig } from "payload";
import { generateContractCode } from "../hooks/contracts/generate-code";

/**
 * Contracts — hợp đồng đã ký giữa worker + đối tác (employer trong order).
 *
 * 1 worker × 1 order → 1 contract. Sau khi ký, worker chuyển sang status
 * `contracted`, OrderWorker.status → `passed`. Khi xuất cảnh thành công,
 * worker.status → `deployed`, contract.status → `deployed`.
 *
 * Lưu giấy tờ: HĐ scan, visa, vé máy bay, COE (Certificate of Eligibility
 * cho thị trường Nhật).
 */
export const Contracts: CollectionConfig = {
  slug: "contracts",
  labels: { singular: "Hợp đồng", plural: "Hợp đồng" },
  admin: {
    useAsTitle: "contractCode",
    defaultColumns: [
      "contractCode",
      "order",
      "worker",
      "signingDate",
      "deploymentDate",
      "status",
    ],
    group: "Tài chính & Hợp đồng",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) =>
      ["admin", "manager", "visa_specialist", "accountant"].includes(
        user?.role ?? "",
      ),
    update: ({ req: { user } }) =>
      ["admin", "manager", "visa_specialist", "accountant"].includes(
        user?.role ?? "",
      ),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    beforeChange: [generateContractCode],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Hợp đồng",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "contractCode",
                  label: "Mã HĐ",
                  type: "text",
                  unique: true,
                  admin: {
                    width: "33%",
                    readOnly: true,
                    description: "Tự sinh CT-{seq}",
                  },
                },
                {
                  name: "order",
                  label: "Đơn tuyển",
                  type: "relationship",
                  relationTo: "orders",
                  required: true,
                  admin: { width: "33%" },
                },
                {
                  name: "worker",
                  label: "Người lao động",
                  type: "relationship",
                  relationTo: "workers",
                  required: true,
                  admin: { width: "34%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "signingDate",
                  label: "Ngày ký",
                  type: "date",
                  required: true,
                  defaultValue: () => new Date().toISOString(),
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "startDate",
                  label: "Ngày bắt đầu HĐ",
                  type: "date",
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "endDate",
                  label: "Ngày kết thúc HĐ",
                  type: "date",
                  admin: { width: "34%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "salary",
                  label: "Lương cơ bản",
                  type: "number",
                  required: true,
                  min: 0,
                  admin: { width: "33%" },
                },
                {
                  name: "currency",
                  label: "Tiền tệ",
                  type: "select",
                  defaultValue: "JPY",
                  options: [
                    { label: "JPY (¥)", value: "JPY" },
                    { label: "KRW (₩)", value: "KRW" },
                    { label: "USD ($)", value: "USD" },
                    { label: "EUR (€)", value: "EUR" },
                    { label: "TWD", value: "TWD" },
                    { label: "VND (đ)", value: "VND" },
                  ],
                  admin: { width: "33%" },
                },
                {
                  name: "salaryPeriod",
                  label: "Kỳ trả lương",
                  type: "select",
                  defaultValue: "monthly",
                  options: [
                    { label: "Tháng", value: "monthly" },
                    { label: "Tuần", value: "weekly" },
                    { label: "Giờ", value: "hourly" },
                  ],
                  admin: { width: "34%" },
                },
              ],
            },
            {
              name: "benefits",
              label: "Quyền lợi (snapshot)",
              type: "textarea",
              admin: { description: "Copy từ order khi ký để giữ nguyên thoả thuận" },
            },
          ],
        },

        // ── Visa & Xuất cảnh ─────────────────────────
        {
          label: "Visa & Xuất cảnh",
          fields: [
            {
              name: "visaStatus",
              label: "Trạng thái visa",
              type: "select",
              defaultValue: "not_applied",
              options: [
                { label: "Chưa nộp", value: "not_applied" },
                { label: "📤 Đã nộp hồ sơ", value: "submitted" },
                { label: "🕒 Đang xét", value: "processing" },
                { label: "✅ Đã cấp", value: "approved" },
                { label: "❌ Bị từ chối", value: "rejected" },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "visaSubmittedAt",
                  label: "Ngày nộp hồ sơ visa",
                  type: "date",
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "visaApprovedAt",
                  label: "Ngày được cấp",
                  type: "date",
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "deploymentDate",
                  label: "Ngày xuất cảnh thực tế",
                  type: "date",
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "expectedReturnDate",
                  label: "Ngày dự kiến về nước",
                  type: "date",
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "flightNumber",
                  label: "Số hiệu chuyến bay",
                  type: "text",
                  admin: { width: "50%" },
                },
                {
                  name: "destination",
                  label: "Nơi đến (sân bay)",
                  type: "text",
                  admin: { width: "50%", placeholder: "vd: NRT, KIX, ICN" },
                },
              ],
            },
          ],
        },

        // ── Tài chính ─────────────────────────────────
        {
          label: "Tài chính",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "serviceFee",
                  label: "Phí dịch vụ (VND)",
                  type: "number",
                  min: 0,
                  admin: { width: "33%" },
                },
                {
                  name: "depositPaid",
                  label: "Đã đặt cọc (VND)",
                  type: "number",
                  defaultValue: 0,
                  min: 0,
                  admin: { width: "33%" },
                },
                {
                  name: "owedAmount",
                  label: "Còn nợ (VND)",
                  type: "number",
                  admin: {
                    width: "34%",
                    readOnly: true,
                    description: "Tự tính = Phí dịch vụ - Đã đặt cọc",
                  },
                  hooks: {
                    beforeChange: [
                      ({ siblingData }) => {
                        const fee = Number(siblingData?.serviceFee ?? 0);
                        const dep = Number(siblingData?.depositPaid ?? 0);
                        return Math.max(0, fee - dep);
                      },
                    ],
                  },
                },
              ],
            },
            {
              name: "feeBreakdown",
              label: "Bóc tách phí",
              type: "array",
              admin: {
                description:
                  "Chi tiết các khoản phí: phí đào tạo, phí khám sức khoẻ, phí visa, phí xuất cảnh...",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "kind",
                      type: "text",
                      required: true,
                      label: "Loại phí",
                      admin: { width: "50%" },
                    },
                    {
                      name: "amount",
                      type: "number",
                      required: true,
                      min: 0,
                      label: "Số tiền (VND)",
                      admin: { width: "50%" },
                    },
                  ],
                },
                { name: "notes", type: "text" },
              ],
            },
            {
              name: "payments",
              label: "Lịch sử thanh toán",
              type: "array",
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "date",
                      type: "date",
                      required: true,
                      admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                    },
                    {
                      name: "amount",
                      type: "number",
                      required: true,
                      min: 0,
                      admin: { width: "33%" },
                    },
                    {
                      name: "method",
                      type: "select",
                      options: [
                        { label: "Tiền mặt", value: "cash" },
                        { label: "Chuyển khoản", value: "bank" },
                        { label: "Ví điện tử", value: "ewallet" },
                      ],
                      admin: { width: "34%" },
                    },
                  ],
                },
                { name: "receiptFile", type: "upload", relationTo: "media" },
                { name: "notes", type: "text" },
              ],
            },
          ],
        },

        // ── Giấy tờ ──────────────────────────────────
        {
          label: "Giấy tờ",
          fields: [
            {
              name: "contractFile",
              label: "Bản hợp đồng (PDF)",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "visaFile",
              label: "Visa scan",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "coeFile",
              label: "COE (Nhật) / EPS (Hàn) / ...",
              type: "upload",
              relationTo: "media",
              admin: { description: "Certificate of Eligibility / giấy phép tương đương" },
            },
            {
              name: "flightTicketFile",
              label: "Vé máy bay",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "otherDocuments",
              label: "Giấy tờ khác",
              type: "array",
              fields: [
                { name: "kind", type: "text", required: true, label: "Loại giấy tờ" },
                { name: "file", type: "upload", relationTo: "media", required: true },
                { name: "notes", type: "text" },
              ],
            },
          ],
        },

        // ── Trạng thái ───────────────────────────────
        {
          label: "Trạng thái",
          fields: [
            {
              name: "status",
              label: "Trạng thái HĐ",
              type: "select",
              required: true,
              defaultValue: "draft",
              options: [
                { label: "📝 Nháp", value: "draft" },
                { label: "✅ Đã ký", value: "signed" },
                { label: "🛂 Chờ visa", value: "visa_pending" },
                { label: "✈️ Đã xuất cảnh", value: "deployed" },
                { label: "🏠 Đã hoàn thành (về nước)", value: "completed" },
                { label: "⛔ Chấm dứt sớm", value: "terminated" },
              ],
            },
            {
              name: "managedBy",
              label: "Người quản lý hồ sơ",
              type: "relationship",
              relationTo: "users",
            },
            {
              name: "notes",
              label: "Ghi chú",
              type: "textarea",
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
};
