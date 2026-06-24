import type { CollectionConfig } from "payload";

/**
 * Roles — bảng phân quyền động.
 *
 * Thay vì hardcode role enum trong Users, admin tự tạo role + chọn ma trận
 * quyền (Read/Create/Update/Delete × N collection) qua UI portal.
 *
 * - Role có `isSystem=true` (vd "Admin") là built-in: KHÔNG cho xoá / sửa
 *   permissions. Vẫn cho đổi name + description.
 * - User.role là relationship → 1 role. Khi tải User, role được populate
 *   (depth=1+) → access check đọc permissions trực tiếp.
 * - `markets` (optional): nếu non-empty thì user chỉ thấy bản ghi có
 *   `market in markets`. Empty = không scope (cross thị trường).
 *
 * Hardcode rule: bất kể permissions json là gì, user có role.name === "Admin"
 * luôn được pass tất cả access — fallback an toàn để admin không tự khoá mình.
 */
export const Roles: CollectionConfig = {
  slug: "roles",
  labels: { singular: "Vai trò", plural: "Vai trò" },
  admin: {
    group: "Hệ thống",
    useAsTitle: "name",
    defaultColumns: ["name", "description", "isSystem", "markets"],
    description:
      "Bảng phân quyền. Admin có quyền tạo role mới, gán permissions chi tiết theo từng collection × action.",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    // Chỉ Admin tự sửa được Roles (tránh user thường tự nâng quyền).
    create: ({ req: { user } }) => isAdminUser(user),
    update: ({ req: { user } }) => isAdminUser(user),
    delete: ({ req: { user } }) => isAdminUser(user),
  },
  hooks: {
    beforeChange: [
      // Bảo vệ system role: không cho đổi isSystem flag, không cho xoá permissions critical.
      ({ data, originalDoc, operation }) => {
        if (operation === "update" && originalDoc?.isSystem) {
          // Giữ nguyên isSystem
          data.isSystem = true;
          // Cho phép đổi name + description + permissions + markets, nhưng KHÔNG
          // cho phép Admin role bị giới hạn quyền (Admin = full).
          if (originalDoc?.name === "Admin") {
            data.permissions = data.permissions ?? originalDoc.permissions;
            data.markets = []; // Admin không scope
          }
        }
        return data;
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const role = await req.payload.findByID({ collection: "roles", id, depth: 0 });
        if ((role as { isSystem?: boolean }).isSystem) {
          throw new Error("Không thể xoá role hệ thống (isSystem=true).");
        }
      },
    ],
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "name",
          label: "Tên vai trò",
          type: "text",
          required: true,
          unique: true,
          admin: { width: "60%", placeholder: "vd: Trưởng phòng Nhật" },
        },
        {
          name: "isSystem",
          label: "Vai trò hệ thống",
          type: "checkbox",
          defaultValue: false,
          admin: {
            width: "40%",
            description: "Không thể xoá. Tick này chỉ admin set khi seed.",
            readOnly: true,
          },
        },
      ],
    },
    {
      name: "description",
      label: "Mô tả",
      type: "textarea",
      admin: {
        rows: 2,
        placeholder: "Chức danh + phạm vi công việc",
      },
    },
    {
      name: "markets",
      label: "Phạm vi thị trường",
      type: "select",
      hasMany: true,
      options: [
        { label: "🇯🇵 Nhật Bản", value: "jp" },
        { label: "🇰🇷 Hàn Quốc", value: "kr" },
        { label: "🇹🇼 Đài Loan", value: "tw" },
        { label: "🇩🇪 Đức", value: "de" },
        { label: "🇸🇦 Trung Đông", value: "me" },
        { label: "🇪🇺 EU", value: "eu" },
        { label: "Khác", value: "other" },
      ],
      admin: {
        description:
          "Để trống = không giới hạn (xem tất cả thị trường). Nếu chọn, user chỉ xem được record có market thuộc danh sách này.",
      },
    },
    {
      name: "permissions",
      label: "Ma trận quyền (Permissions)",
      type: "json",
      admin: {
        description:
          'JSON dạng {"<collection>": {"read":true,"create":false,"update":false,"delete":false}}. UI portal sẽ render checkbox grid; sửa tay từ admin Payload cũng được.',
      },
    },
  ],
};

function isAdminUser(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as { role?: unknown };
  // Backward compat: trong giai đoạn migration, user.role có thể là string ("admin")
  // hoặc object (sau khi đổi sang relationship).
  if (typeof u.role === "string") return u.role === "admin";
  if (u.role && typeof u.role === "object") {
    const r = u.role as { name?: string; isSystem?: boolean };
    return r.isSystem === true && r.name === "Admin";
  }
  return false;
}
