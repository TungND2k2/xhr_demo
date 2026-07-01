/**
 * Cleanup data sai bản chất do bulk-import HĐCU trước đó tạo:
 *  - 62 Order draft có notes chứa "Bulk imported từ file scan HĐCU"
 *    (vì HĐCU không phải đơn tuyển — sẽ tạo lại thành SupplyContract)
 *  - 62 Partner record (đã tạo từ Order.employer parse filename — data
 *    nghèo, sẽ tạo lại từ HĐCU thật khi extract)
 *
 * Idempotent: chỉ xoá record có dấu hiệu rõ ràng từ bulk-import.
 * Media giữ nguyên — extract script sau dùng lại.
 *
 * ⚠️ KHÔNG đụng Order tạo bởi user/admin (notes khác).
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

async function deleteAll<T extends { id: string }>(
  slug: string,
  where: Record<string, unknown>,
  label: string,
): Promise<number> {
  let deleted = 0;
  // Page through 100 at a time để tránh giật DB
  for (let i = 0; i < 50; i++) {
    const res = await payload.request<{ docs: T[]; totalDocs: number }>(`/api/${slug}`, {
      query: { where, limit: 50, depth: 0 },
    });
    if (res.docs.length === 0) break;
    for (const d of res.docs) {
      try {
        await payload.request(`/api/${slug}/${encodeURIComponent(d.id)}`, { method: "DELETE" });
        deleted += 1;
      } catch (err) {
        const reason = err instanceof PayloadError ? err.message : String(err);
        logger.warn("Cleanup", `  ⚠ ${label} #${d.id} fail: ${reason}`);
      }
    }
    logger.info("Cleanup", `  deleted ${deleted}/${res.totalDocs} ${label}`);
    if (res.docs.length < 50) break;
  }
  return deleted;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Cleanup", "▶▶▶ Cleanup bulk-import Orders + Partners");

  // 1. Xoá Order có notes chứa "Bulk imported từ file scan HĐCU"
  logger.info("Cleanup", "1. Xoá Order draft do bulk-import tạo:");
  const ordersDeleted = await deleteAll(
    "orders",
    { notes: { contains: "Bulk imported từ file scan HĐCU" } },
    "Order",
  );

  // 2. Xoá toàn bộ Partner (62 record do dedupe script trước tạo).
  //    User confirm xoá hết vì data sẽ tạo lại từ extract HĐCU.
  logger.info("Cleanup", "2. Xoá toàn bộ Partner:");
  const partnersDeleted = await deleteAll("partners", {}, "Partner");

  logger.info("Cleanup", `\n╔═══════════════════════════════════════╗`);
  logger.info("Cleanup", `║ DONE`);
  logger.info("Cleanup", `║   orders deleted:   ${ordersDeleted}`);
  logger.info("Cleanup", `║   partners deleted: ${partnersDeleted}`);
  logger.info("Cleanup", `╚═══════════════════════════════════════╝`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
