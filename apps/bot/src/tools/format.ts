/** Simple text helpers used across tool result rendering. */
import type { PayloadDoc } from "../payload/types.js";

/** Format a list of docs into a compact human-readable summary for Claude. */
export function formatList(docs: PayloadDoc[], titleField: string = "id"): string {
  if (docs.length === 0) return "(không có kết quả)";
  return docs
    .map((d, i) => `${i + 1}. #${d.id} · ${String(d[titleField] ?? "—")}`)
    .join("\n");
}

/** Render full document detail. Strips internal Payload fields. */
export function formatDoc(doc: PayloadDoc): string {
  const skip = new Set(["id", "createdAt", "updatedAt", "_id", "__v"]);
  const lines = [`#${doc.id}`];
  for (const [k, v] of Object.entries(doc)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "object") {
      lines.push(`  ${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`  ${k}: ${v}`);
    }
  }
  lines.push(`  (cập nhật: ${doc.updatedAt})`);
  return lines.join("\n");
}
