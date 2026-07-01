/**
 * Enrich Partner — re-extract đầy đủ thông tin Partner từ SC.extractedFromText
 * (text 5000 chars đã lưu sẵn lúc extract HĐCU lần đầu).
 *
 * Trước đây extract Partner chỉ lấy basic (name, director, phone, address).
 * Bỏ sót: email, taxId, website, bankAccount (số TK, NH, chi nhánh, SWIFT).
 *
 * Script này:
 *   1. Loop tất cả Partner có ≥1 SC
 *   2. Với mỗi Partner: lấy SC sớm nhất → đọc extractedFromText → AI extract full
 *   3. PATCH Partner — CHỈ điền field đang trống (không đè data tay nhập)
 *
 * Idempotent: chạy lại an toàn (chỉ điền trống).
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getConfig } from "../config.js";

const PROMPT = `Bạn là JSON extractor cho thông tin BÊN B (Nghiệp đoàn / 監理団体 / Bên Tiếp nhận) từ HĐCU XKLĐ.

⚠️ OUTPUT: JSON DUY NHẤT. Bắt đầu '{', kết thúc '}'. Không markdown, không giải thích.

{
  "name": string,
  "nameJp": string|null,
  "address": string|null,
  "phone": string|null,
  "fax": string|null,
  "email": string|null,
  "website": string|null,
  "taxId": string|null,
  "directorName": string|null,
  "directorPosition": string|null,
  "licenseNo": string|null,
  "bankAccount": {
    "holder": string|null,
    "number": string|null,
    "bank": string|null,
    "branch": string|null,
    "swift": string|null
  }
}

QUY TẮC:
- BỎ QUA hoàn toàn BÊN A (TLG / 送出機関 / Bên Cung ứng) — chỉ trích BÊN B.
- BÊN B = Nghiệp đoàn / 監理団体 / Bên Tiếp nhận / Đối tác giới thiệu việc làm.
- Bank info: lấy "Tài khoản BÊN B nhận tiền". KHÔNG nhầm với TK của TLG (BIDV, JOINT STOCK...).
- Thiếu → null. KHÔNG bịa.`;

function findJson(raw: string): string | null {
  const s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (s.startsWith("{")) return s;
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

interface PartnerData {
  name?: string;
  nameJp?: string | null;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  taxId?: string | null;
  directorName?: string | null;
  directorPosition?: string | null;
  licenseNo?: string | null;
  bankAccount?: {
    holder?: string | null;
    number?: string | null;
    bank?: string | null;
    branch?: string | null;
    swift?: string | null;
  };
}

async function extractFromText(text: string, tag: string): Promise<PartnerData | null> {
  const cfg = getConfig();
  const truncated = text.length > 6000 ? text.slice(0, 6000) : text;
  const prompt =
    `Output JSON ONLY. Start with '{'.\n\nHĐCU text:\n${truncated}\n\nJSON:`;
  const q = query({
    prompt,
    options: {
      systemPrompt: { type: "preset", preset: "claude_code", append: PROMPT },
      tools: [], mcpServers: {}, permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true, maxTurns: 1,
      model: cfg.CLAUDE_MODEL, persistSession: false,
      ...(cfg.CLAUDE_BIN ? { pathToClaudeCodeExecutable: cfg.CLAUDE_BIN } : {}),
    },
  });
  let raw = "";
  for await (const msg of q) {
    if (msg.type === "result") {
      if (msg.subtype === "success") raw = msg.result;
      else throw new Error(`${tag} fail: ${msg.subtype}`);
      break;
    }
  }
  const block = findJson(raw);
  if (!block) throw new Error(`${tag} no JSON`);
  return JSON.parse(block) as PartnerData;
}

interface PartnerRow {
  id: string;
  name: string;
  directorName?: string | null;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  website?: string | null;
  taxId?: string | null;
  bankAccount?: { holder?: string | null; number?: string | null; bank?: string | null; branch?: string | null; swift?: string | null };
}

interface SCRow {
  id: string;
  partner?: string | { id: string };
  extractedFromText?: string;
  signedDate?: string;
  media?: string | { id: string; extractedText?: string };
}

async function getTextSource(sc: SCRow): Promise<string> {
  // Ưu tiên SC.extractedFromText (5K chars đã lưu sẵn)
  const ft = sc.extractedFromText ?? "";
  if (ft.length >= 500) return ft;
  // Fallback: load Media → extractedText (raw OCR, có thể ~10K+ chars)
  const mediaId = typeof sc.media === "string" ? sc.media : sc.media?.id;
  if (!mediaId) return ft;
  try {
    const m = await payload.request<{ extractedText?: string }>(
      `/api/media/${encodeURIComponent(mediaId)}`,
    );
    return m.extractedText ?? ft;
  } catch {
    return ft;
  }
}

async function main(): Promise<void> {
  loadConfig();
  const apply = process.argv.includes("--apply");
  logger.info("Enrich", `▶▶▶ ${apply ? "APPLY" : "DRY-RUN"} enrich Partners from SC.extractedFromText`);

  // 1. Load all SC depth=0 → group by partner
  const sc = await payload.request<{ docs: SCRow[]; totalDocs: number }>(
    `/api/supply-contracts`,
    { query: { limit: 500, depth: 0 } },
  );

  const byPartner = new Map<string, SCRow[]>();
  for (const s of sc.docs) {
    const pid = typeof s.partner === "string" ? s.partner : s.partner?.id;
    if (!pid) continue;
    if (!byPartner.has(pid)) byPartner.set(pid, []);
    byPartner.get(pid)!.push(s);
  }
  logger.info("Enrich", `${byPartner.size} partner có SC. Bắt đầu extract...`);

  let enriched = 0, skipped = 0, failed = 0;

  for (const [pid, scs] of byPartner) {
    try {
      // Load Partner current state
      const current = await payload.request<PartnerRow>(`/api/partners/${pid}`);

      // Sort SC theo signedDate, thử từng cái — đọc text source (SC.extractedFromText
      // hoặc fallback Media.extractedText) đến khi tìm được text >= 500 chars.
      const sorted = scs.sort((a, b) => (a.signedDate ?? "").localeCompare(b.signedDate ?? ""));
      let text = "";
      for (const sc of sorted) {
        text = await getTextSource(sc);
        if (text.length >= 500) break;
      }
      if (text.length < 500) {
        logger.info("Enrich", `  ⊘ ${current.name}: tất cả SC/Media text quá ngắn`);
        skipped += 1;
        continue;
      }

      const data = await extractFromText(text, current.name);
      if (!data) { skipped += 1; continue; }

      // Build patch — chỉ điền field hiện đang trống
      const patch: Record<string, unknown> = {};
      const setIfEmpty = (k: keyof PartnerRow, v: unknown) => {
        if (v && (!current[k] || String(current[k]).trim() === "")) patch[k] = v;
      };
      setIfEmpty("directorName", data.directorName);
      setIfEmpty("email", data.email);
      setIfEmpty("phone", data.phone);
      setIfEmpty("address", data.address);
      setIfEmpty("website", data.website);
      setIfEmpty("taxId", data.taxId);

      // bankAccount — merge field-by-field
      if (data.bankAccount) {
        const oldBA = current.bankAccount ?? {};
        const newBA: Record<string, string | null> = {};
        let bankChanged = false;
        for (const k of ["holder", "number", "bank", "branch", "swift"] as const) {
          const old = oldBA[k];
          const fresh = data.bankAccount[k];
          if (fresh && (!old || String(old).trim() === "")) {
            newBA[k] = fresh;
            bankChanged = true;
          } else if (old) {
            newBA[k] = old;
          }
        }
        if (bankChanged) patch.bankAccount = newBA;
      }

      const changedFields = Object.keys(patch);
      if (changedFields.length === 0) {
        logger.info("Enrich", `  ⊘ ${current.name}: đã đủ field, không cần update`);
        skipped += 1;
        continue;
      }

      logger.info("Enrich", `  ${apply ? "✓ patch" : "→ would patch"} ${current.name}: ${changedFields.join(", ")}`);
      if (apply) {
        await payload.request(`/api/partners/${pid}`, { method: "PATCH", body: patch });
      }
      enriched += 1;
    } catch (err) {
      const reason = err instanceof PayloadError ? err.message : err instanceof Error ? err.message : String(err);
      logger.error("Enrich", `  ✗ partner ${pid}: ${reason}`);
      failed += 1;
    }
  }

  logger.info("Enrich", `\n╔═══════════════════════════════════════╗`);
  logger.info("Enrich", `║ ${apply ? "APPLY" : "DRY-RUN"} DONE`);
  logger.info("Enrich", `║   enriched: ${enriched}`);
  logger.info("Enrich", `║   skipped:  ${skipped}`);
  logger.info("Enrich", `║   failed:   ${failed}`);
  logger.info("Enrich", `╚═══════════════════════════════════════╝`);
  if (!apply) logger.info("Enrich", `\nDry-run xong. Run lại với --apply.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
