/**
 * Repair SupplyContract có partner = null/missing (orphan).
 *
 * Lý do tồn tại: cleanup script trước đã xoá toàn bộ Partner → các SC
 * cũ đã link mất ref. Script này:
 *
 *   1. Tìm SC có partner null hoặc trỏ về Partner không tồn tại
 *   2. Đọc `extractedFromText` của SC (đoạn text 5000 ký tự đã lưu)
 *   3. Gọi AI parse → lấy partner name + contact
 *   4. Upsert Partner (idempotent by name)
 *   5. PATCH SC.partner = newPartnerId
 *
 * Idempotent: chỉ chạy trên SC orphan. Re-run an toàn.
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getConfig } from "../config.js";

const PARTNER_PROMPT = `Bạn là JSON extractor cho thông tin đối tác từ Hợp đồng cung ứng (HĐCU) XKLĐ.

⚠️ OUTPUT: JSON DUY NHẤT. Bắt đầu '{', kết thúc '}'. Không markdown, không giải thích.

Schema:
{"name":string,"nameJp":string|null,"address":string|null,"phone":string|null,"email":string|null,"directorName":string|null,"directorPosition":string|null,"licenseNo":string|null}

QUY TẮC:
- name = tên BÊN B (Nghiệp đoàn / 監理団体 / Bên Tiếp nhận), ưu tiên tiếng Việt/Anh
- BỎ QUA bên A (TLG/送出機関)
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
  email?: string | null;
  directorName?: string | null;
  directorPosition?: string | null;
  licenseNo?: string | null;
}

async function extractPartner(text: string, scId: string): Promise<PartnerData | null> {
  const cfg = getConfig();
  const truncated = text.length > 6000 ? text.slice(0, 6000) : text;
  const prompt =
    `Output JSON ONLY. Start with '{'.\n\nHĐCU text:\n${truncated}\n\nJSON:`;
  const q = query({
    prompt,
    options: {
      systemPrompt: { type: "preset", preset: "claude_code", append: PARTNER_PROMPT },
      tools: [],
      mcpServers: {},
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 1,
      model: cfg.CLAUDE_MODEL,
      persistSession: false,
      ...(cfg.CLAUDE_BIN ? { pathToClaudeCodeExecutable: cfg.CLAUDE_BIN } : {}),
    },
  });
  let raw = "";
  for await (const msg of q) {
    if (msg.type === "result") {
      if (msg.subtype === "success") raw = msg.result;
      else throw new Error(`SC#${scId} extract fail: ${msg.subtype}`);
      break;
    }
  }
  const block = findJson(raw);
  if (!block) throw new Error(`SC#${scId} no JSON in output`);
  return JSON.parse(block) as PartnerData;
}

async function upsertPartner(data: PartnerData): Promise<string | null> {
  if (!data.name) return null;
  const existing = await payload.request<{ docs: Array<{ id: string }> }>(`/api/partners`, {
    query: { where: { name: { equals: data.name } }, limit: 1, depth: 0 },
  });
  if (existing.docs.length > 0) return existing.docs[0].id;

  const body: Record<string, unknown> = {
    name: data.name,
    country: "jp",
    directorName: data.directorName ?? undefined,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    address: data.address ?? undefined,
    active: true,
  };
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  const created = await payload.request<{ doc: { id: string } }>(`/api/partners`, {
    method: "POST",
    body,
  });
  return created.doc.id;
}

interface SCDoc {
  id: string;
  contractNumber?: string;
  partner?: string | { id: string } | null;
  extractedFromText?: string;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Repair", "▶▶▶ Repair orphan SupplyContracts (partner missing)");

  // 1. Lấy tất cả SC depth=1 — partner sẽ là object nếu Partner còn tồn tại,
  //    string ID (mồ côi) hoặc null nếu đã xoá.
  const all = await payload.request<{ docs: SCDoc[]; totalDocs: number }>(
    `/api/supply-contracts`,
    { query: { limit: 200, depth: 1 } },
  );

  const orphans = all.docs.filter(
    (s) => !s.partner || typeof s.partner !== "object" || !(s.partner as { id?: string }).id,
  );
  logger.info("Repair", `Tổng ${all.totalDocs} SC, orphan: ${orphans.length}`);

  let repaired = 0;
  let failed = 0;

  for (let i = 0; i < orphans.length; i++) {
    const sc = orphans[i];
    const idx = i + 1;
    const tag = `[${idx}/${orphans.length}] SC#${sc.id}${sc.contractNumber ? ` (${sc.contractNumber})` : ""}`;
    const text = sc.extractedFromText ?? "";
    if (text.trim().length < 200) {
      logger.warn("Repair", `${tag} ⊘ extractedFromText quá ngắn (${text.length}) — skip`);
      failed += 1;
      continue;
    }

    try {
      logger.info("Repair", `${tag} ▶ extracting partner...`);
      const data = await extractPartner(text, sc.id);
      if (!data?.name) {
        logger.warn("Repair", `${tag} ⊘ AI không trích tên partner`);
        failed += 1;
        continue;
      }
      const partnerId = await upsertPartner(data);
      if (!partnerId) {
        logger.warn("Repair", `${tag} ⊘ upsert partner fail`);
        failed += 1;
        continue;
      }
      await payload.request(`/api/supply-contracts/${encodeURIComponent(sc.id)}`, {
        method: "PATCH",
        body: { partner: partnerId },
      });
      logger.info("Repair", `${tag} ✓ → partner ${data.name} (#${partnerId})`);
      repaired += 1;
    } catch (err) {
      const reason = err instanceof PayloadError ? err.message : err instanceof Error ? err.message : String(err);
      logger.error("Repair", `${tag} ✗ ${reason}`);
      failed += 1;
    }
  }

  logger.info("Repair", `\n╔═══════════════════════════════════════╗`);
  logger.info("Repair", `║ DONE`);
  logger.info("Repair", `║   repaired: ${repaired}`);
  logger.info("Repair", `║   failed:   ${failed}`);
  logger.info("Repair", `╚═══════════════════════════════════════╝`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
