import type { CollectionConfig } from "payload";
import { accessRead, accessCreate, accessUpdate, accessDelete } from "../utilities/role-access";

/**
 * Assets — quản lý tài sản công ty: laptop, xe, văn phòng phẩm, thiết bị
 * đào tạo (máy may, máy chiếu...), tài liệu vật lý.
 *
 * Track:
 *  - Tình trạng (đang dùng, hỏng, thanh lý...)
 *  - Người mượn / phụ trách
 *  - Lịch sử bảo trì
 *  - Giá trị + ngày mua (cho khấu hao)
 */
export const Assets: CollectionConfig = {
  slug: "assets",
  labels: { singular: "Tài sản", plural: "Tài sản" },
  admin: {
    group: "Hệ thống",
    useAsTitle: "name",
    defaultColumns: [
      "assetCode",
      "name",
      "category",
      "status",
      "assignedTo",
      "purchaseDate",
    ],
  },
  access: {
    read: accessRead("assets"),
    create: accessCreate("assets", ["admin", "manager", "accountant"]),
    update: accessUpdate("assets", ["admin", "manager", "accountant"]),
    delete: accessDelete("assets", ["admin"]),
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "assetCode",
          label: "Mã tài sản",
          type: "text",
          required: true,
          unique: true,
          index: true,
          admin: {
            width: "30%",
            placeholder: "vd: LT-001, XE-005, MAY-012",
          },
        },
        {
          name: "name",
          label: "Tên tài sản",
          type: "text",
          required: true,
          admin: {
            width: "70%",
            placeholder: "vd: Macbook Pro 14 inch (chị Hương)",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "category",
          label: "Loại",
          type: "select",
          required: true,
          options: [
            { label: "💻 Máy tính / Laptop", value: "computer" },
            { label: "📱 Điện thoại / Tablet", value: "phone" },
            { label: "🚗 Xe cộ", value: "vehicle" },
            { label: "🖨 Máy in / Scan", value: "printer" },
            { label: "🪑 Bàn ghế văn phòng", value: "furniture" },
            { label: "🧵 Thiết bị đào tạo (máy may, ...)", value: "training_equipment" },
            { label: "📦 Văn phòng phẩm", value: "stationery" },
            { label: "📄 Tài liệu vật lý", value: "physical_doc" },
            { label: "📝 Khác", value: "other" },
          ],
          admin: { width: "33%" },
        },
        {
          name: "status",
          label: "Tình trạng",
          type: "select",
          required: true,
          defaultValue: "in_use",
          options: [
            { label: "✅ Đang sử dụng", value: "in_use" },
            { label: "📦 Trong kho (chưa giao)", value: "in_stock" },
            { label: "🔧 Đang sửa chữa", value: "repairing" },
            { label: "❌ Hỏng / không dùng được", value: "broken" },
            { label: "♻️ Đã thanh lý", value: "disposed" },
            { label: "❓ Mất / không tìm thấy", value: "lost" },
          ],
          admin: { width: "33%" },
        },
        {
          name: "assignedTo",
          label: "Đang giao cho",
          type: "relationship",
          relationTo: "users",
          admin: {
            width: "34%",
            description: "Nhân viên đang phụ trách / mượn",
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "quantity",
          label: "Số lượng",
          type: "number",
          defaultValue: 1,
          min: 1,
          admin: {
            width: "25%",
            description:
              "Số đơn vị cùng loại được gom thành 1 record (vd 4 cái máy tính cây cùng phòng). Default 1.",
          },
        },
        {
          name: "purchaseDate",
          label: "Ngày mua",
          type: "date",
          admin: {
            date: { pickerAppearance: "dayOnly" },
            width: "25%",
          },
        },
        {
          name: "purchaseValue",
          label: "Đơn giá (VND)",
          type: "number",
          admin: {
            width: "25%",
            placeholder: "30000000",
            description: "Đơn giá / 1 đơn vị",
          },
        },
        {
          name: "warrantyUntil",
          label: "Bảo hành đến",
          type: "date",
          admin: {
            date: { pickerAppearance: "dayOnly" },
            width: "25%",
          },
        },
      ],
    },
    {
      name: "serialNumber",
      label: "Serial / Số khung",
      type: "text",
      admin: { placeholder: "Số seri sản phẩm hoặc số khung xe" },
    },
    {
      name: "location",
      label: "Vị trí",
      type: "text",
      admin: {
        placeholder: "vd: Tầng 3 phòng Đào tạo / Kho B",
      },
    },
    {
      name: "notes",
      label: "Ghi chú",
      type: "textarea",
    },
    {
      type: "collapsible",
      label: "Lịch sử bảo trì",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "maintenanceLog",
          label: "Bảo trì / sửa chữa",
          type: "array",
          labels: { singular: "Lần bảo trì", plural: "Lần bảo trì" },
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "date",
                  label: "Ngày",
                  type: "date",
                  required: true,
                  admin: {
                    date: { pickerAppearance: "dayOnly" },
                    width: "25%",
                  },
                },
                {
                  name: "kind",
                  label: "Loại",
                  type: "select",
                  options: [
                    { label: "Bảo trì định kỳ", value: "periodic" },
                    { label: "Sửa chữa", value: "repair" },
                    { label: "Nâng cấp", value: "upgrade" },
                  ],
                  admin: { width: "25%" },
                },
                {
                  name: "cost",
                  label: "Chi phí (VND)",
                  type: "number",
                  admin: { width: "25%" },
                },
                {
                  name: "vendor",
                  label: "Đơn vị thực hiện",
                  type: "text",
                  admin: { width: "25%" },
                },
              ],
            },
            {
              name: "description",
              label: "Mô tả",
              type: "textarea",
              admin: { rows: 2 },
            },
          ],
        },
      ],
    },
  ],
};
