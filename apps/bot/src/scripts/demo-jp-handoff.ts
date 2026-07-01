/**
 * Demo: tạo 1 Worker test, đẩy qua 4 status để 4 topic JP nhận handoff.
 *
 * Mỗi PATCH chờ 5s để admin kịp xem Telegram. Cuối cùng giữ Worker để
 * admin/AI có thể xoá tay nếu muốn (hoặc set status=blacklisted).
 *
 * Usage:
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/demo-jp-handoff.js
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

const SLEEP_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface WorkerRow {
  id: string;
  workerCode?: string;
  fullName?: string;
  status?: string;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Demo", "▶▶▶ JP handoff demo");

  // 1. Tạo Worker
  logger.info("Demo", "→ Tạo Worker test (status=new, market=jp)");
  const r = await payload.request<{ doc: WorkerRow }>("/api/workers", {
    method: "POST",
    body: {
      fullName: "DEMO HANDOFF TEST",
      status: "new",
      market: "jp",
      dob: "2000-01-01",
      gender: "male",
      phone: "0900000000",
      hometown: "Hà Nội",
      recruitedAt: new Date().toISOString().slice(0, 10),
    },
  });
  const id = r.doc.id;
  logger.info("Demo", `  ✓ created Worker#${id} (${r.doc.workerCode ?? "no-code"})`);

  // 2. Chuỗi PATCH status — mỗi lần trigger handoff sang topic kế tiếp
  const steps: Array<{ status: string; handoffTo: string }> = [
    { status: "agreed", handoffTo: "W2 — Khám sức khoẻ" },
    { status: "health_check", handoffTo: "W3 — Đào tạo + Cọc" },
    { status: "passed", handoffTo: "W5 — Ký hợp đồng" },
    { status: "contracted", handoffTo: "W6 — Visa + COE" },
  ];

  for (const step of steps) {
    await sleep(SLEEP_MS);
    logger.info("Demo", `→ PATCH status="${step.status}" (kỳ vọng handoff vào topic ${step.handoffTo})`);
    try {
      await payload.request(`/api/workers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { status: step.status },
      });
      logger.info("Demo", `  ✓ patched, chờ ${SLEEP_MS / 1000}s để xem Telegram...`);
    } catch (e) {
      logger.error("Demo", `  ✗ patch fail: ${e instanceof PayloadError ? e.message : e}`);
    }
  }

  logger.info("Demo", "");
  logger.info("Demo", "╔═══════════════════════════════════════╗");
  logger.info("Demo", `║ DONE — Worker test #${id}`);
  logger.info("Demo", "║ Mở 4 topic Telegram để xem handoff:");
  logger.info("Demo", "║   • W2 Khám SK");
  logger.info("Demo", "║   • W3 Đào tạo");
  logger.info("Demo", "║   • W5 Ký HĐ");
  logger.info("Demo", "║   • W6 Visa");
  logger.info("Demo", "║");
  logger.info("Demo", `║ Xoá Worker khi không cần: DELETE /api/workers/${id}`);
  logger.info("Demo", "╚═══════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
