import type { CollectionConfig } from "payload";

/**
 * OrderWorkers — junction giữa `orders` ↔ `workers`. Mỗi bản ghi =
 * 1 ứng viên ứng tuyển vào 1 đơn cụ thể.
 *
 * Trạng thái: applied → interviewing → passed → training → ready
 * → deployed (chuyển sang `contracts` khi ký HĐ).
 *
 * Một worker có thể có nhiều OrderWorker khác nhau (ứng tuyển nhiều đơn,
 * chỉ ký HĐ với 1 — các record còn lại chuyển sang status "dropped").
 */
export const OrderWorkers: CollectionConfig = {
  slug: "order-workers",
  labels: { singular: "Ứng viên trong đơn", plural: "Ứng viên × Đơn tuyển" },
  admin: {
    useAsTitle: "label",
    defaultColumns: [
      "order",
      "worker",
      "status",
      "interviewResult",
      "trainingStatus",
      "medicalStatus",
    ],
    group: "Tuyển dụng",
  },
  access: {
    read: ({ req: { user } }) => !!user,
    create: ({ req: { user } }) =>
      ["admin", "manager", "recruiter"].includes(user?.role ?? ""),
    update: ({ req: { user } }) =>
      ["admin", "manager", "recruiter", "trainer", "visa_specialist"].includes(
        user?.role ?? "",
      ),
    delete: ({ req: { user } }) => ["admin", "manager"].includes(user?.role ?? ""),
  },
  indexes: [
    // Một worker chỉ có 1 hàng cho mỗi đơn
    { fields: ["order", "worker"], unique: true },
  ],
  fields: [
    // Auto-build label cho dropdown: "XHR-001 × LD-042"
    {
      name: "label",
      type: "text",
      admin: { hidden: true },
      hooks: {
        beforeChange: [
          async ({ data, req, siblingData, value }) => {
            if (!siblingData) return value;
            const orderId = typeof siblingData.order === "string"
              ? siblingData.order
              : siblingData.order?.id;
            const workerId = typeof siblingData.worker === "string"
              ? siblingData.worker
              : siblingData.worker?.id;
            if (!orderId || !workerId) return value;
            try {
              const [o, w] = await Promise.all([
                req.payload.findByID({ collection: "orders", id: orderId, depth: 0 }),
                req.payload.findByID({ collection: "workers", id: workerId, depth: 0 }),
              ]);
              return `${(o as { orderCode?: string }).orderCode ?? "?"} × ${(w as { workerCode?: string }).workerCode ?? "?"}`;
            } catch { return value; }
          },
        ],
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "order",
          label: "Đơn tuyển",
          type: "relationship",
          relationTo: "orders",
          required: true,
          admin: { width: "50%" },
        },
        {
          name: "worker",
          label: "Ứng viên",
          type: "relationship",
          relationTo: "workers",
          required: true,
          admin: { width: "50%" },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "appliedAt",
          label: "Ngày ứng tuyển",
          type: "date",
          required: true,
          defaultValue: () => new Date().toISOString(),
          admin: { width: "33%", date: { pickerAppearance: "dayOnly" } },
        },
        {
          name: "source",
          label: "Nguồn ứng tuyển",
          type: "select",
          options: [
            { label: "Tự tìm đến", value: "walk_in" },
            { label: "Giới thiệu", value: "referral" },
            { label: "Quảng cáo FB", value: "fb_ads" },
            { label: "Đại lý", value: "agent" },
            { label: "Khác", value: "other" },
          ],
          admin: { width: "33%" },
        },
        {
          name: "referrer",
          label: "Người giới thiệu",
          type: "text",
          admin: { width: "34%" },
        },
      ],
    },

    // ── Sàng lọc hồ sơ ───────────────────────────────────
    {
      type: "collapsible",
      label: "Sàng lọc hồ sơ",
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "screeningStatus",
              label: "Kết quả sàng lọc",
              type: "select",
              defaultValue: "pending",
              options: [
                { label: "⏳ Chưa duyệt", value: "pending" },
                { label: "✅ Đạt yêu cầu", value: "pass" },
                { label: "❌ Không đạt", value: "fail" },
              ],
              admin: { width: "50%" },
            },
            {
              name: "screeningNotes",
              label: "Ghi chú sàng lọc",
              type: "text",
              admin: { width: "50%" },
            },
          ],
        },
      ],
    },

    // ── Khám sức khoẻ ────────────────────────────────────
    {
      type: "collapsible",
      label: "Khám sức khoẻ",
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "medicalStatus",
              label: "Kết quả khám",
              type: "select",
              defaultValue: "pending",
              options: [
                { label: "⏳ Chưa khám", value: "pending" },
                { label: "📅 Đã đặt lịch", value: "scheduled" },
                { label: "✅ Đạt", value: "pass" },
                { label: "❌ Không đạt", value: "fail" },
              ],
              admin: { width: "50%" },
            },
            {
              name: "medicalDate",
              label: "Ngày khám",
              type: "date",
              admin: { width: "50%", date: { pickerAppearance: "dayOnly" } },
            },
          ],
        },
      ],
    },

    // ── Đào tạo ─────────────────────────────────────────
    {
      type: "collapsible",
      label: "Đào tạo",
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "trainingStatus",
              label: "Trạng thái đào tạo",
              type: "select",
              defaultValue: "not_started",
              options: [
                { label: "Chưa bắt đầu", value: "not_started" },
                { label: "📚 Đang học", value: "in_progress" },
                { label: "✅ Đã hoàn thành", value: "completed" },
                { label: "❌ Trượt / bỏ học", value: "dropped" },
              ],
              admin: { width: "33%" },
            },
            {
              name: "trainingClass",
              label: "Lớp / khoá",
              type: "text",
              admin: { width: "33%", placeholder: "vd: N4-25.A / Kỹ năng hàn 03/2026" },
            },
            {
              name: "trainingScore",
              label: "Điểm",
              type: "number",
              admin: { width: "34%" },
            },
          ],
        },
        {
          name: "trainingNotes",
          label: "Ghi chú đào tạo",
          type: "textarea",
        },
      ],
    },

    // ── Phỏng vấn đối tác ─────────────────────────────
    {
      type: "collapsible",
      label: "Phỏng vấn đối tác",
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "interviewDate",
              label: "Ngày phỏng vấn",
              type: "date",
              admin: { width: "33%", date: { pickerAppearance: "dayAndTime" } },
            },
            {
              name: "interviewer",
              label: "Người phỏng vấn",
              type: "text",
              admin: { width: "33%" },
            },
            {
              name: "interviewResult",
              label: "Kết quả",
              type: "select",
              defaultValue: "pending",
              options: [
                { label: "⏳ Chờ phỏng vấn", value: "pending" },
                { label: "✅ Trúng tuyển", value: "pass" },
                { label: "❌ Trượt", value: "fail" },
                { label: "🔁 Phỏng vấn lại", value: "retest" },
              ],
              admin: { width: "34%" },
            },
          ],
        },
        {
          name: "interviewNotes",
          label: "Ghi chú phỏng vấn",
          type: "textarea",
        },
      ],
    },

    // ── Trạng thái tổng ──────────────────────────────
    {
      name: "status",
      label: "Trạng thái",
      type: "select",
      required: true,
      defaultValue: "applied",
      options: [
        { label: "📝 Đã ứng tuyển", value: "applied" },
        { label: "🔍 Đang sàng lọc", value: "screening" },
        { label: "🏥 Khám sức khoẻ", value: "medical" },
        { label: "🎓 Đang đào tạo", value: "training" },
        { label: "🎤 Đã phỏng vấn", value: "interviewed" },
        { label: "✅ Trúng tuyển", value: "passed" },
        { label: "✈️ Đã xuất cảnh", value: "deployed" },
        { label: "❌ Trượt", value: "dropped" },
      ],
    },
    {
      name: "notes",
      label: "Ghi chú",
      type: "textarea",
    },
  ],
  timestamps: true,
};
