import type { CollectionConfig } from "payload";
import { makeSyncMediaBacklinks, makeRemoveAllMediaBacklinks } from "../hooks/shared/sync-media-backlinks";
import { checkAssetsOnResignation } from "../hooks/employees/check-assets-on-resignation";
import { accessRead, accessCreate, accessUpdate, accessDelete } from "../utilities/role-access";

const extractEmployeeMedia = (doc: any) => [doc?.photo];

/**
 * Employees — nhân sự nội bộ Thịnh Long (KHÁC Users là account login, KHÁC
 * Workers là LĐ XKLĐ đi nước ngoài).
 *
 * Lưu profile HR đầy đủ: thông tin cá nhân, vị trí công việc, hợp đồng LĐ
 * với TLG, lương, lịch sử công tác, kỷ luật-khen thưởng.
 *
 * Optional link `userAccount` → Users (nếu nhân viên có quyền login portal).
 */
export const Employees: CollectionConfig = {
  slug: "employees",
  labels: { singular: "Nhân sự", plural: "Nhân sự" },
  admin: {
    group: "Hành chính",
    useAsTitle: "fullName",
    defaultColumns: ["employeeCode", "fullName", "department", "position", "status"],
    description:
      "Hồ sơ nhân sự nội bộ Thịnh Long. Khác Users (account login) và Workers (LĐ XKLĐ).",
  },
  access: {
    read: accessRead("employees"),
    create: accessCreate("employees", ["admin", "manager"]),
    update: accessUpdate("employees", ["admin", "manager"]),
    delete: accessDelete("employees", ["admin"]),
  },
  hooks: {
    afterChange: [
      makeSyncMediaBacklinks({ ownerSlug: "employees", extract: extractEmployeeMedia }),
      checkAssetsOnResignation,
    ],
    afterDelete: [
      makeRemoveAllMediaBacklinks({ ownerSlug: "employees", extract: extractEmployeeMedia }),
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Hồ sơ cơ bản",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "employeeCode",
                  label: "Mã NV",
                  type: "text",
                  required: true,
                  unique: true,
                  index: true,
                  admin: { width: "30%", placeholder: "EMP-001" },
                },
                {
                  name: "fullName",
                  label: "Họ tên đầy đủ",
                  type: "text",
                  required: true,
                  admin: { width: "70%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "dateOfBirth",
                  label: "Ngày sinh",
                  type: "date",
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "gender",
                  label: "Giới tính",
                  type: "select",
                  options: [
                    { label: "Nam", value: "male" },
                    { label: "Nữ", value: "female" },
                    { label: "Khác", value: "other" },
                  ],
                  admin: { width: "33%" },
                },
                {
                  name: "idNumber",
                  label: "CCCD / CMND",
                  type: "text",
                  admin: { width: "34%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                { name: "phone", label: "SĐT", type: "text", admin: { width: "33%" } },
                { name: "email", label: "Email cá nhân", type: "text", admin: { width: "33%" } },
                {
                  name: "telegramUserId",
                  label: "Telegram User ID",
                  type: "text",
                  admin: { width: "34%" },
                },
              ],
            },
            {
              name: "address",
              label: "Địa chỉ thường trú",
              type: "textarea",
              admin: { rows: 2 },
            },
            {
              name: "photo",
              label: "Ảnh chân dung",
              type: "relationship",
              relationTo: "media",
              admin: { description: "Ảnh thẻ / chân dung" },
            },
          ],
        },
        {
          label: "Công việc",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "department",
                  label: "Phòng ban",
                  type: "select",
                  required: true,
                  options: [
                    { label: "🏢 Hành chính - Nhân sự", value: "hcns" },
                    { label: "🧑‍💼 Tuyển dụng", value: "tuyendung" },
                    { label: "🎓 Đào tạo", value: "daotao" },
                    { label: "🛂 Visa - Hồ sơ", value: "visa" },
                    { label: "💰 Kế toán", value: "ketoan" },
                    { label: "🏥 Y tế", value: "yte" },
                    { label: "🇯🇵 Phòng Nhật Bản", value: "phong_jp" },
                    { label: "🇰🇷 Phòng Hàn Quốc", value: "phong_kr" },
                    { label: "🇹🇼 Phòng Đài Loan", value: "phong_tw" },
                    { label: "🇩🇪 Phòng Đức", value: "phong_de" },
                    { label: "👑 Ban Giám đốc", value: "bgd" },
                    { label: "Khác", value: "other" },
                  ],
                  admin: { width: "50%" },
                },
                {
                  name: "position",
                  label: "Chức vụ",
                  type: "text",
                  required: true,
                  admin: { width: "50%", placeholder: "vd: Trưởng phòng / Chuyên viên / GĐ" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "manager",
                  label: "Quản lý trực tiếp",
                  type: "relationship",
                  relationTo: "employees",
                  admin: { width: "50%" },
                },
                {
                  name: "userAccount",
                  label: "Account login (nếu có)",
                  type: "relationship",
                  relationTo: "users",
                  admin: {
                    width: "50%",
                    description: "Link với account Users nếu nhân viên có quyền login portal.",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "hireDate",
                  label: "Ngày vào làm",
                  type: "date",
                  admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
                },
                {
                  name: "contractType",
                  label: "Loại HĐLĐ",
                  type: "select",
                  options: [
                    { label: "Thử việc", value: "probation" },
                    { label: "Xác định thời hạn", value: "fixed" },
                    { label: "Không xác định thời hạn", value: "indefinite" },
                    { label: "Cộng tác viên", value: "contractor" },
                    { label: "Thực tập sinh", value: "intern" },
                  ],
                  admin: { width: "33%" },
                },
                {
                  name: "contractEndDate",
                  label: "Hết hạn HĐ",
                  type: "date",
                  admin: { width: "34%", date: { pickerAppearance: "dayOnly" } },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "status",
                  label: "Trạng thái",
                  type: "select",
                  required: true,
                  defaultValue: "working",
                  options: [
                    { label: "✅ Đang làm việc", value: "working" },
                    { label: "🌴 Nghỉ phép dài hạn", value: "long_leave" },
                    { label: "🤰 Thai sản", value: "maternity" },
                    { label: "📤 Đã nghỉ việc", value: "resigned" },
                    { label: "❌ Sa thải", value: "fired" },
                    { label: "⏸ Tạm hoãn", value: "suspended" },
                  ],
                  admin: { width: "50%" },
                },
                {
                  name: "salary",
                  label: "Lương (VND/tháng)",
                  type: "number",
                  admin: { width: "50%", placeholder: "15000000" },
                },
              ],
            },
          ],
        },
        {
          label: "Lịch sử & ghi chú",
          fields: [
            {
              name: "workHistory",
              label: "Lịch sử công tác trước TLG",
              type: "array",
              labels: { singular: "Vị trí cũ", plural: "Vị trí cũ" },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "company", label: "Công ty", type: "text", admin: { width: "40%" } },
                    { name: "position", label: "Chức vụ", type: "text", admin: { width: "30%" } },
                    { name: "fromTo", label: "Thời gian", type: "text", admin: { width: "30%", placeholder: "2018-2022" } },
                  ],
                },
              ],
            },
            {
              name: "achievements",
              label: "Khen thưởng - Kỷ luật",
              type: "array",
              labels: { singular: "Sự kiện", plural: "Sự kiện" },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "date", label: "Ngày", type: "date", admin: { width: "20%", date: { pickerAppearance: "dayOnly" } } },
                    {
                      name: "type",
                      label: "Loại",
                      type: "select",
                      options: [
                        { label: "🏆 Khen thưởng", value: "reward" },
                        { label: "⚠ Kỷ luật", value: "discipline" },
                        { label: "📈 Thăng chức", value: "promotion" },
                        { label: "📝 Khác", value: "other" },
                      ],
                      admin: { width: "20%" },
                    },
                    { name: "title", label: "Tiêu đề", type: "text", admin: { width: "60%" } },
                  ],
                },
                { name: "description", label: "Mô tả", type: "textarea", admin: { rows: 2 } },
              ],
            },
            {
              name: "extraFields",
              label: "Thông tin bổ sung",
              type: "array",
              labels: { singular: "Trường", plural: "Trường" },
              admin: {
                description:
                  "Các thông tin phụ không có sẵn trong schema (BHXH, MST, người liên hệ khẩn cấp, tài khoản NH, sở thích...). Mỗi item: key + value.",
              },
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "key",
                      label: "Tên trường",
                      type: "text",
                      required: true,
                      admin: { width: "30%", placeholder: "vd: bhxh, mst, emergencyContact" },
                    },
                    {
                      name: "value",
                      label: "Giá trị",
                      type: "text",
                      required: true,
                      admin: { width: "70%" },
                    },
                  ],
                },
              ],
            },
            {
              name: "notes",
              label: "Ghi chú",
              type: "textarea",
              admin: { rows: 4 },
            },
          ],
        },
      ],
    },
  ],
};
