/**
 * Index entity từ Payload → Qdrant vector store.
 *
 * Mỗi entity → 1 text "to embed" (build từ các field quan trọng) →
 * embedding 384-dim → upsert vào Qdrant collection cùng tên.
 *
 * Idempotent: upsert theo deterministic UUID (hash docId+collection).
 * Run lại không tạo trùng — chỉ update vector + payload mới.
 *
 * Usage:
 *   node dist/scripts/index-to-vector.js                # index tất cả
 *   node dist/scripts/index-to-vector.js media          # chỉ media
 *   node dist/scripts/index-to-vector.js partners,supply-contracts  # 2 col
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";
import { embedBatch, preloadEmbedModel } from "../vector/embedding.js";
import { ensureCollection, upsertBatch, type VectorPayload } from "../vector/qdrant.js";

interface IndexableConfig {
  collection: string;
  /** Build text để embed từ doc. Càng đầy đủ context càng dễ search. */
  buildText: (doc: Record<string, unknown>) => string;
  /** Build payload metadata cho Qdrant point. */
  buildPayload: (doc: Record<string, unknown>) => VectorPayload;
}

const CONFIGS: IndexableConfig[] = [
  {
    collection: "media",
    buildText: (d) => {
      const parts: string[] = [];
      if (d.filename) parts.push(String(d.filename));
      if (d.alt) parts.push(String(d.alt));
      if (d.kind) parts.push(`Loại: ${d.kind}`);
      if (d.description) parts.push(String(d.description));
      if (d.extractedText) parts.push(String(d.extractedText).slice(0, 800));
      return parts.join("\n");
    },
    buildPayload: (d) => ({
      docId: String(d.id),
      collection: "media",
      title: String(d.alt ?? d.filename ?? d.id),
      snippet: String(d.description ?? d.alt ?? "").slice(0, 200),
      kind: d.kind ?? null,
      uploadedFrom: d.uploadedFrom ?? null,
    }),
  },
  {
    collection: "partners",
    buildText: (d) => {
      const parts: string[] = [];
      if (d.name) parts.push(`Tên: ${d.name}`);
      if (d.directorName) parts.push(`Giám đốc: ${d.directorName}`);
      if (d.address) parts.push(`Địa chỉ: ${d.address}`);
      if (d.country) parts.push(`Nước: ${d.country}`);
      if (d.email) parts.push(`Email: ${d.email}`);
      if (d.phone) parts.push(`SĐT: ${d.phone}`);
      if (d.notes) parts.push(String(d.notes));
      return parts.join("\n");
    },
    buildPayload: (d) => ({
      docId: String(d.id),
      collection: "partners",
      title: String(d.name ?? d.id),
      snippet: [d.directorName, d.address].filter(Boolean).join(" — ").slice(0, 200),
      country: d.country ?? null,
      active: d.active ?? null,
    }),
  },
  {
    collection: "supply-contracts",
    buildText: (d) => {
      const parts: string[] = [];
      if (d.contractNumber) parts.push(`Số HĐ: ${d.contractNumber}`);
      if (d.programType) parts.push(`Chương trình: ${String(d.programType).toUpperCase()}`);
      const partner = d.partner as Record<string, unknown> | string | undefined;
      if (partner && typeof partner === "object" && partner.name) {
        parts.push(`Đối tác: ${partner.name}`);
      }
      if (d.signedDate) parts.push(`Ký: ${String(d.signedDate).slice(0, 10)}`);
      const addendums = d.addendums as Array<unknown> | undefined;
      if (addendums && addendums.length > 0) parts.push(`Có ${addendums.length} phụ lục HĐ (PLHD)`);
      const tlgRep = d.tlgRep as { name?: string } | undefined;
      const partnerRep = d.partnerRep as { name?: string } | undefined;
      if (tlgRep?.name) parts.push(`Đại diện TLG: ${tlgRep.name}`);
      if (partnerRep?.name) parts.push(`Đại diện đối tác: ${partnerRep.name}`);
      const terms = d.terms as Record<string, unknown> | undefined;
      if (terms?.salaryNote) parts.push(`Lương: ${terms.salaryNote}`);
      if (terms?.additionalTerms) parts.push(`Điều khoản: ${terms.additionalTerms}`);
      if (d.extractedFromText) parts.push(String(d.extractedFromText).slice(0, 600));
      return parts.join("\n");
    },
    buildPayload: (d) => {
      const partner = d.partner as Record<string, unknown> | string | undefined;
      const isObj = partner && typeof partner === "object";
      const partnerId = isObj ? String((partner as { id?: string }).id ?? "") : String(partner ?? "");
      const partnerName = isObj ? String((partner as { name?: string }).name ?? "") : "";
      return {
        docId: String(d.id),
        collection: "supply-contracts",
        title: String(d.contractNumber ?? d.id),
        snippet: [
          partnerName ? `Đối tác: ${partnerName}` : null,
          partnerId ? `partnerId: ${partnerId}` : null,
          d.signedDate ? `Ký ${String(d.signedDate).slice(0, 10)}` : null,
        ]
          .filter(Boolean)
          .join(" — ")
          .slice(0, 300),
        status: d.status ?? null,
        partnerId: partnerId || null,
        partnerName: partnerName || null,
      };
    },
  },
  {
    collection: "orders",
    buildText: (d) => {
      const parts: string[] = [];
      if (d.orderCode) parts.push(`Mã: ${d.orderCode}`);
      if (d.employer) parts.push(`Đối tác: ${d.employer}`);
      if (d.position) parts.push(`Vị trí: ${d.position}`);
      if (d.market) parts.push(`Thị trường: ${d.market}`);
      if (d.quantityNeeded) parts.push(`SL: ${d.quantityNeeded}`);
      if (d.notes) parts.push(String(d.notes));
      return parts.join("\n");
    },
    buildPayload: (d) => {
      const partner = d.partner as Record<string, unknown> | string | undefined;
      const isObj = partner && typeof partner === "object";
      const partnerId = isObj ? String((partner as { id?: string }).id ?? "") : (typeof partner === "string" ? partner : "");
      const partnerName = isObj ? String((partner as { name?: string }).name ?? "") : "";
      return {
        docId: String(d.id),
        collection: "orders",
        title: String(d.orderCode ?? d.id),
        snippet: [d.employer, d.position, partnerId ? `partnerId: ${partnerId}` : null]
          .filter(Boolean)
          .join(" — ")
          .slice(0, 300),
        market: d.market ?? null,
        status: d.status ?? null,
        partnerId: partnerId || null,
        partnerName: partnerName || null,
      };
    },
  },
  {
    collection: "workers",
    buildText: (d) => {
      const parts: string[] = [];
      if (d.workerCode) parts.push(`Mã: ${d.workerCode}`);
      if (d.fullName) parts.push(`Họ tên: ${d.fullName}`);
      if (d.dateOfBirth) parts.push(`Ngày sinh: ${String(d.dateOfBirth).slice(0, 10)}`);
      if (d.hometown) parts.push(`Quê: ${d.hometown}`);
      if (d.languages) parts.push(`Ngôn ngữ: ${JSON.stringify(d.languages)}`);
      if (d.skills) parts.push(`Kỹ năng: ${JSON.stringify(d.skills)}`);
      if (d.status) parts.push(`Status: ${d.status}`);
      if (d.notes) parts.push(String(d.notes));
      return parts.join("\n");
    },
    buildPayload: (d) => ({
      docId: String(d.id),
      collection: "workers",
      title: String(d.fullName ?? d.workerCode ?? d.id),
      snippet: [d.workerCode, d.hometown, d.status].filter(Boolean).join(" — ").slice(0, 200),
      status: d.status ?? null,
      gender: d.gender ?? null,
    }),
  },
];

const BATCH_SIZE = 8;

async function indexOne(cfg: IndexableConfig, wipe = false): Promise<{ indexed: number; failed: number }> {
  logger.info("Index", `▶ Collection ${cfg.collection}${wipe ? " (WIPE before reindex)" : ""}`);
  if (wipe) {
    try {
      const { qdrant } = await import("../vector/qdrant.js");
      await qdrant().deleteCollection(cfg.collection);
      logger.info("Index", `  ⨯ deleted old collection`);
    } catch (e) {
      void e;
    }
  }
  await ensureCollection(cfg.collection);

  let page = 1;
  let indexed = 0;
  let failed = 0;

  for (;;) {
    const res = await payload.request<{ docs: Record<string, unknown>[]; totalPages: number }>(
      `/api/${cfg.collection}`,
      { query: { limit: BATCH_SIZE, page, depth: 1 } },
    );
    if (res.docs.length === 0) break;

    try {
      const texts = res.docs.map(cfg.buildText);
      const vectors = await embedBatch(texts, "passage");
      const points = res.docs.map((d, i) => ({
        vector: vectors[i],
        payload: cfg.buildPayload(d),
      }));
      // Retry 1 lần nếu fetch fail (network blip / qdrant busy)
      let attempt = 0;
      const maxAttempts = 2;
      let ok = false;
      while (attempt < maxAttempts && !ok) {
        try {
          await upsertBatch(cfg.collection, points);
          ok = true;
        } catch (e) {
          attempt += 1;
          if (attempt >= maxAttempts) throw e;
          logger.warn("Index", `  page ${page} retry ${attempt} sau lỗi: ${String(e).slice(0, 100)}`);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      indexed += res.docs.length;
      logger.info("Index", `  page ${page} → ${res.docs.length} points (total ${indexed})`);
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : String(e);
      logger.error("Index", `  page ${page} fail: ${reason}`);
      failed += res.docs.length;
    }

    if (page >= res.totalPages) break;
    page += 1;
  }

  return { indexed, failed };
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Index", "▶▶▶ Preloading embedding model...");
  await preloadEmbedModel();
  logger.info("Index", "Model ready");

  const wipe = process.argv.includes("--wipe");
  const arg = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
  const targets = arg
    ? CONFIGS.filter((c) => arg.split(",").includes(c.collection))
    : CONFIGS;

  if (targets.length === 0) {
    console.error(`Unknown collection: ${arg}. Available: ${CONFIGS.map((c) => c.collection).join(", ")}`);
    process.exit(1);
  }

  const summary: Array<[string, number, number]> = [];
  for (const cfg of targets) {
    const { indexed, failed } = await indexOne(cfg, wipe);
    summary.push([cfg.collection, indexed, failed]);
  }

  logger.info("Index", `\n╔═══════════════════════════════════════╗`);
  logger.info("Index", `║ DONE`);
  for (const [col, idx, fail] of summary) {
    logger.info("Index", `║   ${col}: indexed=${idx} failed=${fail}`);
  }
  logger.info("Index", `╚═══════════════════════════════════════╝`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
