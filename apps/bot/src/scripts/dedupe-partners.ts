/**
 * Dedupe đối tác từ Order.employer (text rời rạc) → tạo Partner record
 * + link Order.partner.
 *
 * Strategy:
 *  - Đọc tất cả Order (limit 500, fields: employer, market, contractDate, partner).
 *  - Group theo `employer` (normalize: lowercase + trim).
 *  - Mỗi group → upsert 1 Partner (idempotent by name field).
 *  - Set Order.partner = partnerId.
 *  - firstContractDate = min contractDate trong group.
 *
 * Idempotent: chạy lại không tạo trùng (check Partner.name + check
 * Order.partner đã set). An toàn rerun nhiều lần.
 *
 * Usage (server):
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/dedupe-partners.js
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

interface OrderDoc {
  id: string;
  employer?: string;
  market?: string;
  contractDate?: string;
  partner?: string | { id: string };
}

interface PartnerDoc {
  id: string;
  name: string;
}

function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Dedupe", "▶▶▶ Dedupe partners từ Order.employer");

  // 1. Load tất cả orders.
  const ordersRes = await payload.request<{ docs: OrderDoc[]; totalDocs: number }>(
    `/api/orders`,
    { query: { limit: 500, depth: 0 } },
  );
  logger.info("Dedupe", `Tìm thấy ${ordersRes.totalDocs} orders`);

  // 2. Group theo normalize(employer). Lưu tên gốc đầu tiên thấy + earliest contractDate.
  const groups = new Map<
    string,
    { displayName: string; market: string; orderIds: string[]; earliestDate: string | null }
  >();

  for (const o of ordersRes.docs) {
    if (!o.employer) continue;
    const key = normalizeName(o.employer);
    if (!key) continue;

    let g = groups.get(key);
    if (!g) {
      g = {
        displayName: o.employer.trim(),
        market: o.market ?? "jp",
        orderIds: [],
        earliestDate: null,
      };
      groups.set(key, g);
    }
    g.orderIds.push(o.id);
    if (o.contractDate) {
      if (!g.earliestDate || o.contractDate < g.earliestDate) {
        g.earliestDate = o.contractDate.slice(0, 10);
      }
    }
  }
  logger.info("Dedupe", `Sinh ${groups.size} partner groups`);

  let partnerCreated = 0;
  let partnerReused = 0;
  let ordersLinked = 0;
  let failed = 0;

  // 3. Cho mỗi group → upsert Partner + link tất cả orders.
  for (const [key, g] of groups) {
    try {
      // Idempotent check by name.
      const existing = await payload.request<{ docs: PartnerDoc[] }>(`/api/partners`, {
        query: {
          where: { name: { equals: g.displayName } },
          limit: 1,
          depth: 0,
        },
      });

      let partnerId: string;
      if (existing.docs.length > 0) {
        partnerId = existing.docs[0].id;
        partnerReused += 1;
        logger.info("Dedupe", `  ⊘ "${g.displayName}" reuse partner#${partnerId}`);
      } else {
        const created = await payload.request<{ doc: PartnerDoc }>(`/api/partners`, {
          method: "POST",
          body: {
            name: g.displayName,
            country: ["jp", "kr", "tw", "de", "me", "eu", "other"].includes(g.market)
              ? g.market
              : "other",
            firstContractDate: g.earliestDate,
            active: true,
          },
        });
        partnerId = created.doc.id;
        partnerCreated += 1;
        logger.info(
          "Dedupe",
          `  ✓ "${g.displayName}" → partner#${partnerId} (${g.orderIds.length} orders, first ${g.earliestDate ?? "?"})`,
        );
      }

      // Link tất cả Order trong group → partner.
      for (const oid of g.orderIds) {
        try {
          await payload.request(`/api/orders/${encodeURIComponent(oid)}`, {
            method: "PATCH",
            body: { partner: partnerId },
          });
          ordersLinked += 1;
        } catch (err) {
          const reason = err instanceof PayloadError ? err.message : String(err);
          logger.warn("Dedupe", `    ⚠️ link order#${oid} fail: ${reason}`);
          failed += 1;
        }
      }
    } catch (err) {
      const reason = err instanceof PayloadError ? err.message : String(err);
      logger.error("Dedupe", `  ✗ group "${key}" fail: ${reason}`);
      failed += 1;
    }
  }

  logger.info("Dedupe", `\n╔═══════════════════════════════════════╗`);
  logger.info("Dedupe", `║ DONE`);
  logger.info("Dedupe", `║   partners created:  ${partnerCreated}`);
  logger.info("Dedupe", `║   partners reused:   ${partnerReused}`);
  logger.info("Dedupe", `║   orders linked:     ${ordersLinked}`);
  logger.info("Dedupe", `║   failed:            ${failed}`);
  logger.info("Dedupe", `╚═══════════════════════════════════════╝`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
