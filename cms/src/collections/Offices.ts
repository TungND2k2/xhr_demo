import type { CollectionConfig } from "payload";
import { accessRead, accessCreate, accessUpdate, accessDelete } from "../utilities/role-access";

/**
 * Offices — văn phòng / chi nhánh của TLG. Mỗi LĐ thuộc 1 văn phòng phụ trách
 * (vd: Hà Nội, Nam Định, Hải Dương...).
 *
 * Khi LĐ điền form "Sơ yếu lý lịch thực tập sinh" sẽ thấy dropdown chọn văn
 * phòng từ collection này (chỉ hiện `active=true`). Admin tự CRUD trên CMS /
 * portal, không cần dev đụng vào.
 */
export const Offices: CollectionConfig = {
  slug: "offices",
  labels: { singular: "Văn phòng", plural: "Văn phòng" },
  admin: {
    group: "Hệ thống",
    useAsTitle: "name",
    defaultColumns: ["officeCode", "name", "country", "manager", "phone", "active"],
    description: "Văn phòng / chi nhánh TLG. LĐ chọn văn phòng phụ trách trong form đăng ký.",
  },
  access: {
    read: accessRead("offices"),
    create: accessCreate("offices", ["admin", "manager"]),
    update: accessUpdate("offices", ["admin", "manager"]),
    delete: accessDelete("offices", ["admin"]),
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "officeCode",
          label: "Mã văn phòng",
          type: "text",
          required: true,
          unique: true,
          index: true,
          admin: {
            width: "30%",
            placeholder: "vd: HN, ND, HD, TPHCM",
          },
        },
        {
          name: "name",
          label: "Tên văn phòng",
          type: "text",
          required: true,
          admin: {
            width: "70%",
            placeholder: "vd: Văn phòng Hà Nội",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "country",
          label: "Quốc gia",
          type: "select",
          required: true,
          defaultValue: "vn",
          options: [
            { label: "🇻🇳 Việt Nam", value: "vn" },
            { label: "🇯🇵 Nhật Bản", value: "jp" },
            { label: "🇰🇷 Hàn Quốc", value: "kr" },
            { label: "🇹🇼 Đài Loan", value: "tw" },
            { label: "🇩🇪 Đức", value: "de" },
            { label: "Khác", value: "other" },
          ],
          admin: { width: "50%" },
        },
        {
          name: "active",
          label: "Đang hoạt động",
          type: "checkbox",
          defaultValue: true,
          admin: {
            width: "50%",
            description: "Bỏ tick để ẩn khỏi dropdown trong form (không xoá dữ liệu cũ).",
          },
        },
      ],
    },
    {
      name: "address",
      label: "Địa chỉ",
      type: "textarea",
      admin: { rows: 2 },
    },
    {
      type: "row",
      fields: [
        {
          name: "phone",
          label: "SĐT",
          type: "text",
          admin: { width: "50%" },
        },
        {
          name: "email",
          label: "Email",
          type: "text",
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "manager",
      label: "Trưởng văn phòng",
      type: "relationship",
      relationTo: "employees",
      admin: {
        description: "Nhân viên phụ trách văn phòng này.",
      },
    },
    {
      name: "notes",
      label: "Ghi chú",
      type: "textarea",
      admin: { rows: 3 },
    },
  ],
};
