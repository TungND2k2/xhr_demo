import type { CollectionConfig } from "payload";

/**
 * Users — auth collection cho admin dashboard.
 *
 * Roles ngành XKLĐ:
 *  - admin           Chủ doanh nghiệp / GĐ           toàn quyền
 *  - manager         Quản lý điều hành               duyệt workflow, gán đơn
 *  - recruiter       Tuyển dụng                       nhập ứng viên, sàng lọc, theo dõi đơn
 *  - trainer         Giảng viên đào tạo               quản lý lớp, điểm danh
 *  - visa_specialist Chuyên viên visa                xử lý hồ sơ COE/visa
 *  - accountant      Kế toán                          phí dịch vụ, thanh toán
 *  - medical         Y tế / cơ sở khám                cập nhật kết quả khám SK
 */
export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Người dùng", plural: "Người dùng" },
  admin: {
    useAsTitle: "displayName",
    defaultColumns: ["displayName", "email", "role", "isActive"],
    group: "Hệ thống",
  },
  auth: true,
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === "admin",
    update: ({ req: { user } }) =>
      user?.role === "admin" || user?.role === "manager",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    {
      name: "displayName",
      label: "Tên hiển thị",
      type: "text",
      required: true,
    },
    {
      name: "role",
      label: "Vai trò",
      type: "select",
      required: true,
      defaultValue: "recruiter",
      options: [
        { label: "👑 Chủ DN / GĐ (Admin)", value: "admin" },
        { label: "📋 Quản lý điều hành", value: "manager" },
        { label: "🧑‍💼 Tuyển dụng", value: "recruiter" },
        { label: "🎓 Giảng viên đào tạo", value: "trainer" },
        { label: "🛂 Chuyên viên visa", value: "visa_specialist" },
        { label: "💰 Kế toán", value: "accountant" },
        { label: "🏥 Y tế / Khám SK", value: "medical" },
      ],
    },
    {
      name: "isActive",
      label: "Đang dùng",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "telegramUserId",
      label: "Telegram User ID",
      type: "text",
      admin: {
        description:
          "ID dạng số (không phải @username) — bot dùng để DM nhắc việc",
      },
    },
  ],
};
