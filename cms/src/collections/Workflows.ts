import type { CollectionConfig } from "payload";

/**
 * Workflows — định nghĩa các quy trình khác nhau. Hiện có:
 *  - "default" (xuất khẩu may thêu trẻ em — 6 bước)
 *
 * Tương lai có thể thêm:
 *  - "sample" (làm mẫu duyệt — ngắn hơn)
 *  - "domestic" (đơn trong nước — bỏ AI extract)
 *  - ...
 *
 * Mỗi `WorkflowStage` thuộc 1 workflow. Mỗi `Order` chọn 1 workflow ngay khi tạo.
 */
export const Workflows: CollectionConfig = {
  slug: "workflows",
  labels: { singular: "Workflow", plural: "Workflows" },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["slug", "name", "domain", "isActive"],
    group: "Hệ thống",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) => ["admin", "manager"].includes(user?.role ?? ""),
    update: ({ req: { user } }) => ["admin", "manager"].includes(user?.role ?? ""),
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "slug",
          label: "Slug",
          type: "text",
          required: true,
          unique: true,
          admin: { width: "33%", description: 'Vd: "default-export", "sample"' },
        },
        {
          name: "name",
          label: "Tên",
          type: "text",
          required: true,
          admin: { width: "67%" },
        },
      ],
    },
    {
      name: "description",
      label: "Mô tả",
      type: "textarea",
    },
    {
      name: "domain",
      label: "Lĩnh vực",
      type: "select",
      defaultValue: "garment-export",
      options: [
        { label: "May thêu xuất khẩu", value: "garment-export" },
        { label: "Mẫu thử / sample", value: "sample" },
        { label: "Nội địa", value: "domestic" },
        { label: "Khác", value: "other" },
      ],
    },
    {
      name: "isDefault",
      label: "Workflow mặc định",
      type: "checkbox",
      defaultValue: false,
      admin: { description: "Đơn mới sẽ tự dùng workflow này nếu user không chọn" },
    },
    {
      name: "isActive",
      label: "Đang dùng",
      type: "checkbox",
      defaultValue: true,
    },
    {
      type: "ui",
      name: "stagesDiagram",
      admin: {
        components: {
          Field: "/components/admin/WorkflowDiagram",
        },
      },
    },
    {
      name: "stages",
      label: "Các bước thuộc workflow này",
      type: "join",
      collection: "workflow-stages",
      on: "workflow",
      defaultSort: "order",
      admin: {
        defaultColumns: [
          "order",
          "code",
          "name",
          "durationDays",
          "responsibleRole",
          "isActive",
        ],
        description:
          "Click vào bước để chỉnh sửa, hoặc bấm 'Create New' để thêm bước mới (nhớ chọn workflow này).",
      },
    },
  ],
  timestamps: true,
};
