import type { CollectionConfig } from "payload";
import { makeSyncMediaBacklinks, makeRemoveAllMediaBacklinks } from "../hooks/shared/sync-media-backlinks";
import { accessRead, accessCreate, accessUpdate, accessDelete } from "../utilities/role-access";

const extractSupplyContractMedia = (doc: any) => [
  doc?.media,
  doc?.cucApprovalDoc,
  ...(Array.isArray(doc?.addendums) ? doc.addendums.map((a: any) => a?.file) : []),
];

/**
 * SupplyContracts (HĐCU — Hợp đồng cung ứng lao động).
 *
 * Hợp đồng khung giữa TLG (Bên cung ứng / 送出機関) và 1 đối tác nước
 * ngoài (Nghiệp đoàn / 監理団体). KHÔNG phải đơn tuyển cụ thể.
 *
 * Mỗi đợt tuyển cụ thể (số người, vị trí, lương, deadline) được TLG +
 * đối tác ký riêng dạng "Thư yêu cầu tuyển dụng" (求人依頼書 / Thư YCTD)
 * → Order collection.
 *
 * Quan hệ: 1 Partner có 1+ SupplyContract (ký lại / gia hạn).
 *          1 SupplyContract có 1+ Order (mỗi đợt YCTD).
 *
 * Tool MCP `extract_supply_contract` cho AI đọc Media.extractedText →
 * parse JSON → fill các field này.
 */
export const SupplyContracts: CollectionConfig = {
  slug: "supply-contracts",
  labels: { singular: "Hợp đồng cung ứng", plural: "Hợp đồng cung ứng" },
  admin: {
    group: "Tuyển dụng",
    useAsTitle: "contractNumber",
    defaultColumns: [
      "contractNumber",
      "signedDate",
      "partner",
      "status",
      "tlgRep",
      "partnerRep",
    ],
    description:
      "HĐ khung TLG ↔ Đối tác. Chi tiết đơn cụ thể lưu ở Đơn tuyển (Orders).",
  },
  access: {
    read: accessRead("supply-contracts"),
    create: accessCreate("supply-contracts", ["admin", "manager", "recruiter"]),
    update: accessUpdate("supply-contracts", ["admin", "manager", "recruiter"]),
    delete: accessDelete("supply-contracts", ["admin"]),
  },
  hooks: {
    afterChange: [
      makeSyncMediaBacklinks({ ownerSlug: "supply-contracts", extract: extractSupplyContractMedia }),
    ],
    afterDelete: [
      makeRemoveAllMediaBacklinks({ ownerSlug: "supply-contracts", extract: extractSupplyContractMedia }),
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
                  name: "contractNumber",
                  label: "Số HĐ",
                  type: "text",
                  required: true,
                  unique: true,
                  index: true,
                  admin: { width: "33%", placeholder: "vd: HĐCU-2022-001" },
                },
                {
                  name: "signedDate",
                  label: "Ngày ký",
                  type: "date",
                  required: true,
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "programType",
                  label: "Chương trình XKLĐ",
                  type: "select",
                  required: true,
                  defaultValue: "other",
                  options: [
                    { label: "TTKN — Thực tập kỹ năng", value: "ttkn" },
                    { label: "KNĐĐ — Kỹ năng đặc định", value: "kndd" },
                    { label: "LĐKT — Lao động kỹ thuật", value: "ldkt" },
                    { label: "Khác", value: "other" },
                  ],
                  admin: {
                    width: "34%",
                    description: "1 partner + 1 programType = 1 HĐ gốc. Cùng partner khác chương trình → HĐ riêng.",
                  },
                },
              ],
            },
            {
              name: "status",
              label: "Trạng thái",
              type: "select",
              required: true,
              defaultValue: "active",
              options: [
                { label: "✅ Đang hiệu lực", value: "active" },
                { label: "⏰ Hết hạn", value: "expired" },
                { label: "❌ Chấm dứt", value: "terminated" },
                { label: "📄 Đã ký lại / thay bằng HĐ mới", value: "superseded" },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "effectiveDate",
                  label: "Ngày hiệu lực",
                  type: "date",
                  admin: {
                    width: "50%",
                    date: { pickerAppearance: "dayOnly" },
                    description: "Bỏ trống nếu = ngày ký",
                  },
                },
                {
                  name: "expiryDate",
                  label: "Ngày hết hạn",
                  type: "date",
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              name: "partner",
              label: "Đối tác",
              type: "relationship",
              relationTo: "partners",
              required: true,
              admin: {
                description: "Bên Tiếp nhận / 監理団体. Tool extract sẽ tự tạo Partner nếu chưa có.",
              },
            },
            {
              name: "media",
              label: "File scan HĐ",
              type: "relationship",
              relationTo: "media",
              admin: { description: "Bản scan PDF gốc đã upload" },
            },
            {
              name: "responsibleEmployee",
              label: "Cán bộ phụ trách",
              type: "relationship",
              relationTo: "employees",
              admin: {
                description:
                  "Cán bộ TLG phụ trách HĐ này — đăng ký Cục, theo dõi tiến độ chấp thuận. Mặc định: A Long (Cán bộ Cục QLLĐNN).",
              },
            },
          ],
        },
        {
          label: "Cục QLLĐNN",
          description:
            "Theo dõi đăng ký + chấp thuận của Cục Quản lý Lao động Ngoài nước. CÓ chấp thuận thì Order mới được active.",
          fields: [
            {
              name: "cucApprovalStatus",
              label: "Trạng thái Cục",
              type: "select",
              required: true,
              defaultValue: "not_required",
              options: [
                { label: "— Không yêu cầu (HĐ cũ / nội bộ)", value: "not_required" },
                { label: "📝 Chưa đăng ký", value: "not_submitted" },
                { label: "⏳ Đã đăng ký, chờ phản hồi", value: "pending" },
                { label: "✅ Đã chấp thuận", value: "approved" },
                { label: "❌ Bị từ chối", value: "rejected" },
                { label: "🔄 Yêu cầu bổ sung", value: "needs_revision" },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "cucRegistrationDate",
                  label: "Ngày đăng ký Cục",
                  type: "date",
                  admin: {
                    width: "50%",
                    date: { pickerAppearance: "dayOnly" },
                    description: "Ngày TLG nộp hồ sơ lên Cục QLLĐNN",
                  },
                },
                {
                  name: "cucResponseDate",
                  label: "Ngày Cục phản hồi",
                  type: "date",
                  admin: {
                    width: "50%",
                    date: { pickerAppearance: "dayOnly" },
                    description: "Ngày nhận được chấp thuận / từ chối / yêu cầu bổ sung",
                  },
                },
              ],
            },
            {
              name: "cucApprovalDoc",
              label: "Văn bản Cục",
              type: "relationship",
              relationTo: "media",
              admin: {
                description: "Scan công văn chấp thuận / phúc đáp từ Cục QLLĐNN",
              },
            },
            {
              name: "cucNotes",
              label: "Ghi chú trao đổi với Cục",
              type: "textarea",
              admin: {
                rows: 3,
                description:
                  "Vd: 'Cục yêu cầu bổ sung phụ lục lương ngày 15/05; đã nộp lại 20/05'",
              },
            },
          ],
        },
        {
          label: "Bên cung ứng (TLG)",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "tlgRep",
                  label: "Người đại diện",
                  type: "group",
                  admin: { width: "60%" },
                  fields: [
                    {
                      type: "row",
                      fields: [
                        { name: "name", label: "Họ tên", type: "text", admin: { width: "60%" } },
                        { name: "position", label: "Chức vụ", type: "text", admin: { width: "40%", placeholder: "Chủ tịch HĐQT" } },
                      ],
                    },
                  ],
                },
                {
                  name: "tlgLicenseNo",
                  label: "Số GP XKLĐ",
                  type: "text",
                  admin: { width: "20%", placeholder: "1174/LĐTBXH-GP" },
                },
                {
                  name: "tlgLicenseDate",
                  label: "Ngày cấp GP",
                  type: "date",
                  admin: { width: "20%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
          ],
        },
        {
          label: "Bên tiếp nhận",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "partnerRep",
                  label: "Người đại diện",
                  type: "group",
                  admin: { width: "60%" },
                  fields: [
                    {
                      type: "row",
                      fields: [
                        { name: "name", label: "Họ tên", type: "text", admin: { width: "60%" } },
                        { name: "position", label: "Chức vụ", type: "text", admin: { width: "40%", placeholder: "Đại diện / 代表理事" } },
                      ],
                    },
                  ],
                },
                {
                  name: "partnerLicenseNo",
                  label: "Số GP giám lý",
                  type: "text",
                  admin: { width: "40%", placeholder: "vd: 1804000092" },
                },
              ],
            },
            {
              name: "partnerBankAccount",
              label: "Tài khoản NH đối tác",
              type: "group",
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "holder", label: "Chủ TK", type: "text", admin: { width: "50%" } },
                    { name: "number", label: "Số TK", type: "text", admin: { width: "50%" } },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    { name: "bank", label: "Ngân hàng", type: "text", admin: { width: "40%" } },
                    { name: "branch", label: "Chi nhánh", type: "text", admin: { width: "40%" } },
                    { name: "swift", label: "SWIFT", type: "text", admin: { width: "20%" } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Điều khoản",
          fields: [
            {
              name: "terms",
              label: "Điều khoản chính",
              type: "group",
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "durationMonths",
                      label: "Thời hạn (tháng)",
                      type: "number",
                      admin: {
                        width: "33%",
                        description: "Tổng thời gian thực tập (vd 36 = 3 năm, 60 = 5 năm)",
                      },
                    },
                    {
                      name: "weeklyHours",
                      label: "Giờ/tuần",
                      type: "number",
                      defaultValue: 40,
                      admin: { width: "33%" },
                    },
                    {
                      name: "leaveDaysPerYear",
                      label: "Ngày phép/năm",
                      type: "number",
                      defaultValue: 10,
                      admin: { width: "34%" },
                    },
                  ],
                },
                {
                  name: "salaryNote",
                  label: "Lương (mô tả)",
                  type: "textarea",
                  admin: {
                    rows: 2,
                    placeholder: 'vd: "Theo Thư YCTD; trợ cấp đào tạo 1 tháng đầu theo chuẩn người Nhật"',
                  },
                },
                {
                  name: "serviceFeeNote",
                  label: "Phí dịch vụ (mô tả)",
                  type: "textarea",
                  admin: { rows: 2 },
                },
                {
                  name: "additionalTerms",
                  label: "Điều khoản đặc biệt",
                  type: "textarea",
                  admin: { rows: 4 },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "addendums",
      label: "Phụ lục HĐ (PLHD)",
      type: "array",
      labels: { singular: "Phụ lục", plural: "Phụ lục" },
      admin: {
        description:
          "Phụ lục bổ sung / sửa đổi HĐ gốc. Mỗi lần ký phụ lục → thêm 1 hàng. Ngày ký + scan + tóm tắt thay đổi.",
      },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "addendumNumber",
              label: "Số PLHD",
              type: "text",
              admin: { width: "20%", placeholder: "vd: PLHD-01" },
            },
            {
              name: "signedDate",
              label: "Ngày ký",
              type: "date",
              required: true,
              admin: { width: "20%", date: { pickerAppearance: "dayOnly" } },
            },
            {
              name: "file",
              label: "Scan PLHD",
              type: "relationship",
              relationTo: "media",
              admin: { width: "30%" },
            },
            {
              name: "changes",
              label: "Tóm tắt thay đổi",
              type: "text",
              admin: { width: "30%", placeholder: "vd: Gia hạn 3 năm" },
            },
          ],
        },
        {
          name: "notes",
          label: "Ghi chú",
          type: "textarea",
          admin: { rows: 2 },
        },
      ],
    },
    {
      name: "notes",
      label: "Ghi chú nội bộ",
      type: "textarea",
      admin: { rows: 3 },
    },
    {
      name: "extractedFromText",
      label: "Trích nguyên văn (debug)",
      type: "textarea",
      admin: {
        rows: 4,
        readOnly: true,
        description: "Đoạn text gốc tool extract đã đọc. Để dev kiểm tra parse có đúng không.",
      },
    },
  ],
};
