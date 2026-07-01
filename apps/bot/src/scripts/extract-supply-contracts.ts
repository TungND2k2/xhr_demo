/**
 * Bulk-extract HĐCU từ Media collection — chạy qua tất cả Media kind=contract
 * có extractedText, gọi AI extract → tạo Partner + SupplyContract.
 *
 * Reuse logic của tool MCP `extract_supply_contract` (gọi qua HTTP API
 * lên Payload). Để đơn giản hơn, script gọi trực tiếp Claude SDK + Payload.
 *
 * Idempotent: skip Media đã có SupplyContract link.
 *
 * Usage:
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/extract-supply-contracts.js
 *
 * Performance: ~10-30s AI extract / file. 62 file ≈ 15-30 phút.
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getConfig } from "../config.js";

const EXTRACT_SYSTEM_PROMPT = `Bạn là JSON extractor cho Hợp đồng cung ứng lao động (HĐCU) XKLĐ.

⚠️ OUTPUT FORMAT: response của bạn PHẢI là 1 JSON object DUY NHẤT.
- BẮT ĐẦU response bằng ký tự '{' ngay LẬP TỨC. Không greeting, không "I see", không "Based on".
- KẾT THÚC bằng '}'.
- KHÔNG markdown, KHÔNG code fence (\`\`\`), KHÔNG giải thích.
- KHÔNG dùng tool nào.
- Nếu user hỏi gì khác — vẫn output JSON với mọi field = null.

HĐCU = HĐ TLG (送出機関) ↔ Đối tác Nhật (監理団体). Extract:

{"contractNumber":string|null,"signedDate":"YYYY-MM-DD"|null,"effectiveDate":"YYYY-MM-DD"|null,"expiryDate":"YYYY-MM-DD"|null,"partner":{"name":string,"nameJp":string|null,"address":string|null,"phone":string|null,"fax":string|null,"email":string|null,"directorName":string|null,"directorPosition":string|null,"licenseNo":string|null,"bankAccount":{"holder":string|null,"number":string|null,"bank":string|null,"branch":string|null,"swift":string|null}|null},"tlg":{"directorName":string|null,"directorPosition":string|null,"licenseNo":string|null,"licenseDate":string|null},"terms":{"durationMonths":number|null,"weeklyHours":number|null,"dailyHours":number|null,"leaveDaysPerYear":number|null,"salaryNote":string|null,"serviceFeeNote":string|null,"additionalTerms":string|null}}

Quy tắc: thiếu → null. KHÔNG bịa.`;

/**
 * Validate ISO date string (YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm:ss...).
 * Trả null nếu invalid để Payload không reject.
 */
function safeDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  // Match YYYY-MM-DD ở đầu, optional time sau đó
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (y < 1900 || y > 2100) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Parse ngày ký từ filename HĐCU TLG.
 * Pattern: "01032022" (DDMMYYYY) hoặc "20220103" (YYYYMMDD) ở đầu filename.
 */
function parseDateFromFilename(filename: string): string | null {
  const m = filename.match(/(\d{8})/);
  if (!m) return null;
  const s = m[1];
  const a = parseInt(s.slice(0, 2), 10);
  const b = parseInt(s.slice(2, 4), 10);
  const c = parseInt(s.slice(4, 8), 10);
  const yyyyFirst = parseInt(s.slice(0, 4), 10);
  const mmMid = parseInt(s.slice(4, 6), 10);
  const ddEnd = parseInt(s.slice(6, 8), 10);

  if (yyyyFirst >= 2018 && yyyyFirst <= 2030 && mmMid >= 1 && mmMid <= 12 && ddEnd >= 1 && ddEnd <= 31) {
    return `${yyyyFirst}-${String(mmMid).padStart(2, "0")}-${String(ddEnd).padStart(2, "0")}`;
  }
  if (a >= 1 && a <= 31 && b >= 1 && b <= 12 && c >= 2018 && c <= 2030) {
    return `${c}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  return null;
}

function findFirstJsonBlock(raw: string): string | null {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (stripped.startsWith("{")) return stripped;
  const start = stripped.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, escape = false;
  for (let i = start; i < stripped.length; i++) {
    const c = stripped[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return stripped.slice(start, i + 1); }
  }
  return null;
}

async function callClaudeExtract(text: string, mediaName: string): Promise<any> {
  const cfg = getConfig();
  const truncated = text.length > 15_000 ? text.slice(0, 15_000) : text;
  const prompt =
    `Output JSON ONLY. Start with '{'. No explanation.\n\n` +
    `File: ${mediaName}\n\n` +
    `HĐCU text:\n${truncated}\n\n` +
    `Now output the JSON object:`;
  const start = Date.now();
  const q = query({
    prompt,
    options: {
      // preset claude_code + append để giữ tool-call protocol nhưng inject
      // strict JSON instruction. Pure string systemPrompt thường bị ignore.
      systemPrompt: {
        type: "preset",
        preset: "claude_code",
        append: EXTRACT_SYSTEM_PROMPT,
      },
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
      else throw new Error(`extract '${mediaName}' kết thúc lỗi: ${msg.subtype}`);
      break;
    }
  }
  logger.debug("Extract", `${mediaName} (${Date.now() - start}ms, ${raw.length} chars)`);
  const block = findFirstJsonBlock(raw);
  if (!block) throw new Error(`Không tìm JSON trong output: ${raw.slice(0, 200)}`);
  return JSON.parse(block);
}

async function upsertPartner(extracted: any, market: string): Promise<string | null> {
  if (!extracted?.name) return null;
  const existing = await payload.request<{ docs: Array<{ id: string; directorName?: string; email?: string; phone?: string; address?: string }> }>(
    `/api/partners`,
    { query: { where: { name: { equals: extracted.name } }, limit: 1, depth: 0 } },
  );

  const fullBody: Record<string, unknown> = {
    name: extracted.name,
    country: market || "jp",
    directorName: extracted.directorName ?? undefined,
    email: extracted.email ?? undefined,
    phone: extracted.phone ?? undefined,
    address: extracted.address ?? undefined,
    active: true,
  };
  for (const k of Object.keys(fullBody)) if (fullBody[k] === undefined) delete fullBody[k];

  if (existing.docs.length > 0) {
    const old = existing.docs[0];
    const patch: Record<string, unknown> = {};
    for (const k of ["directorName", "email", "phone", "address"] as const) {
      if ((!old[k] || old[k]!.trim() === "") && fullBody[k]) patch[k] = fullBody[k];
    }
    if (Object.keys(patch).length > 0) {
      await payload.request(`/api/partners/${encodeURIComponent(old.id)}`, { method: "PATCH", body: patch });
    }
    return old.id;
  }
  const created = await payload.request<{ doc: { id: string } }>(`/api/partners`, { method: "POST", body: fullBody });
  return created.doc.id;
}

interface MediaDoc {
  id: string;
  filename?: string;
  extractedText?: string;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Extract", "▶▶▶ Bulk extract HĐCU từ Media collection");

  // 1. List Media là HĐCU thực sự, match qua nhiều dấu hiệu:
  //    - kind = supply_contract (đã extract trước)
  //    - filename chứa HĐCU/HDCU/HĐCƯ/HDCƯ (tên rõ ràng)
  //    - extractedText chứa 送出機関 hoặc 監理団体 (signature HĐCU song ngữ
  //      Việt-Nhật — chỉ HĐCU mới có 2 cụm này. Cover các file đặt tên
  //      ngắn theo đối tác như "OKAYAMA EVENT.pdf", "MIT.pdf"...).
  const FILENAME_PATTERNS = ["HĐCU", "HDCU", "HĐCƯ", "HDCƯ"];
  const TEXT_SIGNATURES = ["送出機関", "監理団体"];
  const mediaRes = await payload.request<{ docs: MediaDoc[]; totalDocs: number }>(
    `/api/media`,
    {
      query: {
        where: {
          or: [
            { kind: { equals: "supply_contract" } },
            ...FILENAME_PATTERNS.map((p) => ({ filename: { contains: p } })),
            ...TEXT_SIGNATURES.map((p) => ({ extractedText: { contains: p } })),
          ],
        },
        limit: 200,
        depth: 0,
      },
    },
  );
  logger.info("Extract", `Tìm thấy ${mediaRes.totalDocs} Media HĐCU`);

  let extracted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < mediaRes.docs.length; i++) {
    const m = mediaRes.docs[i];
    const idx = i + 1;
    const text = m.extractedText ?? "";
    if (text.trim().length < 200) {
      logger.info("Extract", `[${idx}/${mediaRes.docs.length}] ⊘ ${m.filename}: extractedText quá ngắn — skip`);
      skipped += 1;
      continue;
    }

    // Idempotent — check Media đã có SupplyContract
    const existingSC = await payload.request<{ docs: Array<{ id: string }> }>(
      `/api/supply-contracts`,
      { query: { where: { media: { equals: m.id } }, limit: 1, depth: 0 } },
    );
    if (existingSC.docs.length > 0) {
      logger.info("Extract", `[${idx}/${mediaRes.docs.length}] ⊘ ${m.filename}: đã có SC#${existingSC.docs[0].id}`);
      skipped += 1;
      continue;
    }

    logger.info("Extract", `[${idx}/${mediaRes.docs.length}] ▶ ${m.filename} (${text.length} chars)`);

    try {
      const data = await callClaudeExtract(text, m.filename ?? m.id);
      if (!data?.partner?.name) {
        logger.warn("Extract", `  ⚠ ${m.filename}: AI không trích được partner.name — skip`);
        failed += 1;
        continue;
      }

      const partnerId = await upsertPartner(data.partner, "jp");
      if (!partnerId) {
        logger.warn("Extract", `  ⚠ ${m.filename}: upsert partner fail — skip`);
        failed += 1;
        continue;
      }

      // signedDate REQUIRED ở Payload; nếu AI không đoán được → parse từ filename
      const signedDate =
        safeDate(data.signedDate) ?? parseDateFromFilename(m.filename ?? "");
      if (!signedDate) {
        logger.warn("Extract", `  ⚠ ${m.filename}: không có signedDate hợp lệ — skip`);
        failed += 1;
        continue;
      }

      const body: Record<string, unknown> = {
        partner: partnerId,
        media: m.id,
        contractNumber:
          (typeof data.contractNumber === "string" && data.contractNumber.trim()) ||
          `HDCU-${(m.filename ?? m.id).replace(/\W+/g, "-").slice(0, 50)}`,
        signedDate,
        effectiveDate: safeDate(data.effectiveDate),
        expiryDate: safeDate(data.expiryDate),
        status: "active",
        tlgRep: { name: data.tlg?.directorName ?? null, position: data.tlg?.directorPosition ?? null },
        tlgLicenseNo: data.tlg?.licenseNo ?? null,
        tlgLicenseDate: safeDate(data.tlg?.licenseDate),
        partnerRep: { name: data.partner.directorName ?? null, position: data.partner.directorPosition ?? null },
        partnerLicenseNo: data.partner.licenseNo ?? null,
        partnerBankAccount: data.partner.bankAccount ?? undefined,
        terms: data.terms ?? undefined,
        extractedFromText: text.slice(0, 5_000),
      };
      for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];

      const created = await payload.request<{ doc: { id: string; contractNumber?: string } }>(
        `/api/supply-contracts`,
        { method: "POST", body },
      );
      // Update Media.kind = supply_contract để phân biệt với HĐ khác
      void payload
        .request(`/api/media/${encodeURIComponent(m.id)}`, {
          method: "PATCH",
          body: { kind: "supply_contract" },
        })
        .catch((e) => logger.warn("Extract", `   media#${m.id} kind PATCH fail: ${e}`));
      logger.info(
        "Extract",
        `  ✓ SC#${created.doc.id} (${data.contractNumber ?? "no#"}) — Partner: ${data.partner.name}`,
      );
      extracted += 1;
    } catch (err) {
      const reason = err instanceof PayloadError ? err.message : err instanceof Error ? err.message : String(err);
      logger.error("Extract", `  ✗ ${m.filename}: ${reason}`);
      failed += 1;
    }
  }

  logger.info("Extract", `\n╔═══════════════════════════════════════╗`);
  logger.info("Extract", `║ DONE`);
  logger.info("Extract", `║   extracted: ${extracted}`);
  logger.info("Extract", `║   skipped:   ${skipped}`);
  logger.info("Extract", `║   failed:    ${failed}`);
  logger.info("Extract", `╚═══════════════════════════════════════╝`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
