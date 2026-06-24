import type { CollectionConfig } from "payload";
import { accessRead, accessCreate, accessUpdate, accessDelete } from "../utilities/role-access";

/**
 * Partners — đối tác / xí nghiệp / công ty / chủ tàu nước ngoài mà TLG
 * ký HĐCU. Trước đây mỗi Order chỉ có 1 field text `employer` rời rạc;
 * giờ tách thành entity riêng để:
 *  - Lưu được full contact (Tên GĐ, Email, SĐT, Địa chỉ) — phục vụ xuất
 *    báo cáo "danh sách nghiệp đoàn".
 *  - Reuse cho nhiều Order (1 đối tác có nhiều đơn).
 *  - Tránh AI phải gọi get_orders 50+ lần để cố tìm contact.
 *
 * Tên (`name`) là unique — script dedupe sẽ gộp các Order cùng employer
 * thành 1 Partner. Field `aliases` lưu các biến thể tên (vd "J Front",
 * "JFront", "J-Front Co. Ltd") để AI tra cứu fuzzy.
 */
export const Partners: CollectionConfig = {
  slug: "partners",
  labels: { singular: "Đối tác", plural: "Đối tác" },
  admin: {
    group: "Tuyển dụng",
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "country",
      "directorName",
      "email",
      "phone",
      "active",
    ],
    description:
      "Đối tác nước ngoài (xí nghiệp / công ty / chủ tàu). Mỗi đối tác có thể có nhiều đơn (Orders).",
  },
  access: {
    read: accessRead("partners"),
    create: accessCreate("partners", ["admin", "manager", "recruiter"]),
    update: accessUpdate("partners", ["admin", "manager", "recruiter"]),
    delete: accessDelete("partners", ["admin"]),
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          label: "Tên công ty đối tác",
          type: "text",
          required: true,
          unique: true,
          index: true,
          admin: {
            width: "70%",
            description:
              "Tên đầy đủ. Ví dụ: J-Front Co.,Ltd / Aichi Gijutsu / Tokyo Kyodo Jim Center.",
          },
        },
        {
          name: "country",
          label: "Thị trường",
          type: "select",
          required: true,
          defaultValue: "jp",
          options: [
            { label: "🇯🇵 Nhật Bản", value: "jp" },
            { label: "🇰🇷 Hàn Quốc", value: "kr" },
            { label: "🇹🇼 Đài Loan", value: "tw" },
            { label: "🇩🇪 Đức", value: "de" },
            { label: "🇸🇦 Trung Đông", value: "me" },
            { label: "🇪🇺 EU khác", value: "eu" },
            { label: "Khác", value: "other" },
          ],
          admin: { width: "30%" },
        },
      ],
    },
    {
      name: "directorName",
      label: "Tên Giám đốc / Người đại diện",
      type: "text",
      admin: {
        placeholder: "vd: Yamada Taro / Mr. Kim Min-jun",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "email",
          label: "Email",
          type: "text",
          admin: { width: "50%", placeholder: "contact@partner.co.jp" },
        },
        {
          name: "phone",
          label: "Số điện thoại",
          type: "text",
          admin: { width: "50%", placeholder: "+81 90-1234-5678" },
        },
      ],
    },
    {
      name: "address",
      label: "Địa chỉ",
      type: "textarea",
      admin: {
        rows: 2,
        placeholder: "vd: 1-2-3 Minato-ku, Tokyo 100-0001, Japan",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "website",
          label: "Website",
          type: "text",
          admin: { width: "50%", placeholder: "https://partner.co.jp" },
        },
        {
          name: "taxId",
          label: "Mã số thuế / Reg. No.",
          type: "text",
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "aliases",
      label: "Tên gọi khác (aliases)",
      type: "array",
      labels: { singular: "Alias", plural: "Aliases" },
      admin: {
        description:
          "Biến thể tên dùng trong filename HĐCU, email cũ... Giúp AI tra cứu fuzzy. Vd: 'J Front', 'J-Front', 'JFront Co'.",
      },
      fields: [
        { name: "alias", type: "text", required: true },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "firstContractDate",
          label: "Ngày ký HĐCU đầu tiên",
          type: "date",
          admin: {
            width: "50%",
            description:
              "Tự fill từ Order.contractDate sớm nhất khi import bulk. Có thể sửa tay.",
            date: { pickerAppearance: "dayOnly" },
          },
        },
        {
          name: "active",
          label: "Đang hợp tác",
          type: "checkbox",
          defaultValue: true,
          admin: {
            width: "50%",
            description: "Tắt nếu đối tác đã ngừng hợp tác.",
          },
        },
      ],
    },
    {
      name: "bankAccount",
      label: "Tài khoản ngân hàng",
      type: "group",
      admin: {
        description:
          "Tài khoản đối tác nhận tiền. Lưu ở Partner vì thường cố định; HĐ thay đổi không ảnh hưởng.",
      },
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
    {
      name: "notes",
      label: "Ghi chú",
      type: "textarea",
      admin: { rows: 4 },
    },
  ],
};
