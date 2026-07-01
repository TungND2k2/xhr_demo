import type { CollectionConfig, Access } from "payload";
import { accessRead, accessCreate, isAdminUser, hasPermission } from "../utilities/role-access";

/**
 * BlogPosts — Blog nội bộ Thịnh Long Group.
 *
 * Yêu cầu buổi họp 18/06/2026 (item #8): "Phòng HCNS: Quản lý Blog nội bộ —
 * Triển khai lưu trữ bài viết và hình ảnh phân tách theo phòng ban; thiết lập
 * phân quyền chi tiết (đăng bài, chỉnh sửa, xóa) cho từng nhóm người dùng."
 *
 * Access rule:
 *  - read: mọi user login được → xem toàn bộ blog nội bộ.
 *  - create: role có permission `blog-posts.create` (default: nhân viên trở
 *    lên tự đăng được — HCNS gán qua Roles).
 *  - update: TÁC GIẢ của bài + user có permission `blog-posts.update`
 *    (admin/HCNS). Payload return where filter → tự lọc.
 *  - delete: TÁC GIẢ của bài + user có permission `blog-posts.delete`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserLike = { id?: string; role?: string; roleRef?: any };

const authorOrAdminUpdate: Access = ({ req: { user } }) => {
  const u = user as UserLike;
  if (!u?.id) return false;
  if (isAdminUser(u)) return true;
  if (hasPermission(u, "blog-posts", "update", ["admin", "manager"])) return true;
  // Otherwise chỉ được sửa bài của mình
  return { author: { equals: u.id } };
};

const authorOrAdminDelete: Access = ({ req: { user } }) => {
  const u = user as UserLike;
  if (!u?.id) return false;
  if (isAdminUser(u)) return true;
  if (hasPermission(u, "blog-posts", "delete", ["admin", "manager"])) return true;
  return { author: { equals: u.id } };
};

export const BlogPosts: CollectionConfig = {
  slug: "blog-posts",
  labels: { singular: "Bài viết Blog", plural: "Blog nội bộ" },
  admin: {
    group: "Nội bộ",
    useAsTitle: "title",
    defaultColumns: ["title", "department", "author", "status", "publishedAt"],
    description:
      "Blog nội bộ Thịnh Long — thông báo, chia sẻ, tài liệu hướng dẫn. Phân theo phòng ban. Tác giả tự sửa/xoá bài mình; HCNS/admin sửa/xoá tất cả.",
  },
  access: {
    read: accessRead("blog-posts", [
      "admin", "manager", "recruiter", "trainer", "visa_specialist", "accountant", "medical",
    ]),
    create: accessCreate("blog-posts", [
      "admin", "manager", "recruiter", "trainer", "visa_specialist", "accountant", "medical",
    ]),
    update: authorOrAdminUpdate,
    delete: authorOrAdminDelete,
  },
  hooks: {
    beforeChange: [
      // Auto tác giả = user hiện tại khi tạo mới
      ({ data, operation, req }) => {
        if (operation === "create" && !data.author && req?.user?.id) {
          data.author = req.user.id;
        }
        // Auto slug từ title nếu chưa có
        if (!data.slug && data.title) {
          data.slug = slugify(String(data.title));
        }
        // Auto publishedAt khi status chuyển sang published (lần đầu)
        if (data.status === "published" && !data.publishedAt) {
          data.publishedAt = new Date().toISOString();
        }
        return data;
      },
    ],
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "title",
          label: "Tiêu đề",
          type: "text",
          required: true,
          admin: { width: "75%", placeholder: "vd: Chào mừng nhân sự mới tháng 7" },
        },
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          required: true,
          defaultValue: "draft",
          options: [
            { label: "📝 Nháp", value: "draft" },
            { label: "✅ Đã đăng", value: "published" },
            { label: "🗄 Lưu trữ", value: "archived" },
          ],
          admin: { width: "25%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "slug",
          label: "Slug URL",
          type: "text",
          admin: {
            width: "50%",
            description: "Auto tạo từ title. VD: 'chao-mung-nhan-su-thang-7'.",
          },
        },
        {
          name: "department",
          label: "Phòng ban",
          type: "select",
          required: true,
          options: [
            { label: "🏢 Toàn công ty", value: "all" },
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
          admin: {
            width: "50%",
            description: "Phòng nào đăng bài. Chọn 'Toàn công ty' cho thông báo chung.",
          },
        },
      ],
    },
    {
      name: "excerpt",
      label: "Tóm tắt (hiển thị ở list)",
      type: "textarea",
      admin: {
        rows: 2,
        placeholder: "1-2 câu ngắn mô tả nội dung — hiện dưới title ở trang list.",
      },
    },
    {
      name: "featuredImage",
      label: "Ảnh đại diện",
      type: "relationship",
      relationTo: "media",
      admin: { description: "Ảnh cover hiện trên card blog list." },
    },
    {
      name: "content",
      label: "Nội dung bài viết (BlockNote JSON)",
      type: "json",
      required: false,
      admin: {
        description:
          "JSON array các block do BlockNote sinh (heading, paragraph, list, image, quote...). Sửa qua trang /blog/:id/edit trên portal, KHÔNG sửa tay ở đây (dễ break).",
      },
    },
    {
      name: "attachments",
      label: "Tệp đính kèm",
      type: "relationship",
      relationTo: "media",
      hasMany: true,
      admin: {
        description: "Ảnh phụ / file đính kèm (PDF, Word, v.v.)",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "author",
          label: "Tác giả",
          type: "relationship",
          relationTo: "users",
          admin: {
            width: "50%",
            readOnly: true,
            description: "Auto set = user tạo bài. Không sửa được.",
          },
        },
        {
          name: "publishedAt",
          label: "Ngày đăng",
          type: "date",
          admin: {
            width: "50%",
            date: { pickerAppearance: "dayAndTime" },
            description: "Auto set khi status chuyển sang 'published' lần đầu.",
          },
        },
      ],
    },
    {
      name: "tags",
      label: "Tags",
      type: "array",
      labels: { singular: "Tag", plural: "Tags" },
      admin: {
        description: "Tag để filter (vd: 'thông báo', 'chào mừng', 'quy trình', 'chia sẻ').",
      },
      fields: [{ name: "tag", type: "text", required: true }],
    },
    {
      name: "views",
      label: "Lượt xem",
      type: "number",
      defaultValue: 0,
      admin: { readOnly: true },
    },
  ],
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
