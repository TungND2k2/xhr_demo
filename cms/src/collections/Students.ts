import type { CollectionConfig } from "payload";
import { accessRead, accessUpdate, accessDelete, isAdminUser } from "../utilities/role-access";

/**
 * Students — học viên đăng ký khoá học tiếng Hàn / tiếng Nhật tại TLG.
 *
 * Khác Workers (LĐ XKLĐ) và Employees (nhân sự nội bộ) — đây là học viên
 * lớp đào tạo ngôn ngữ, nguồn tiềm năng cho tuyển dụng XKLĐ sau này.
 *
 * Access:
 *  - create: PUBLIC (ai cũng submit form đăng ký được — form công khai qua QR).
 *  - read/update/delete: chỉ user login có quyền.
 *
 * Nguồn tạo:
 *  - `source = "form"`  → học viên tự điền qua link/QR công khai.
 *  - `source = "manual"` → cán bộ TLG tạo tay trên portal.
 *  - `source = "telegram"` → tạo qua bot.
 */
export const Students: CollectionConfig = {
  slug: "students",
  labels: { singular: "Học viên", plural: "Học viên" },
  admin: {
    group: "Đào tạo",
    useAsTitle: "fullName",
    defaultColumns: ["fullName", "courseType", "phone", "koreanJapaneseLevel", "status", "createdAt"],
    description:
      "Học viên đăng ký khoá tiếng Hàn / Nhật. Đăng ký công khai qua QR hoặc cán bộ tạo tay.",
  },
  access: {
    read: accessRead("students", ["admin", "manager", "recruiter", "trainer"]),
    // PUBLIC create — form đăng ký công khai.
    create: () => true,
    update: accessUpdate("students", ["admin", "manager", "recruiter", "trainer"]),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete: ({ req: { user } }) => isAdminUser(user as any) || ((user as any)?.role === "admin"),
  },
  fields: [
    // ─────────── Khoá học ───────────
    {
      type: "row",
      fields: [
        {
          name: "courseType",
          label: "Khoá học đăng ký",
          type: "select",
          required: true,
          options: [
            { label: "🇯🇵 Tiếng Nhật", value: "nhat" },
            { label: "🇰🇷 Tiếng Hàn", value: "han" },
          ],
          admin: { width: "50%" },
        },
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          defaultValue: "new",
          options: [
            { label: "🆕 Mới đăng ký", value: "new" },
            { label: "📞 Đã liên hệ", value: "contacted" },
            { label: "✅ Đã nhập học", value: "enrolled" },
            { label: "❌ Không theo học", value: "rejected" },
          ],
          admin: { width: "50%" },
        },
      ],
    },

    // ─────────── Phần 1: Thông tin cá nhân ───────────
    {
      type: "row",
      fields: [
        { name: "fullName", label: "Họ và tên", type: "text", required: true, admin: { width: "60%" } },
        { name: "dateOfBirth", label: "Ngày sinh", type: "date", admin: { width: "40%", date: { pickerAppearance: "dayOnly" } } },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "gender",
          label: "Giới tính",
          type: "select",
          options: [
            { label: "Nam", value: "male" },
            { label: "Nữ", value: "female" },
            { label: "Khác", value: "other" },
            { label: "Không muốn tiết lộ", value: "undisclosed" },
          ],
          admin: { width: "33%" },
        },
        { name: "phone", label: "Số điện thoại", type: "text", required: true, admin: { width: "33%" } },
        { name: "email", label: "Email", type: "email", required: true, admin: { width: "34%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "province", label: "Tỉnh / Thành phố", type: "text", required: true, admin: { width: "50%" } },
        { name: "occupation", label: "Nghề nghiệp", type: "text", admin: { width: "50%" } },
      ],
    },

    // ─────────── Phần 2: Thông tin học tập ───────────
    {
      name: "koreanJapaneseLevel",
      label: "Trình độ tiếng Hàn/Nhật hiện tại",
      type: "select",
      required: true,
      options: [
        { label: "Chưa từng học", value: "none" },
        { label: "Đã học sơ cấp", value: "beginner" },
        { label: "Đã học trung cấp", value: "intermediate" },
        { label: "Đã học cao cấp", value: "advanced" },
      ],
    },
    {
      name: "learningGoals",
      label: "Mục tiêu học (chọn nhiều)",
      type: "select",
      hasMany: true,
      options: [
        { label: "Giao tiếp", value: "communication" },
        { label: "Thi TOPIK/JLPT", value: "exam" },
        { label: "Du học", value: "study_abroad" },
        { label: "Làm việc tại Hàn/Nhật", value: "work_abroad" },
        { label: "Xuất khẩu lao động", value: "xkld" },
        { label: "Du lịch", value: "travel" },
        { label: "Khác", value: "other" },
      ],
    },
    { name: "learningGoalOther", label: "Mục tiêu khác (ghi rõ)", type: "text" },
    {
      type: "row",
      fields: [
        {
          name: "studyMode",
          label: "Hình thức học mong muốn",
          type: "select",
          options: [
            { label: "Online", value: "online" },
            { label: "Offline", value: "offline" },
            { label: "Đều được", value: "both" },
          ],
          admin: { width: "50%" },
        },
        {
          name: "device",
          label: "Thiết bị học online",
          type: "select",
          options: [
            { label: "Máy tính", value: "computer" },
            { label: "Điện thoại thông minh", value: "phone" },
            { label: "Cả hai", value: "both" },
            { label: "Chưa có", value: "none" },
          ],
          admin: { width: "50%" },
        },
      ],
    },
    {
      name: "availableTimes",
      label: "Khung giờ có thể học (chọn nhiều)",
      type: "select",
      hasMany: true,
      options: [
        { label: "Ngày thường - Tối (18:00–20:00)", value: "weekday_evening" },
        { label: "Cuối tuần", value: "weekend" },
      ],
    },

    // ─────────── Phần 3: Thông tin bổ sung ───────────
    {
      name: "referralSource",
      label: "Biết đến khoá học qua",
      type: "select",
      options: [
        { label: "Facebook", value: "facebook" },
        { label: "TikTok", value: "tiktok" },
        { label: "Website", value: "website" },
        { label: "Bạn bè giới thiệu", value: "referral" },
        { label: "Zalo", value: "zalo" },
        { label: "Khác", value: "other" },
      ],
    },
    { name: "expectation", label: "Mong muốn từ khoá học", type: "textarea", admin: { rows: 3 } },
    { name: "note", label: "Câu hỏi / ghi chú", type: "textarea", admin: { rows: 3 } },

    // ─────────── Metadata ───────────
    {
      type: "row",
      fields: [
        {
          name: "source",
          label: "Nguồn tạo",
          type: "select",
          defaultValue: "form",
          options: [
            { label: "📝 Form công khai", value: "form" },
            { label: "👤 Cán bộ tạo tay", value: "manual" },
            { label: "🤖 Telegram", value: "telegram" },
          ],
          admin: { width: "50%", readOnly: true },
        },
        {
          name: "assignedTo",
          label: "Cán bộ phụ trách",
          type: "relationship",
          relationTo: "users",
          admin: { width: "50%" },
        },
      ],
    },
  ],
};
