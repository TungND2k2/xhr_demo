/**
 * So khớp HÓA ĐƠN vs ĐỀ BÀI theo yêu cầu trong guide:
 *  - SL 100% match
 *  - Size 100% match
 *  - Description ≥70% match (Sales cam kết được bypass)
 *
 * Pure function, không gọi mạng — dễ unit test sau.
 */
import type { InvoiceExtract, BriefExtract, DocumentMatchResult } from "./types.js";

function totalQty(items: Array<{ quantity: number }>): number {
  return items.reduce((sum, it) => sum + (it.quantity || 0), 0);
}

function uniqueSizes(items: Array<{ size?: string }>): Set<string> {
  return new Set(items.map((it) => (it.size ?? "").trim().toLowerCase()).filter(Boolean));
}

/** Jaccard-similarity-on-tokens — đơn giản nhưng đủ cho mô tả ngắn. */
function tokenSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Average max-similarity từ items đề bài → items hóa đơn. */
function descSimilarity(invoice: InvoiceExtract, brief: BriefExtract): number {
  if (brief.items.length === 0) return 0;
  const scores = brief.items.map((b) => {
    if (invoice.items.length === 0) return 0;
    const max = Math.max(...invoice.items.map((i) => tokenSimilarity(i.description, b.description)));
    return max;
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function compareDocuments(
  invoice: InvoiceExtract,
  brief: BriefExtract,
): DocumentMatchResult {
  const invQty = totalQty(invoice.items);
  const briQty = totalQty(brief.items);
  const qtyMatch = invQty > 0 && briQty > 0 && invQty === briQty;

  const invSizes = uniqueSizes(invoice.items);
  const briSizes = uniqueSizes(brief.items);
  const sizeMatch =
    invSizes.size === briSizes.size &&
    [...invSizes].every((s) => briSizes.has(s));

  const descPercent = Math.round(descSimilarity(invoice, brief) * 100);

  let status: DocumentMatchResult["status"];
  const details: string[] = [];

  if (!qtyMatch) {
    status = "rejected";
    details.push(`SL không khớp: hóa đơn ${invQty} vs đề bài ${briQty}`);
  } else if (!sizeMatch) {
    status = "rejected";
    details.push(`Size không khớp: ${[...invSizes].join(",")} vs ${[...briSizes].join(",")}`);
  } else if (descPercent < 70) {
    status = "warning";
    details.push(`Mô tả chỉ khớp ${descPercent}% — cần Sales cam kết`);
  } else {
    status = "match";
    details.push(`Khớp 100% SL+size, mô tả ${descPercent}%`);
  }

  return {
    status,
    qtyMatch,
    sizeMatch,
    descMatchPercent: descPercent,
    details: details.join("; "),
  };
}
