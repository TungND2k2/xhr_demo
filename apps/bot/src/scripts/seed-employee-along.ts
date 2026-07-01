/**
 * Seed Employee "A Long" — Cán bộ Cục QLLĐNN, phòng Nhật Bản.
 *
 * Anh Long là cán bộ chuyên trách đăng ký hồ sơ HĐCU + đơn YCTD lên Cục
 * Quản lý Lao động Ngoài nước. Mọi SupplyContract mới mặc định set
 * `responsibleEmployee = A Long` để track tiến độ chấp thuận của Cục.
 *
 * Idempotent: upsert theo `employeeCode = EMP-JP-LONG`.
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

const EMPLOYEE = {
  employeeCode: "EMP-JP-LONG",
  fullName: "Anh Long",
  department: "phong_jp",
  position: "Cán bộ Cục QLLĐNN",
  status: "working",
  notes:
    "Cán bộ phụ trách đăng ký hồ sơ HĐCU + đơn YCTD lên Cục Quản lý Lao động Ngoài nước (Bộ LĐTBXH). Mặc định gán làm responsibleEmployee cho mọi SupplyContract mới.",
};

async function main(): Promise<void> {
  loadConfig();
  logger.info("Seed", `▶▶▶ Upsert employee ${EMPLOYEE.employeeCode}`);

  try {
    const existing = await payload.request<{ docs: Array<{ id: string }> }>(
      `/api/employees`,
      {
        query: {
          where: { employeeCode: { equals: EMPLOYEE.employeeCode } },
          limit: 1,
          depth: 0,
        },
      },
    );

    if (existing.docs.length > 0) {
      const id = existing.docs[0].id;
      await payload.request(`/api/employees/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: EMPLOYEE,
      });
      logger.info("Seed", `↻ updated (#${id})`);
    } else {
      const r = await payload.request<{ doc: { id: string } }>(`/api/employees`, {
        method: "POST",
        body: EMPLOYEE,
      });
      logger.info("Seed", `✓ created (#${r.doc.id})`);
    }
  } catch (err) {
    const reason = err instanceof PayloadError ? err.message : String(err);
    logger.error("Seed", `Failed: ${reason}`);
    process.exit(1);
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
