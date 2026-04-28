/**
 * Seed form-builder template "Form nhập đơn hàng của Sales".
 *
 * Form này LLM dùng để biết phải hỏi Sales gì khi tạo đơn mới qua chat.
 * Hardcoded theo spec B1 của khách hàng.
 *
 * Run (override qua biến môi trường nếu cần):
 *   PAYLOAD_URL=http://localhost:3001 \
 *   SEED_ADMIN_EMAIL=admin@skillbot.local \
 *   SEED_ADMIN_PASSWORD=... \
 *   npx tsx scripts/seed-sales-form.ts
 */
const PAYLOAD_URL = process.env.PAYLOAD_URL ?? "http://localhost:3001";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@skillbot.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "123zXc_-";

const FORM_TITLE = "Form nhập đơn hàng của Sales";

interface FormBlock {
  blockType: string;
  blockName?: string;
  name?: string;
  label?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  width?: number;
  message?: unknown;
  options?: Array<{ label: string; value: string }>;
}

const FIELDS: FormBlock[] = [
  // ── Header ───────────────────────────────────────────────
  {
    blockType: "message",
    message: {
      root: {
        type: "root", format: "", indent: 0, version: 1,
        children: [{
          type: "paragraph", format: "", indent: 0, version: 1,
          children: [{
            type: "text",
            text: "Form B1 — Nhận đơn. Sales điền các trường dưới. Hệ thống tự sinh Mã đơn (PE+seq), tự tính Còn nợ, AI đọc hóa đơn/đề bài/ảnh xác nhận để verify trước khi chuyển sang B2.",
            version: 1, format: 0, detail: 0, mode: "normal", style: "",
          }],
          direction: "ltr",
        }],
        direction: "ltr",
      },
    },
  },

  // ── 1. Ngày đặt đơn ──────────────────────────────────────
  { blockType: "date", name: "orderDate", label: "1. Ngày đặt đơn", required: true, width: 33 },

  // ── 2. Mã đơn (auto) ─────────────────────────────────────
  { blockType: "text", name: "orderCode", label: "2. Mã đơn hàng (hệ thống tự sinh PE+số)", width: 33 },

  // ── 3. Mã DA composite ──────────────────────────────────
  { blockType: "text", name: "brandCode", label: "3a. Mã thương hiệu (PE)", required: true, defaultValue: "PE", width: 33 },
  { blockType: "text", name: "country", label: "3b. Quốc gia khách", required: true, width: 33 },
  { blockType: "number", name: "totalQuantity", label: "3c. Số lượng (SL)", required: true, width: 33 },
  { blockType: "text", name: "salespersonCode", label: "3d. Mã Sales (VD: Nguyễn Thị Mai → MAINT)", required: true, width: 33 },

  // ── 4. Thông tin khách ──────────────────────────────────
  { blockType: "text", name: "customerName", label: "4a. Tên khách", required: true, width: 50 },
  { blockType: "text", name: "customerPhone", label: "4b. SĐT", width: 50 },
  { blockType: "text", name: "customerEmail", label: "4c. Email", width: 50 },
  { blockType: "text", name: "customerSocial", label: "4d. Link Facebook/Zalo/Social", width: 50 },

  // ── 5. Link hóa đơn ──────────────────────────────────────
  {
    blockType: "text", name: "invoiceUrl",
    label: "5. Link hóa đơn (Drive/Dropbox/URL trực tiếp)",
    required: true,
  },

  // ── 6. Link đề bài ───────────────────────────────────────
  {
    blockType: "text", name: "briefUrl",
    label: "6. Link đề bài (BẮT BUỘC có deadline, KHÔNG có giá+khách)",
    required: true,
  },

  // ── 7-11. Tài chính ──────────────────────────────────────
  { blockType: "number", name: "totalAmount", label: "7. Tổng giá trị đơn (USD)", required: true, width: 50 },
  { blockType: "number", name: "deposit", label: "8. Số tiền đặt cọc (USD)", defaultValue: 0, width: 50 },
  { blockType: "number", name: "accountantConfirmedAmount", label: "10. Số tiền Kế toán đã confirm", defaultValue: 0, width: 50 },
  { blockType: "number", name: "owedAmount", label: "11. Còn nợ (hệ thống tự tính)", width: 50 },

  // ── 12-14. Vận chuyển ───────────────────────────────────
  { blockType: "text", name: "paymentChannel", label: "Kênh thanh toán", width: 33 },
  { blockType: "number", name: "shippingFee", label: "12. Phí ship (USD)", width: 33 },
  { blockType: "number", name: "expectedWeightKg", label: "13. Trọng lượng dự kiến (kg)", width: 33 },
  { blockType: "date", name: "expectedDeliveryDate", label: "14. Thời gian hẹn khách (deadline)", required: true },

  // ── 15. Ảnh xác nhận khách ──────────────────────────────
  {
    blockType: "text", name: "customerConfirmationImageUrl",
    label: "15. Link ảnh khách xác nhận hóa đơn (chat screenshot có 'approved/correct/confirmed')",
    required: true,
  },
];

async function main() {
  console.log(`→ Đăng nhập Payload @ ${PAYLOAD_URL}`);
  const loginRes = await fetch(`${PAYLOAD_URL}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) {
    console.error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    process.exit(1);
  }
  const { token } = (await loginRes.json()) as { token: string };
  console.log(`✓ Login OK`);

  // Check trùng tên
  const existRes = await fetch(
    `${PAYLOAD_URL}/api/forms?where[title][equals]=${encodeURIComponent(FORM_TITLE)}`,
    { headers: { Authorization: `JWT ${token}` } },
  );
  const existing = (await existRes.json()) as { docs: Array<{ id: string; title: string }> };
  let formId: string | null = null;

  const payload = {
    title: FORM_TITLE,
    fields: FIELDS,
    submitButtonLabel: "Lưu đơn hàng",
    confirmationType: "message",
    confirmationMessage: {
      root: {
        type: "root", format: "", indent: 0, version: 1,
        children: [{
          type: "paragraph", format: "", indent: 0, version: 1,
          children: [{
            type: "text",
            text: "✅ Đã ghi nhận. Hệ thống đang AI-extract hóa đơn + đề bài + verify ảnh, sẽ thông báo sau ~30 giây.",
            version: 1, format: 0, detail: 0, mode: "normal", style: "",
          }],
          direction: "ltr",
        }],
        direction: "ltr",
      },
    },
  };

  if (existing.docs.length > 0) {
    formId = existing.docs[0].id;
    console.log(`→ Cập nhật form #${formId}`);
    const upd = await fetch(`${PAYLOAD_URL}/api/forms/${formId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
      body: JSON.stringify(payload),
    });
    if (!upd.ok) {
      console.error(`Update failed: ${upd.status} ${await upd.text()}`);
      process.exit(1);
    }
    console.log(`✓ Updated form #${formId}`);
  } else {
    console.log(`→ Tạo form mới`);
    const cre = await fetch(`${PAYLOAD_URL}/api/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `JWT ${token}` },
      body: JSON.stringify(payload),
    });
    if (!cre.ok) {
      console.error(`Create failed: ${cre.status} ${await cre.text()}`);
      process.exit(1);
    }
    const created = (await cre.json()) as { doc: { id: string } };
    formId = created.doc.id;
    console.log(`✓ Created form #${formId}`);
  }

  console.log(`\nXong. Mở admin → Form mẫu → "${FORM_TITLE}" để xem.`);
  console.log(`AI sẽ thấy form qua \`list_forms\` / \`get_form\` tools.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
