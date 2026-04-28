/**
 * Seed default Workflow + 9 stages cho domain XKLĐ (W1-W8 + done).
 *
 * Idempotent — gọi lại upsert theo (workflow.slug + stage.code).
 *
 * Run:
 *   PAYLOAD_URL=http://localhost:3002 \
 *   SEED_ADMIN_EMAIL=admin@xhr.local \
 *   SEED_ADMIN_PASSWORD=... \
 *   npx tsx scripts/seed-workflow-stages.ts
 */
const PAYLOAD_URL = process.env.PAYLOAD_URL ?? "http://localhost:3002";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@xhr.local";
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "123zXc_-";

const WORKFLOW = {
  slug: "default-xkld",
  name: "Quy trình XKLĐ tổng quát (mặc định)",
  description: "8 bước W1–W8 từ tuyển → khám SK → đào tạo → ký HĐ → visa → xuất cảnh.",
  domain: "xkld",
  isDefault: true,
  isActive: true,
};

interface StageSeed {
  order: number;
  code: string;
  name: string;
  durationDays?: number;
  minDurationDays?: number;
  maxDurationDays?: number;
  responsibleRole: string;
  approverRoles: string[];
  description: string;
  deliverables: { item: string }[];
  qualityChecks?: { check: string }[];
  reminders: {
    atDay: number;
    recipients: string[];
    kind: "checkin" | "overdue" | "critical";
    message: string;
  }[];
}

const STAGES: StageSeed[] = [
  {
    order: 1, code: "w1",
    name: "Tuyển dụng",
    durationDays: 30, minDurationDays: 14, maxDurationDays: 60,
    responsibleRole: "recruiter",
    approverRoles: ["manager"],
    description: `Đăng tin tuyển, sàng lọc hồ sơ, gặp gỡ ứng viên.\nMục tiêu: đủ N+30% slot ứng viên dự bị (lọc bớt khi rớt khám SK).`,
    deliverables: [
      { item: "Danh sách ứng viên đăng ký vào đơn (≥ 130% slot)" },
      { item: "Hồ sơ scan đầy đủ: CV, CCCD, hộ chiếu, ảnh" },
      { item: "Sàng lọc sơ bộ — loại trường hợp không đáp ứng" },
    ],
    reminders: [
      { atDay: 14, recipients: ["recruiter", "manager"], kind: "checkin",
        message: "📋 Đơn {orderCode} ở W1 đã 2 tuần — cập nhật số ứng viên đã thu được." },
      { atDay: 30, recipients: ["manager", "admin"], kind: "overdue",
        message: "⚠️ Đơn {orderCode} ở W1 quá {daysOverdue} ngày — cần đẩy lên thị trường để gọi thêm." },
    ],
  },
  {
    order: 2, code: "w2",
    name: "Khám sức khoẻ",
    durationDays: 14, minDurationDays: 7, maxDurationDays: 21,
    responsibleRole: "medical",
    approverRoles: ["manager"],
    description: `Đặt lịch khám tại cơ sở y tế đủ điều kiện (vd: Bạch Mai, Bệnh viện GTVT).\nƯu tiên kiểm: HIV, HBV, lao phổi, mắt, máu — đặc biệt với thị trường Nhật/Hàn yêu cầu khắt khe.`,
    deliverables: [
      { item: "Giấy khám SK đạt yêu cầu của từng ứng viên" },
      { item: "Phân loại pass/fail/khám lại" },
    ],
    qualityChecks: [
      { check: "Giấy khám có dấu cơ sở y tế hợp pháp" },
      { check: "Đủ các xét nghiệm theo yêu cầu thị trường" },
      { check: "Chiều cao / cân nặng đáp ứng yêu cầu đơn" },
    ],
    reminders: [
      { atDay: 7, recipients: ["medical", "recruiter"], kind: "checkin",
        message: "🏥 Đơn {orderCode}: 1 tuần ở W2 — cập nhật kết quả khám SK theo từng ứng viên." },
      { atDay: 14, recipients: ["manager"], kind: "overdue",
        message: "⚠️ Đơn {orderCode} ở W2 quá {daysOverdue} ngày — kết quả khám chưa đủ." },
    ],
  },
  {
    order: 3, code: "w3",
    name: "Đào tạo",
    durationDays: 90, minDurationDays: 60, maxDurationDays: 180,
    responsibleRole: "trainer",
    approverRoles: ["manager"],
    description: `Đào tạo ngoại ngữ + kỹ năng nghề + định hướng văn hoá nước đến.\nNhật: tối thiểu N4-N5 (3-6 tháng). Hàn: EPS-TOPIK level 1-2.\nKỹ năng nghề theo yêu cầu đơn (hàn, may, điều dưỡng, công xưởng...).`,
    deliverables: [
      { item: "Chứng chỉ ngoại ngữ đạt yêu cầu" },
      { item: "Đánh giá kỹ năng nghề" },
      { item: "Hoàn thành định hướng văn hoá" },
    ],
    reminders: [
      { atDay: 30, recipients: ["trainer", "recruiter"], kind: "checkin",
        message: "📚 Đơn {orderCode}: 1 tháng ở W3 — báo cáo tiến độ đào tạo lớp/khoá." },
      { atDay: 60, recipients: ["manager"], kind: "checkin",
        message: "📊 Đơn {orderCode}: 2 tháng W3 — cập nhật điểm mid-term + dự đoán % đậu." },
      { atDay: 100, recipients: ["manager", "admin"], kind: "overdue",
        message: "⚠️ Đơn {orderCode} ở W3 đã {daysOverdue} ngày quá hạn — cần kéo dài/lùi đợt?" },
    ],
  },
  {
    order: 4, code: "w4",
    name: "Phỏng vấn đối tác",
    durationDays: 14, minDurationDays: 7, maxDurationDays: 30,
    responsibleRole: "recruiter",
    approverRoles: ["manager"],
    description: `Sắp xếp phỏng vấn (online/offline) với đối tác nước ngoài.\nMục tiêu: đối tác chốt danh sách trúng tuyển chính thức + dự bị.`,
    deliverables: [
      { item: "Danh sách trúng tuyển chính thức từ đối tác" },
      { item: "Danh sách dự bị (nếu có)" },
      { item: "Email/biên bản xác nhận từ đối tác" },
    ],
    reminders: [
      { atDay: 7, recipients: ["recruiter"], kind: "checkin",
        message: "🎤 Đơn {orderCode}: 1 tuần ở W4 — cập nhật ngày phỏng vấn + danh sách trúng tuyển." },
      { atDay: 14, recipients: ["manager"], kind: "overdue",
        message: "⚠️ Đơn {orderCode} ở W4 quá {daysOverdue} ngày — chưa có kết quả phỏng vấn." },
    ],
  },
  {
    order: 5, code: "w5",
    name: "Ký hợp đồng",
    durationDays: 14, minDurationDays: 5, maxDurationDays: 30,
    responsibleRole: "manager",
    approverRoles: ["admin", "accountant"],
    description: `Ký HĐ giữa LĐ × công ty môi giới × đối tác. Thu phí dịch vụ + đặt cọc.\nMỗi LĐ trúng tuyển → 1 hồ sơ Contracts trong hệ thống.`,
    deliverables: [
      { item: "HĐ đã ký 3 bên" },
      { item: "Bảng kê phí dịch vụ chi tiết" },
      { item: "Cọc thu đủ — kế toán xác nhận" },
    ],
    reminders: [
      { atDay: 7, recipients: ["accountant", "manager"], kind: "checkin",
        message: "📝 Đơn {orderCode}: 1 tuần W5 — kiểm tra số HĐ đã ký + cọc đã thu." },
      { atDay: 14, recipients: ["manager", "admin"], kind: "overdue",
        message: "⚠️ Đơn {orderCode} ở W5 quá {daysOverdue} ngày — HĐ chưa ký đủ." },
    ],
  },
  {
    order: 6, code: "w6",
    name: "Xin visa / COE",
    durationDays: 60, minDurationDays: 30, maxDurationDays: 120,
    responsibleRole: "visa_specialist",
    approverRoles: ["manager"],
    description: `Hoàn thiện hồ sơ COE (Nhật) / EPS (Hàn) / E-7 / B-1 / ...\nNộp đại sứ quán / lãnh sự / tổng cục di trú.\nThời gian tuỳ thị trường: COE Nhật 1-2 tháng, EPS Hàn 2-3 tháng.`,
    deliverables: [
      { item: "Hồ sơ COE/EPS/visa nộp đầy đủ" },
      { item: "Visa/COE đã được cấp cho từng LĐ" },
    ],
    qualityChecks: [
      { check: "Đủ giấy tờ theo checklist đại sứ quán" },
      { check: "Hộ chiếu còn hạn ≥ 18 tháng kể từ ngày dự kiến XC" },
      { check: "Khớp tên/ngày sinh giữa các giấy tờ" },
    ],
    reminders: [
      { atDay: 30, recipients: ["visa_specialist", "manager"], kind: "checkin",
        message: "🛂 Đơn {orderCode}: 1 tháng ở W6 — cập nhật số hồ sơ visa đã được duyệt/từ chối." },
      { atDay: 60, recipients: ["manager"], kind: "checkin",
        message: "🛂 Đơn {orderCode}: 2 tháng W6 — danh sách visa pending còn lại?" },
      { atDay: 90, recipients: ["admin", "manager"], kind: "critical",
        message: "🚨 Đơn {orderCode} ở W6 đã {daysOverdue} ngày — cần can thiệp." },
    ],
  },
  {
    order: 7, code: "w7",
    name: "Xuất cảnh",
    durationDays: 14, minDurationDays: 3, maxDurationDays: 30,
    responsibleRole: "visa_specialist",
    approverRoles: ["manager"],
    description: `Đặt vé máy bay, lễ xuất cảnh, đón tại sân bay đến (qua đối tác).\nKiểm tra hành lý, giấy tờ trước khi LĐ ra sân bay.`,
    deliverables: [
      { item: "Vé máy bay đã đặt cho từng LĐ" },
      { item: "Danh sách hành khách + chuyến bay" },
      { item: "LĐ đã xuất cảnh thành công" },
    ],
    reminders: [
      { atDay: 3, recipients: ["visa_specialist"], kind: "checkin",
        message: "✈️ Đơn {orderCode}: chuẩn bị vé + hành lý cho LĐ." },
      { atDay: 14, recipients: ["manager"], kind: "overdue",
        message: "⚠️ Đơn {orderCode} ở W7 quá {daysOverdue} ngày — chưa xuất cảnh hết?" },
    ],
  },
  {
    order: 8, code: "w8",
    name: "Quản lý sau xuất cảnh",
    durationDays: 1080, minDurationDays: 360, maxDurationDays: 1800,
    responsibleRole: "manager",
    approverRoles: [],
    description: `Theo dõi LĐ tại nước đến, hỗ trợ khi có vấn đề (bị phạt, ốm, bỏ trốn, gia hạn HĐ).\nDuy trì liên lạc định kỳ (3 tháng/lần).\nKết thúc khi LĐ về nước hoặc hết HĐ.`,
    deliverables: [
      { item: "Báo cáo định kỳ tình hình LĐ" },
      { item: "Xử lý khiếu nại từ đối tác / LĐ" },
      { item: "Hồ sơ kết thúc khi LĐ về nước" },
    ],
    reminders: [
      { atDay: 90, recipients: ["manager"], kind: "checkin",
        message: "📞 Đơn {orderCode}: 3 tháng sau xuất cảnh — liên lạc LĐ + đối tác lấy phản hồi." },
      { atDay: 365, recipients: ["manager", "admin"], kind: "checkin",
        message: "📅 Đơn {orderCode}: tròn 1 năm — đối soát công nợ + cập nhật trạng thái LĐ." },
    ],
  },
  {
    order: 9, code: "done",
    name: "Hoàn thành",
    durationDays: 0,
    responsibleRole: "manager",
    approverRoles: [],
    description: "Đơn đã đóng. Tất cả LĐ đã về nước hoặc kết thúc HĐ.",
    deliverables: [
      { item: "Tất cả contracts ở trạng thái completed/terminated" },
      { item: "Đối soát công nợ với đối tác" },
    ],
    reminders: [],
  },
];

async function main() {
  console.log(`→ Login Payload @ ${PAYLOAD_URL}`);
  const loginRes = await fetch(`${PAYLOAD_URL}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!loginRes.ok) {
    console.error(`Login failed: ${loginRes.status}`);
    process.exit(1);
  }
  const { token } = (await loginRes.json()) as { token: string };
  const auth = { Authorization: `JWT ${token}` };
  console.log("✓ Login OK\n");

  // ── Step 1: upsert Workflow ──────────────────────────────────
  const wfFind = await fetch(
    `${PAYLOAD_URL}/api/workflows?where[slug][equals]=${WORKFLOW.slug}&limit=1`,
    { headers: auth },
  );
  const wfFound = (await wfFind.json()) as { docs: Array<{ id: string }> };
  let workflowId: string;
  if (wfFound.docs.length > 0) {
    workflowId = wfFound.docs[0].id;
    await fetch(`${PAYLOAD_URL}/api/workflows/${workflowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(WORKFLOW),
    });
    console.log(`✓ Updated workflow #${workflowId} (${WORKFLOW.slug})`);
  } else {
    const r = await fetch(`${PAYLOAD_URL}/api/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(WORKFLOW),
    });
    if (!r.ok) {
      console.error(`Create workflow failed: ${r.status} ${await r.text()}`);
      process.exit(1);
    }
    const j = (await r.json()) as { doc: { id: string } };
    workflowId = j.doc.id;
    console.log(`✓ Created workflow #${workflowId} (${WORKFLOW.slug})`);
  }

  // ── Step 2: upsert stages ────────────────────────────────────
  console.log();
  for (const stage of STAGES) {
    const stageFind = await fetch(
      `${PAYLOAD_URL}/api/workflow-stages?where[and][0][workflow][equals]=${workflowId}&where[and][1][code][equals]=${stage.code}&limit=1`,
      { headers: auth },
    );
    const found = (await stageFind.json()) as { docs: Array<{ id: string }> };
    const body = { ...stage, workflow: workflowId, isActive: true };

    if (found.docs.length > 0) {
      const id = found.docs[0].id;
      const r = await fetch(`${PAYLOAD_URL}/api/workflow-stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify(body),
      });
      if (r.ok) console.log(`✓ Updated [${stage.code}] ${stage.name}`);
      else console.error(`✗ Update [${stage.code}] failed: ${r.status} ${await r.text()}`);
    } else {
      const r = await fetch(`${PAYLOAD_URL}/api/workflow-stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify(body),
      });
      if (r.ok) console.log(`✓ Created [${stage.code}] ${stage.name}`);
      else console.error(`✗ Create [${stage.code}] failed: ${r.status} ${await r.text()}`);
    }
  }

  console.log(`\nXong. Mở admin → "Workflows" + "Workflow đơn hàng".`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
