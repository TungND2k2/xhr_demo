/**
 * E2E demo: 1 LĐ đi từ tuyển → bay sang Nhật → về nước.
 *
 * Mô phỏng mọi action mà nhân viên TLG sẽ làm hằng ngày (qua chat hoặc admin).
 * Mỗi action gọi Payload API trực tiếp; hook + handoff sẽ tự bắn vào Telegram.
 *
 * Usage: node dist/scripts/demo-full-lifecycle.js
 */
import "dotenv/config";
import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

const WAIT_MS = 8_000; // delay giữa các phase, cho admin kịp xem Telegram
const STAMP = new Date().toISOString().slice(11, 19).replace(/:/g, ""); // HHMMSS

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function banner(emoji: string, role: string, narration: string): void {
  console.log("");
  console.log("┏" + "━".repeat(78) + "┓");
  console.log(`┃ ${emoji}  ${role.padEnd(72)} ┃`);
  console.log("┃" + " ".repeat(78) + "┃");
  for (const line of narration.split("\n")) {
    console.log(`┃   ${line.padEnd(74)} ┃`);
  }
  console.log("┗" + "━".repeat(78) + "┛");
}

interface DocId {
  id: string;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Demo", "▶▶▶ FULL LIFECYCLE — TRẦN VĂN TEST");

  // ═══ 0. SETUP: Partner Yamaha + SupplyContract đã chấp thuận Cục ═══
  banner(
    "🏢",
    "Phòng HC (admin) — chuẩn bị HĐCU với đối tác Yamaha",
    `User: "Ký HĐCU mới với Yamaha, programType TTKN"
  → Bot tạo Partner Yamaha + SupplyContract.
  → Gán responsibleEmployee = Anh Long.
  → Set cucApprovalStatus = approved (giả lập Cục đã chấp thuận từ trước).`,
  );

  const partner = await payload.request<{ doc: DocId }>("/api/partners", {
    method: "POST",
    body: {
      name: `TEST Yamaha Nhật Bản ${STAMP}`,
      country: "jp",
      active: true,
    },
  });
  console.log(`   ✓ Partner #${partner.doc.id}`);

  // Lookup Anh Long
  const long = await payload.request<{ docs: DocId[] }>("/api/employees", {
    query: { where: { employeeCode: { equals: "EMP-JP-LONG" } }, limit: 1, depth: 0 },
  });
  const longId = long.docs[0]?.id;

  const sc = await payload.request<{ doc: DocId }>("/api/supply-contracts", {
    method: "POST",
    body: {
      contractNumber: `HĐCU-TEST-${STAMP}`,
      signedDate: "2026-01-15",
      programType: "ttkn",
      status: "active",
      partner: partner.doc.id,
      responsibleEmployee: longId,
      cucApprovalStatus: "approved",
      cucRegistrationDate: "2026-01-20",
      cucResponseDate: "2026-02-15",
    },
  });
  console.log(`   ✓ SupplyContract #${sc.doc.id} (HĐCU-TEST-${STAMP}) — Cục: approved`);

  // ═══ 1. W1 — Tuyển dụng ═══
  await sleep(WAIT_MS);
  banner(
    "🧑‍💼",
    "W1 Tuyển dụng — chị Lan",
    `User trong topic W1: "Trần Văn Test 23 tuổi, SĐT 0912.345.678, Hà Nội,
   muốn đi Nhật chương trình TTKN"
  → Bot create_workers status=researching, market=jp.`,
  );
  const worker = await payload.request<{ doc: { id: string; workerCode?: string } }>(
    "/api/workers",
    {
      method: "POST",
      body: {
        fullName: `TRẦN VĂN TEST ${STAMP}`,
        dob: "2003-05-15",
        gender: "male",
        phone: "0912345678",
        hometown: "Hà Nội",
        market: "jp",
        status: "researching",
        recruitedAt: new Date().toISOString().slice(0, 10),
      },
    },
  );
  const workerId = worker.doc.id;
  const workerCode = worker.doc.workerCode ?? workerId;
  console.log(`   ✓ Worker #${workerId} (${workerCode})`);

  // ═══ 2. status=agreed → handoff W2 ═══
  await sleep(WAIT_MS);
  banner(
    "🧑‍💼",
    "W1 Tuyển dụng — chị Lan",
    `User: "Bạn Test đồng ý đi rồi, update status"
  → Bot update_workers status=agreed.
  → Hệ thống TỰ ĐỘNG bắn message sang W2 Khám sức khoẻ.`,
  );
  await patchWorker(workerId, { status: "agreed" });
  console.log(`   📨 Đợi hand-off → topic W2 Khám SK...`);

  // ═══ 3. W2 → status=health_check ═══
  await sleep(WAIT_MS);
  banner(
    "🏥",
    "W2 Khám sức khoẻ — chị Hoa",
    `User: "Bạn Test khám SK xong, pass, BV Hồng Ngọc, ngày 12/03/2026"
  → Bot update_workers healthCheckDate + healthCheckLocation + status=health_check.
  → Hệ thống bắn sang W3 Đào tạo.`,
  );
  await patchWorker(workerId, {
    healthCheckDate: "2026-03-12",
    healthCheckLocation: "BV Hồng Ngọc Hà Nội",
    healthStatus: "pass",
    status: "health_check",
  });
  console.log(`   📨 Đợi hand-off → topic W3 Đào tạo...`);

  // ═══ 4. W3 → thu cọc 25tr → deposit_paid ═══
  await sleep(WAIT_MS);
  banner(
    "📚",
    "W3 Đào tạo + Cọc — anh Quốc + kế toán",
    `User: "Bạn Test nộp cọc 25tr ngày 15/03/2026, đợt 1 15tr + đợt 2 10tr"
  → Bot update_workers depositAmount, depositDate, depositNote, status=deposit_paid.
  → Hệ thống bắn lại sang W3 (tiếp tục xếp lớp).`,
  );
  await patchWorker(workerId, {
    depositAmount: 25_000_000,
    depositDate: "2026-03-15",
    depositNote: "Đợt 1: 15tr ngày 15/03; đợt 2: 10tr ngày 18/03",
    status: "deposit_paid",
  });
  console.log(`   📨 Đợi hand-off → topic W3 (xếp lớp)...`);

  // ═══ 5. W3 → vào lớp, đào tạo, thi pass → status=passed ═══
  await sleep(WAIT_MS);
  banner(
    "📚",
    "W3 Đào tạo + Cọc — anh Quốc",
    `User: "Xếp Test vào lớp N4-2026-B, học 20/03 → 20/06"
  → Bot update trainingGroup, trainingStartDate, trainingEndDate, status=training.
  → Hệ thống bắn sang W4 Phỏng vấn đối tác.`,
  );
  await patchWorker(workerId, {
    trainingGroup: "N4-2026-B",
    trainingStartDate: "2026-03-20",
    trainingEndDate: "2026-06-20",
    status: "training",
  });
  console.log(`   📨 Đợi hand-off → topic W4 PV đối tác...`);

  await sleep(WAIT_MS);
  banner(
    "🎯",
    "W3 Thi nội bộ — anh Quốc",
    `User: "Test pass thi N4 nội bộ, điểm 82, đẩy sang phỏng vấn đối tác"
  → Bot update examResult=pass, examScore=82, status=passed.
  → Hệ thống bắn sang W5 Ký HĐ.`,
  );
  await patchWorker(workerId, {
    examResult: "pass",
    examScore: 82,
    status: "passed",
  });
  console.log(`   📨 Đợi hand-off → topic W5 Ký HĐ...`);

  // ═══ 6. W5 — Tạo Order + Contract → status=contracted ═══
  await sleep(WAIT_MS);
  banner(
    "📜",
    "W5 Ký hợp đồng — anh Tuấn",
    `User: "Yamaha xác nhận chốt Test, tạo Order + ký HĐ"
  → Bot:
     1. Check HĐCU Yamaha cucApprovalStatus = approved ✓
     2. create_orders (Yamaha, vị trí hàn xì, 1 LĐ)
     3. create_contracts (link Order + Worker, lương 18 万)
     4. update_workers status=contracted → hand-off W6.`,
  );
  const order = await payload.request<{ doc: DocId }>("/api/orders", {
    method: "POST",
    body: {
      orderDate: "2026-06-21",
      market: "jp",
      partner: partner.doc.id,
      employer: "Yamaha Motor Manufacturing Vietnam",
      employerCountry: "jp",
      position: "Công nhân hàn xì",
      quantityNeeded: 1,
      currency: "JPY",
      deadline: "2026-08-30",
      status: "w5",
    },
  });
  console.log(`   ✓ Order #${order.doc.id}`);

  const contract = await payload.request<{ doc: { id: string; contractCode?: string } }>(
    "/api/contracts",
    {
      method: "POST",
      body: {
        order: order.doc.id,
        worker: workerId,
        signingDate: "2026-06-25",
        startDate: "2026-08-01",
        endDate: "2029-08-01",
        salary: 180_000,
        currency: "JPY",
        salaryPeriod: "monthly",
        status: "signed",
      },
    },
  );
  const contractId = contract.doc.id;
  console.log(`   ✓ Contract #${contractId} (${contract.doc.contractCode})`);

  await patchWorker(workerId, { status: "contracted" });
  console.log(`   📨 Đợi hand-off → topic W6 Visa...`);

  // ═══ 7. W6 — COE về → TRIGGER TIMELINE T+1/T+8/T+18 ═══
  await sleep(WAIT_MS);
  banner(
    "🛂",
    "W6 Visa + COE — chị Mai",
    `User: "COE của Test từ Yamaha vừa về hôm nay!"
  → Bot update_contracts coeReceivedAt = TODAY.
  → 🎁 HỆ THỐNG TỰ ĐỘNG (hook trackCoeReceived):
       1. Bắn 1 message vào topic W7 "COE đã về cho LĐ Test"
       2. Tạo 3 reminder T+1/T+8/T+18 trong Reminders collection
          (sẽ ping lại đúng ngày).`,
  );
  const today = new Date().toISOString().slice(0, 10);
  await payload.request(`/api/contracts/${encodeURIComponent(contractId)}`, {
    method: "PATCH",
    body: { coeReceivedAt: today, visaStatus: "submitted" },
  });
  console.log(`   📨 Đợi → topic W7 nhận MSG + 3 REMINDER...`);

  // ═══ 8. visa_prep → handoff W7 (đặt vé) ═══
  await sleep(WAIT_MS);
  banner(
    "🛂",
    "W6 Visa + COE — chị Mai",
    `User: "Visa Test có rồi, sang W7 đặt vé"
  → Bot update_contracts visaStatus=approved, visaApprovedAt + update_workers
     status=visa_prep.
  → Hand-off sang W7 Xuất cảnh.`,
  );
  await payload.request(`/api/contracts/${encodeURIComponent(contractId)}`, {
    method: "PATCH",
    body: { visaStatus: "approved", visaApprovedAt: today },
  });
  await patchWorker(workerId, { status: "visa_prep" });
  console.log(`   📨 Đợi hand-off → topic W7 Xuất cảnh...`);

  // ═══ 9. W7 — Đặt vé, set deploymentDate → status=deployed ═══
  await sleep(WAIT_MS);
  banner(
    "✈️",
    "W7 Xuất cảnh — anh Phong",
    `User: "Đặt vé Test bay VN300 ngày 25/07, sân bay Narita"
  → Bot update_contracts flightNumber, destination, deploymentDate.
  → update_workers status=deployed → hand-off W8.`,
  );
  await payload.request(`/api/contracts/${encodeURIComponent(contractId)}`, {
    method: "PATCH",
    body: {
      flightNumber: "VN300",
      destination: "NRT",
      deploymentDate: "2026-07-25",
      status: "deployed",
    },
  });
  await patchWorker(workerId, { status: "deployed" });
  console.log(`   📨 Đợi hand-off → topic W8 Hậu xuất cảnh...`);

  // ═══ 10. Summary ═══
  await sleep(WAIT_MS);
  console.log("");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║ 🎉  E2E HAPPY PATH HOÀN TẤT" + " ".repeat(50) + "║");
  console.log("╠" + "═".repeat(78) + "╣");
  console.log(`║   Worker:   ${workerId.padEnd(64)} ║`);
  console.log(`║            (${workerCode})` + " ".repeat(78 - 13 - workerCode.length - 1) + "║");
  console.log(`║   Order:    ${order.doc.id.padEnd(64)} ║`);
  console.log(`║   Contract: ${contractId.padEnd(64)} ║`);
  console.log(`║   Partner:  ${partner.doc.id.padEnd(64)} ║`);
  console.log(`║   HĐCU:     ${sc.doc.id.padEnd(64)} ║`);
  console.log("║" + " ".repeat(78) + "║");
  console.log("║ Anh đã thấy trên Telegram:" + " ".repeat(51) + "║");
  console.log("║   • 6 message hand-off (W2, W3×2, W4, W5, W6, W7, W8)" + " ".repeat(24) + "║");
  console.log("║   • 1 message + 3 reminder COE timeline (W7)" + " ".repeat(33) + "║");
  console.log("║" + " ".repeat(78) + "║");
  console.log("║ Check thêm trên admin:" + " ".repeat(55) + "║");
  console.log("║   https://xhr.cms-admin.x-or.cloud/admin" + " ".repeat(37) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
}

async function patchWorker(id: string, body: Record<string, unknown>): Promise<void> {
  try {
    await payload.request(`/api/workers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    });
    console.log(`   ✓ PATCH worker (${Object.keys(body).join(", ")})`);
  } catch (e) {
    const r = e instanceof PayloadError ? e.message : String(e);
    console.error(`   ✗ PATCH worker FAIL: ${r}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
