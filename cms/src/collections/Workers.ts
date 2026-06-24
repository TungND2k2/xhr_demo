import type { CollectionConfig } from "payload";
import { generateWorkerCode } from "../hooks/workers/generate-code";
import { trackStatusChangesBefore, trackStatusChangesAfter } from "../hooks/workers/track-status-changes";
import { makeSyncMediaBacklinks, makeRemoveAllMediaBacklinks } from "../hooks/shared/sync-media-backlinks";
import { accessReadScoped, accessCreate, accessUpdate, accessDelete } from "../utilities/role-access";

const extractWorkerMedia = (doc: any) => [
  doc?.passportScan,
  doc?.nationalIdScan,
  doc?.photo,
  doc?.cvFile,
  doc?.healthCertFile,
  ...(Array.isArray(doc?.documents) ? doc.documents.map((d: any) => d?.file) : []),
];

/**
 * Workers — người lao động đăng ký XKLĐ.
 *
 * Vòng đời: new → screening → training → ready → contracted → deployed
 * → returned (về nước hết HĐ) hoặc blacklisted (vi phạm).
 *
 * 1 worker có thể ứng tuyển nhiều `orders` (qua `order_workers`) trước khi
 * ký được `contracts`.
 */
export const Workers: CollectionConfig = {
  slug: "workers",
  labels: { singular: "Người lao động", plural: "Người lao động" },
  admin: {
    useAsTitle: "displayName",
    defaultColumns: [
      "workerCode",
      "fullName",
      "dob",
      "phone",
      "status",
      "recruitedBy",
    ],
    group: "Tuyển dụng",
  },
  access: {
    read: accessReadScoped("workers"),
    create: accessCreate("workers", ["admin", "manager", "recruiter"]),
    update: accessUpdate("workers", ["admin", "manager", "recruiter", "trainer"]),
    delete: accessDelete("workers", ["admin"]),
  },
  hooks: {
    beforeChange: [generateWorkerCode, trackStatusChangesBefore],
    afterChange: [
      trackStatusChangesAfter,
      makeSyncMediaBacklinks({ ownerSlug: "workers", extract: extractWorkerMedia }),
    ],
    afterDelete: [
      makeRemoveAllMediaBacklinks({ ownerSlug: "workers", extract: extractWorkerMedia }),
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        // ── Hồ sơ cá nhân ──────────────────────────────────────
        {
          label: "Hồ sơ",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "workerCode",
                  label: "Mã LĐ",
                  type: "text",
                  unique: true,
                  admin: {
                    width: "33%",
                    readOnly: true,
                    description: "Tự sinh dạng LD-{seq}",
                  },
                },
                {
                  name: "fullName",
                  label: "Họ tên",
                  type: "text",
                  required: true,
                  admin: { width: "67%" },
                },
              ],
            },
            // displayName auto-generated cho dropdown
            {
              name: "displayName",
              type: "text",
              admin: { hidden: true },
              hooks: {
                beforeChange: [
                  ({ siblingData }) =>
                    `${siblingData?.fullName ?? "?"} (${siblingData?.workerCode ?? "—"})`,
                ],
              },
            },
            {
              type: "row",
              fields: [
                {
                  name: "dob",
                  label: "Ngày sinh",
                  type: "date",
                  required: true,
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "gender",
                  label: "Giới tính",
                  type: "select",
                  required: true,
                  options: [
                    { label: "Nam", value: "male" },
                    { label: "Nữ", value: "female" },
                    { label: "Khác", value: "other" },
                  ],
                  admin: { width: "33%" },
                },
                {
                  name: "maritalStatus",
                  label: "Tình trạng hôn nhân",
                  type: "select",
                  options: [
                    { label: "Độc thân", value: "single" },
                    { label: "Đã kết hôn", value: "married" },
                    { label: "Khác", value: "other" },
                  ],
                  admin: { width: "33%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "phone",
                  label: "Số điện thoại",
                  type: "text",
                  required: true,
                  admin: { width: "33%" },
                },
                {
                  name: "email",
                  label: "Email",
                  type: "email",
                  admin: { width: "33%" },
                },
                {
                  name: "telegramUserId",
                  label: "Telegram ID",
                  type: "text",
                  admin: { width: "33%", description: "Số (không phải @username)" },
                },
              ],
            },
            {
              name: "hometown",
              label: "Quê quán",
              type: "text",
            },
            {
              name: "address",
              label: "Địa chỉ thường trú",
              type: "textarea",
            },
            {
              type: "row",
              fields: [
                {
                  name: "height",
                  label: "Chiều cao (cm)",
                  type: "number",
                  admin: { width: "33%" },
                },
                {
                  name: "weight",
                  label: "Cân nặng (kg)",
                  type: "number",
                  admin: { width: "33%" },
                },
                {
                  name: "education",
                  label: "Trình độ học vấn",
                  type: "select",
                  options: [
                    { label: "Tiểu học", value: "primary" },
                    { label: "THCS", value: "secondary" },
                    { label: "THPT", value: "highschool" },
                    { label: "Trung cấp", value: "vocational" },
                    { label: "Cao đẳng", value: "college" },
                    { label: "Đại học", value: "university" },
                    { label: "Trên ĐH", value: "postgrad" },
                  ],
                  admin: { width: "33%" },
                },
              ],
            },
          ],
        },

        // ── Giấy tờ ────────────────────────────────────────────
        {
          label: "Giấy tờ",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "nationalId",
                  label: "CCCD/CMND",
                  type: "text",
                  unique: true,
                  admin: { width: "50%" },
                },
                {
                  name: "nationalIdIssuedAt",
                  label: "Ngày cấp CCCD",
                  type: "date",
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "passportNo",
                  label: "Số hộ chiếu",
                  type: "text",
                  admin: { width: "33%" },
                },
                {
                  name: "passportIssuedAt",
                  label: "Ngày cấp",
                  type: "date",
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "passportExpiry",
                  label: "Ngày hết hạn",
                  type: "date",
                  admin: { width: "34%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              name: "passportScan",
              label: "Scan hộ chiếu",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "nationalIdScan",
              label: "Scan CCCD",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "photo",
              label: "Ảnh chân dung",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "cvFile",
              label: "CV / Sơ yếu lý lịch",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "documents",
              label: "Giấy tờ khác",
              type: "array",
              fields: [
                { name: "kind", type: "text", label: "Loại giấy tờ", required: true },
                { name: "file", type: "upload", relationTo: "media", required: true },
                { name: "notes", type: "text" },
              ],
            },
          ],
        },

        // ── Năng lực ───────────────────────────────────────────
        {
          label: "Năng lực",
          fields: [
            {
              name: "languages",
              label: "Ngoại ngữ",
              type: "array",
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "code",
                      label: "Ngôn ngữ",
                      type: "select",
                      required: true,
                      options: [
                        { label: "Tiếng Nhật", value: "ja" },
                        { label: "Tiếng Anh", value: "en" },
                        { label: "Tiếng Hàn", value: "ko" },
                        { label: "Tiếng Trung", value: "zh" },
                        { label: "Tiếng Đức", value: "de" },
                        { label: "Khác", value: "other" },
                      ],
                      admin: { width: "33%" },
                    },
                    {
                      name: "level",
                      label: "Trình độ",
                      type: "select",
                      options: [
                        { label: "N5 / A1", value: "n5_a1" },
                        { label: "N4 / A2", value: "n4_a2" },
                        { label: "N3 / B1", value: "n3_b1" },
                        { label: "N2 / B2", value: "n2_b2" },
                        { label: "N1 / C1", value: "n1_c1" },
                        { label: "Native / C2", value: "c2" },
                      ],
                      admin: { width: "33%" },
                    },
                    {
                      name: "certificate",
                      label: "Chứng chỉ",
                      type: "text",
                      admin: { width: "34%", placeholder: "JLPT N3 (12/2025)" },
                    },
                  ],
                },
              ],
            },
            {
              name: "skills",
              label: "Kỹ năng nghề",
              type: "array",
              admin: { description: "Vd: Hàn 6G, Lái xe nâng, Điều dưỡng cơ bản, May công nghiệp..." },
              fields: [
                { name: "name", type: "text", required: true, label: "Kỹ năng" },
                {
                  name: "yearsExp",
                  label: "Số năm kinh nghiệm",
                  type: "number",
                  min: 0,
                },
                {
                  name: "level",
                  type: "select",
                  options: [
                    { label: "Cơ bản", value: "basic" },
                    { label: "Trung cấp", value: "intermediate" },
                    { label: "Thành thạo", value: "advanced" },
                  ],
                },
              ],
            },
            {
              name: "experience",
              label: "Kinh nghiệm làm việc",
              type: "array",
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "company", type: "text", required: true, admin: { width: "40%" } },
                    { name: "position", type: "text", admin: { width: "30%" } },
                    {
                      name: "fromYear",
                      type: "number",
                      label: "Từ năm",
                      admin: { width: "15%" },
                    },
                    {
                      name: "toYear",
                      type: "number",
                      label: "Đến năm",
                      admin: { width: "15%" },
                    },
                  ],
                },
                { name: "description", type: "textarea", label: "Mô tả công việc" },
              ],
            },
          ],
        },

        // ── Sức khoẻ ──────────────────────────────────────────
        {
          label: "Sức khoẻ",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "healthStatus",
                  label: "Tình trạng",
                  type: "select",
                  defaultValue: "pending",
                  options: [
                    { label: "⏳ Chưa khám", value: "pending" },
                    { label: "📅 Đã đặt lịch", value: "scheduled" },
                    { label: "✅ Đạt", value: "pass" },
                    { label: "❌ Không đạt", value: "fail" },
                    { label: "🔁 Khám lại", value: "retest" },
                  ],
                  admin: { width: "33%" },
                },
                {
                  name: "healthCheckDate",
                  label: "Ngày khám",
                  type: "date",
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "healthCheckLocation",
                  label: "Cơ sở khám",
                  type: "text",
                  admin: { width: "34%" },
                },
              ],
            },
            {
              name: "healthCertFile",
              label: "Giấy khám SK",
              type: "upload",
              relationTo: "media",
            },
            {
              name: "healthNotes",
              label: "Ghi chú sức khoẻ",
              type: "textarea",
              admin: { description: "Bệnh nền, dị ứng, hạn chế thị lực..." },
            },
          ],
        },

        // ── Đào tạo ──────────────────────────────────────────
        {
          label: "Đào tạo",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "trainingGroup",
                  label: "Lớp/Nhóm đào tạo",
                  type: "text",
                  admin: { width: "50%", placeholder: "vd: Lớp N4-2024-A" },
                },
                {
                  name: "trainingStartDate",
                  label: "Ngày vào lớp",
                  type: "date",
                  admin: { width: "25%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "trainingEndDate",
                  label: "Ngày kết thúc",
                  type: "date",
                  admin: { width: "25%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              name: "trainingAttendance",
              label: "Điểm danh",
              type: "array",
              labels: { singular: "Buổi", plural: "Buổi" },
              admin: {
                description: "Mỗi buổi 1 dòng. Có thể export Excel báo cáo lớp.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "date", label: "Ngày", type: "date", required: true, admin: { width: "30%", date: { pickerAppearance: "dayOnly" } } },
                    {
                      name: "status",
                      label: "Trạng thái",
                      type: "select",
                      required: true,
                      options: [
                        { label: "✅ Có mặt", value: "present" },
                        { label: "❌ Vắng có phép", value: "excused" },
                        { label: "🚫 Vắng không phép", value: "absent" },
                        { label: "🤒 Ốm", value: "sick" },
                      ],
                      admin: { width: "30%" },
                    },
                    { name: "note", label: "Ghi chú", type: "text", admin: { width: "40%" } },
                  ],
                },
              ],
            },
          ],
        },

        // ── Trạng thái ────────────────────────────────────────
        {
          label: "Trạng thái",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "market",
                  label: "Thị trường XKLĐ",
                  type: "select",
                  options: [
                    { label: "🇯🇵 Nhật Bản", value: "jp" },
                    { label: "🇰🇷 Hàn Quốc", value: "kr" },
                    { label: "🇹🇼 Đài Loan", value: "tw" },
                    { label: "🇩🇪 Đức", value: "de" },
                    { label: "🇸🇦 Trung Đông", value: "me" },
                    { label: "🇪🇺 EU khác", value: "eu" },
                    { label: "Khác", value: "other" },
                  ],
                  admin: {
                    width: "30%",
                    description: "Filter nhanh không cần join OrderWorkers",
                  },
                },
                {
                  name: "agreedAt",
                  label: "Đồng ý tham gia lúc",
                  type: "date",
                  admin: {
                    width: "70%",
                    date: { pickerAppearance: "dayAndTime" },
                    description: "Auto-set khi status → 'agreed' (track SLA W1)",
                    readOnly: true,
                  },
                },
              ],
            },
            {
              name: "status",
              label: "Trạng thái vòng đời",
              type: "select",
              required: true,
              defaultValue: "new",
              options: [
                { label: "🆕 Mới đăng ký", value: "new" },
                { label: "🔍 Đang tìm hiểu (nguồn)", value: "researching" },
                { label: "✋ Đồng ý tham gia", value: "agreed" },
                { label: "🏥 Đang khám SK", value: "health_check" },
                { label: "💰 Đã đặt cọc", value: "deposit_paid" },
                { label: "🎓 Đang đào tạo", value: "training" },
                { label: "🎯 Đang thi tuyển", value: "exam" },
                { label: "✅ Đỗ — sẵn sàng", value: "passed" },
                { label: "❌ Trượt", value: "failed" },
                { label: "📝 Đã ký HĐ", value: "contracted" },
                { label: "🛂 Đang xin visa", value: "visa_prep" },
                { label: "✈️ Đã xuất cảnh", value: "deployed" },
                { label: "💼 Đang làm việc tại NN", value: "working" },
                { label: "🏠 Đã về nước", value: "returned" },
                { label: "⛔ Khoá tạm", value: "paused" },
                { label: "🚫 Blacklist", value: "blacklisted" },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "examResult",
                  label: "Kết quả thi tuyển",
                  type: "select",
                  options: [
                    { label: "⏳ Chưa thi", value: "pending" },
                    { label: "✅ Đỗ", value: "pass" },
                    { label: "❌ Trượt", value: "fail" },
                  ],
                  admin: {
                    width: "30%",
                    description: 'Set sau khi LĐ thi tuyển bước W4 (Phỏng vấn đối tác).',
                  },
                },
                {
                  name: "examScore",
                  label: "Điểm",
                  type: "number",
                  admin: {
                    width: "20%",
                    description: "Nếu có điểm số cụ thể",
                  },
                },
                {
                  name: "failureReason",
                  label: "Lý do trượt",
                  type: "textarea",
                  admin: {
                    width: "50%",
                    description:
                      'Chỉ điền khi examResult=fail. Để admin biết lý do tránh lặp lại với LĐ khác.',
                    condition: (data) => data?.examResult === "fail",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "office",
                  label: "Văn phòng phụ trách",
                  type: "relationship",
                  relationTo: "offices",
                  filterOptions: () => ({ active: { equals: true } }),
                  admin: {
                    width: "50%",
                    description:
                      "Văn phòng TLG đang quản lý LĐ này. LĐ tự chọn trong form đăng ký, admin có thể đổi sau.",
                  },
                },
                {
                  name: "recruitedAt",
                  label: "Ngày tiếp nhận",
                  type: "date",
                  defaultValue: () => new Date().toISOString(),
                  admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "recruitedBy",
                  label: "Người tuyển",
                  type: "relationship",
                  relationTo: "users",
                  filterOptions: () => ({
                    role: { in: ["recruiter", "manager", "admin"] },
                  }),
                  admin: { width: "50%" },
                },
                {
                  name: "createdByUser",
                  label: "Người nhập dữ liệu",
                  type: "relationship",
                  relationTo: "users",
                  admin: {
                    width: "50%",
                    readOnly: true,
                    description:
                      "Tự ghi nhận khi tạo (admin sửa hồ sơ sau không thay đổi). Dùng cho audit log.",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "depositAmount",
                  label: "Tiền đặt cọc (VND)",
                  type: "number",
                  admin: {
                    width: "33%",
                    placeholder: "vd: 30000000",
                    description: "Cọc ràng buộc LĐ đi học/đi XKLĐ. Hoàn lại khi xuất cảnh / khi trượt.",
                  },
                },
                {
                  name: "depositDate",
                  label: "Ngày nộp cọc",
                  type: "date",
                  admin: {
                    width: "33%",
                    date: { pickerAppearance: "dayOnly" },
                  },
                },
                {
                  name: "depositRefundedAt",
                  label: "Ngày hoàn cọc",
                  type: "date",
                  admin: {
                    width: "34%",
                    date: { pickerAppearance: "dayOnly" },
                    description:
                      "Hoàn cọc khi LĐ trượt / huỷ / xuất cảnh thành công. Để trống nếu chưa hoàn.",
                  },
                },
              ],
            },
            {
              name: "depositNote",
              label: "Ghi chú đặt cọc",
              type: "textarea",
              admin: {
                rows: 2,
                description: "Vd: 'Nộp đợt 1 15tr ngày 10/05, đợt 2 15tr ngày 25/05'",
              },
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
