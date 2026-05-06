import type { CollectionConfig } from "payload";
import { generateOrderCode } from "../hooks/orders/generate-code";
import { trackStageTiming } from "../hooks/orders/track-stage-timing";

/**
 * Orders — đơn tuyển từ đối tác (xí nghiệp / công ty / chủ tàu) ở
 * thị trường nước ngoài. 1 đơn cần X người, mỗi người là 1 hàng trong
 * `order_workers`.
 *
 * Workflow W1→W8:
 *   W1 Tuyển dụng → W2 Khám sức khoẻ → W3 Đào tạo
 *   → W4 Phỏng vấn đối tác → W5 Ký HĐ → W6 Xin visa
 *   → W7 Xuất cảnh → W8 Quản lý sau xuất cảnh
 */
export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Đơn tuyển", plural: "Đơn tuyển" },
  admin: {
    useAsTitle: "orderCode",
    defaultColumns: [
      "orderCode",
      "market",
      "employer",
      "position",
      "quantityNeeded",
      "deadline",
      "status",
    ],
    group: "Tuyển dụng",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) =>
      ["admin", "manager", "recruiter"].includes(user?.role ?? ""),
    update: ({ req: { user } }) =>
      ["admin", "manager", "recruiter", "trainer", "visa_specialist"].includes(
        user?.role ?? "",
      ),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  hooks: {
    beforeChange: [generateOrderCode, trackStageTiming],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Đơn tuyển",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "orderCode",
                  label: "Mã đơn",
                  type: "text",
                  unique: true,
                  admin: {
                    width: "33%",
                    readOnly: true,
                    description: "Tự sinh dạng XHR-{seq}",
                  },
                },
                {
                  name: "orderDate",
                  label: "Ngày nhận đơn",
                  type: "date",
                  required: true,
                  defaultValue: () => new Date().toISOString(),
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "market",
                  label: "Thị trường",
                  type: "select",
                  required: true,
                  options: [
                    { label: "🇯🇵 Nhật Bản", value: "jp" },
                    { label: "🇰🇷 Hàn Quốc", value: "kr" },
                    { label: "🇹🇼 Đài Loan", value: "tw" },
                    { label: "🇩🇪 Đức", value: "de" },
                    { label: "🇸🇦 Trung Đông", value: "me" },
                    { label: "🇪🇺 EU khác", value: "eu" },
                    { label: "Khác", value: "other" },
                  ],
                  admin: { width: "34%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "employer",
                  label: "Đối tác / xí nghiệp",
                  type: "text",
                  required: true,
                  admin: { width: "67%", description: "Tên xí nghiệp / công ty / chủ tàu" },
                },
                {
                  name: "employerCountry",
                  label: "Quốc gia trụ sở",
                  type: "text",
                  admin: { width: "33%", placeholder: "vd: Japan / Korea" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "employerContact",
                  label: "Người liên hệ phía đối tác",
                  type: "text",
                  admin: { width: "50%" },
                },
                {
                  name: "employerEmail",
                  label: "Email đối tác",
                  type: "email",
                  admin: { width: "50%" },
                },
              ],
            },
            // Nghiệp đoàn / broker — thường là tổ chức trung gian giữa
            // công ty XKLĐ và xí nghiệp (đặc biệt thị trường Nhật).
            {
              type: "row",
              fields: [
                {
                  name: "brokerAgency",
                  label: "Nghiệp đoàn / Broker",
                  type: "text",
                  admin: {
                    width: "67%",
                    description: "Tên nghiệp đoàn trung gian (vd: 'Hiệp hội XYZ Cooperative')",
                  },
                },
                {
                  name: "brokerAgencyContact",
                  label: "SĐT nghiệp đoàn",
                  type: "text",
                  admin: { width: "33%" },
                },
              ],
            },
            // Hợp đồng cung ứng lao động (HĐCU) ký giữa công ty XKLĐ ↔
            // đối tác/nghiệp đoàn. Khác `contracts` collection (HĐ ký với
            // worker cá nhân) — đây là HĐ ở cấp đơn tuyển.
            {
              type: "row",
              fields: [
                {
                  name: "contractNumber",
                  label: "Số HĐCU",
                  type: "text",
                  admin: {
                    width: "50%",
                    description: "Số hợp đồng cung ứng (vd: 01/03/2026/DKHD-TDTL)",
                  },
                },
                {
                  name: "contractDate",
                  label: "Ngày ký HĐCU",
                  type: "date",
                  admin: {
                    width: "50%",
                    date: { pickerAppearance: "dayOnly", displayFormat: "dd/MM/yyyy" },
                  },
                },
              ],
            },

            {
              type: "row",
              fields: [
                {
                  name: "position",
                  label: "Vị trí / nghề",
                  type: "text",
                  required: true,
                  admin: {
                    width: "50%",
                    placeholder: "Hàn 6G / Điều dưỡng / Công xưởng cơ khí...",
                  },
                },
                {
                  name: "quantityNeeded",
                  label: "Số lượng cần",
                  type: "number",
                  required: true,
                  min: 1,
                  admin: { width: "25%" },
                },
                {
                  name: "contractDurationMonths",
                  label: "Thời hạn HĐ (tháng)",
                  type: "number",
                  min: 1,
                  admin: { width: "25%", description: "vd: 36" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "genderPreference",
                  label: "Yêu cầu giới tính",
                  type: "select",
                  defaultValue: "any",
                  options: [
                    { label: "Không yêu cầu", value: "any" },
                    { label: "Nam", value: "male" },
                    { label: "Nữ", value: "female" },
                  ],
                  admin: { width: "33%" },
                },
                {
                  name: "ageMin",
                  label: "Tuổi tối thiểu",
                  type: "number",
                  admin: { width: "33%" },
                },
                {
                  name: "ageMax",
                  label: "Tuổi tối đa",
                  type: "number",
                  admin: { width: "34%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "salaryFrom",
                  label: "Lương từ",
                  type: "number",
                  min: 0,
                  admin: { width: "33%" },
                },
                {
                  name: "salaryTo",
                  label: "Lương đến",
                  type: "number",
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
                  admin: { width: "34%" },
                },
              ],
            },
            {
              name: "requirements",
              label: "Yêu cầu chi tiết",
              type: "textarea",
              admin: {
                description:
                  "Yêu cầu sức khoẻ, ngoại ngữ, kinh nghiệm, chứng chỉ — text tự do, AI sẽ đọc khi sàng lọc",
                rows: 5,
              },
            },
            {
              name: "benefits",
              label: "Quyền lợi",
              type: "textarea",
              admin: { description: "Bao ăn ở, vé máy bay, làm thêm, bảo hiểm..." },
            },

            {
              type: "row",
              fields: [
                {
                  name: "deadline",
                  label: "Hạn tuyển đủ",
                  type: "date",
                  required: true,
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "deploymentDate",
                  label: "Dự kiến xuất cảnh",
                  type: "date",
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },

            {
              type: "row",
              fields: [
                {
                  name: "serviceFee",
                  label: "Phí dịch vụ / người (VND)",
                  type: "number",
                  min: 0,
                  admin: { width: "50%" },
                },
                {
                  name: "depositRequired",
                  label: "Cọc giữ chỗ / người (VND)",
                  type: "number",
                  min: 0,
                  admin: { width: "50%" },
                },
              ],
            },

            {
              name: "orderDocuments",
              label: "Tài liệu đơn",
              type: "array",
              admin: {
                description: "Bản mô tả công việc, hợp đồng mẫu, hồ sơ đối tác...",
              },
              fields: [
                { name: "kind", type: "text", label: "Loại", required: true },
                { name: "file", type: "upload", relationTo: "media", required: true },
                { name: "notes", type: "text" },
              ],
            },

            {
              name: "notes",
              label: "Ghi chú",
              type: "textarea",
            },
            // Thuộc tính linh hoạt — AI dùng để lưu info đặc thù không có
            // trong schema chính (vd: "Phụ cấp ăn", "Yêu cầu visa loại E-9",
            // "Bảo hiểm tai nạn", "Nhà ở miễn phí", "Phí môi giới Nhật Bản"...).
            // Schema-less + searchable theo `key` hoặc `value`.
            {
              name: "attributes",
              label: "Thuộc tính bổ sung",
              type: "array",
              labels: { singular: "Thuộc tính", plural: "Thuộc tính" },
              admin: {
                description:
                  "Lưu thông tin chi tiết không có cột riêng. AI tự fill khi đọc YCTD/HĐ. Mỗi item: key (tên), value (giá trị), note (mô tả thêm).",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "key",
                      label: "Tên thuộc tính",
                      type: "text",
                      required: true,
                      admin: {
                        width: "30%",
                        placeholder: "vd: Phụ cấp ăn, Loại visa, Bảo hiểm",
                      },
                    },
                    {
                      name: "value",
                      label: "Giá trị",
                      type: "text",
                      required: true,
                      admin: { width: "40%" },
                    },
                    {
                      name: "note",
                      label: "Ghi chú",
                      type: "text",
                      admin: { width: "30%" },
                    },
                  ],
                },
              ],
            },
          ],
        },

        {
          label: "Tiến độ",
          fields: [
            {
              name: "status",
              label: "Bước hiện tại",
              type: "select",
              required: true,
              defaultValue: "w1",
              options: [
                { label: "W1 — Tuyển dụng", value: "w1" },
                { label: "W2 — Khám sức khoẻ", value: "w2" },
                { label: "W3 — Đào tạo", value: "w3" },
                { label: "W4 — Phỏng vấn đối tác", value: "w4" },
                { label: "W5 — Ký hợp đồng", value: "w5" },
                { label: "W6 — Xin visa", value: "w6" },
                { label: "W7 — Xuất cảnh", value: "w7" },
                { label: "W8 — Quản lý sau xuất cảnh", value: "w8" },
                { label: "✅ Hoàn thành", value: "done" },
                { label: "⏸ Tạm dừng", value: "paused" },
                { label: "❌ Huỷ", value: "cancelled" },
              ],
            },
            {
              name: "assignedTo",
              label: "Phụ trách bước hiện tại",
              type: "relationship",
              relationTo: "users",
            },
            {
              name: "workflow",
              label: "Workflow áp dụng",
              type: "relationship",
              relationTo: "workflows",
              admin: { description: "Bỏ trống = workflow mặc định" },
            },
            {
              type: "row",
              fields: [
                {
                  name: "stageStartedAt",
                  label: "Vào bước hiện tại lúc",
                  type: "date",
                  admin: {
                    width: "50%",
                    readOnly: true,
                    date: { pickerAppearance: "dayAndTime" },
                  },
                },
                {
                  name: "expectedStageEndAt",
                  label: "Hạn dự kiến bước này",
                  type: "date",
                  admin: {
                    width: "50%",
                    date: { pickerAppearance: "dayOnly" },
                  },
                },
              ],
            },
            {
              name: "remindersSent",
              label: "Đã gửi nhắc",
              type: "array",
              admin: {
                readOnly: true,
                description: "Cron worker dùng để dedupe",
                initCollapsed: true,
              },
              fields: [
                { name: "stageCode", type: "text" },
                { name: "atDay", type: "number" },
                { name: "kind", type: "text" },
                { name: "sentAt", type: "date" },
              ],
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
};
