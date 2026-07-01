/**
 * One-shot script: backfill Media.linkedRecords từ các collection sở hữu.
 *
 * Sau khi wire hook sync-media-backlinks, các doc TƯƠNG LAI sẽ tự sync.
 * Script này lo phần data CŨ — duyệt mọi collection có field media, đọc
 * ID media được reference, append vào Media.linkedRecords nếu chưa có.
 *
 * Idempotent: chạy nhiều lần không gây duplicate.
 *
 * Usage:
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/backfill-media-backlinks.js
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

type MediaRef = unknown;
type Extractor = (doc: any) => MediaRef[];

interface OwnerSpec {
  slug: string;
  label: string;
  extract: Extractor;
}

const OWNERS: OwnerSpec[] = [
  {
    slug: "workers",
    label: "Workers",
    extract: (d) => [
      d?.passportScan,
      d?.nationalIdScan,
      d?.photo,
      d?.cvFile,
      d?.healthCertFile,
      ...(Array.isArray(d?.documents) ? d.documents.map((x: any) => x?.file) : []),
    ],
  },
  {
    slug: "contracts",
    label: "Contracts",
    extract: (d) => [
      d?.contractFile,
      d?.visaFile,
      d?.coeFile,
      d?.flightTicketFile,
      ...(Array.isArray(d?.payments) ? d.payments.map((p: any) => p?.receiptFile) : []),
      ...(Array.isArray(d?.otherDocuments) ? d.otherDocuments.map((x: any) => x?.file) : []),
    ],
  },
  {
    slug: "supply-contracts",
    label: "SupplyContracts",
    extract: (d) => [
      d?.media,
      d?.cucApprovalDoc,
      ...(Array.isArray(d?.addendums) ? d.addendums.map((a: any) => a?.file) : []),
    ],
  },
  {
    slug: "orders",
    label: "Orders",
    extract: (d) =>
      Array.isArray(d?.orderDocuments) ? d.orderDocuments.map((x: any) => x?.file) : [],
  },
  {
    slug: "official-documents",
    label: "OfficialDocuments",
    extract: (d) => [
      d?.scanFile,
      ...(Array.isArray(d?.attachments) ? d.attachments : []),
    ],
  },
  {
    slug: "employees",
    label: "Employees",
    extract: (d) => [d?.photo],
  },
];

function refToId(r: MediaRef): string | null {
  if (r == null) return null;
  if (typeof r === "string" || typeof r === "number") return String(r);
  if (typeof r === "object" && r !== null && "id" in r) return String((r as any).id);
  return null;
}

interface LinkRow {
  relationTo: string;
  value: string | { id?: string };
}

async function fetchMediaLinks(mediaId: string): Promise<LinkRow[] | null> {
  try {
    const m = await payload.request<{ linkedRecords?: LinkRow[] }>(
      `/api/media/${encodeURIComponent(mediaId)}`,
      { query: { depth: 0 } },
    );
    return Array.isArray(m.linkedRecords) ? m.linkedRecords : [];
  } catch (e) {
    if (e instanceof PayloadError) return null; // media deleted, skip
    throw e;
  }
}

async function ensureLink(mediaId: string, ownerSlug: string, docId: string): Promise<"added" | "kept" | "missing"> {
  const links = await fetchMediaLinks(mediaId);
  if (links === null) return "missing";
  const has = links.some((l) => {
    if (l.relationTo !== ownerSlug) return false;
    const v = typeof l.value === "object" ? String(l.value?.id) : String(l.value);
    return v === docId;
  });
  if (has) return "kept";
  await payload.request(`/api/media/${encodeURIComponent(mediaId)}`, {
    method: "PATCH",
    body: { linkedRecords: [...links, { relationTo: ownerSlug, value: docId }] },
  });
  return "added";
}

async function backfillOwner(spec: OwnerSpec): Promise<{ docs: number; added: number; kept: number; missing: number }> {
  logger.info("Backfill", `▶ ${spec.label}`);
  let page = 1;
  const limit = 100;
  const totals = { docs: 0, added: 0, kept: 0, missing: 0 };
  while (true) {
    const res = await payload.request<{ docs: any[]; hasNextPage: boolean; totalPages: number }>(
      `/api/${spec.slug}`,
      { query: { depth: 0, limit, page } },
    );
    if (res.docs.length === 0) break;
    for (const doc of res.docs) {
      totals.docs += 1;
      const ids = new Set<string>();
      for (const ref of spec.extract(doc)) {
        const id = refToId(ref);
        if (id) ids.add(id);
      }
      for (const mediaId of ids) {
        const r = await ensureLink(mediaId, spec.slug, String(doc.id));
        totals[r] += 1;
      }
    }
    if (!res.hasNextPage) break;
    page += 1;
  }
  logger.info(
    "Backfill",
    `  ${spec.label}: ${totals.docs} docs · ${totals.added} added · ${totals.kept} already linked · ${totals.missing} media missing`,
  );
  return totals;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Backfill", "▶▶▶ Media.linkedRecords backfill");

  const grand = { docs: 0, added: 0, kept: 0, missing: 0 };
  for (const spec of OWNERS) {
    try {
      const r = await backfillOwner(spec);
      grand.docs += r.docs;
      grand.added += r.added;
      grand.kept += r.kept;
      grand.missing += r.missing;
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : String(e);
      logger.error("Backfill", `  ✗ ${spec.label} failed: ${reason}`);
    }
  }

  logger.info("Backfill", "");
  logger.info("Backfill", "╔═══════════════════════════════════════╗");
  logger.info("Backfill", `║ DONE`);
  logger.info("Backfill", `║   docs visited: ${grand.docs}`);
  logger.info("Backfill", `║   links added:  ${grand.added}`);
  logger.info("Backfill", `║   already in:   ${grand.kept}`);
  logger.info("Backfill", `║   media gone:   ${grand.missing}`);
  logger.info("Backfill", "╚═══════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
