/**
 * Re-OCR file scan PDF với DPI cao (300) cho các Partner data trống —
 * lần OCR đầu (DPI 150) ra text nhiễu hoặc quá ngắn.
 *
 * Flow:
 *   1. List Partner data trống (no director + no bank)
 *   2. Mỗi Partner → SC link → Media → download PDF từ S3 (Payload URL)
 *   3. pdftoppm DPI 300 → PNG pages (cap 5 pages)
 *   4. Claude vision đọc + parse JSON Partner Bên B
 *   5. Update Media.extractedText (replace old noisy)
 *   6. PATCH Partner với data extract được
 */
import "dotenv/config";

import { loadConfig, getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";
import { pdfToImages } from "../extraction/pdf-to-images.js";
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

const PROMPT = `JSON extractor cho HĐCU XKLĐ. Đọc các trang scan và trả thông tin BÊN B (Nghiệp đoàn / 監理団体).

⚠️ OUTPUT: JSON DUY NHẤT. Bắt đầu '{', kết thúc '}'. Không markdown.

{
  "name": string,
  "address": string|null,
  "phone": string|null,
  "fax": string|null,
  "email": string|null,
  "directorName": string|null,
  "directorPosition": string|null,
  "licenseNo": string|null,
  "bankAccount": {
    "holder": string|null,
    "number": string|null,
    "bank": string|null,
    "branch": string|null,
    "swift": string|null
  },
  "fullText": string
}

BỎ QUA BÊN A (TLG / 送出機関). fullText = nội dung text bạn đọc được từ scan (markdown).`;

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

async function visionExtract(pages: Array<{ buffer: Buffer; page: number }>, tag: string): Promise<any> {
  const cfg = getConfig();
  async function* msgs(): AsyncIterable<SDKUserMessage> {
    const content: Array<
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
      | { type: "text"; text: string }
    > = pages.map((p) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: "image/png", data: p.buffer.toString("base64") },
    }));
    content.push({ type: "text", text: `Tài liệu HĐCU (${pages.length} trang scan). Output JSON theo schema đã định.` });
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: { role: "user", content: content as never },
    };
  }
  const q = query({
    prompt: msgs(),
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
      else throw new Error(`${tag}: ${msg.subtype}`);
      break;
    }
  }
  const block = findJson(raw);
  if (!block) throw new Error(`${tag}: no JSON in output`);
  return JSON.parse(block);
}

interface MediaDoc { id: string; url?: string; filename?: string }

async function downloadMedia(media: MediaDoc): Promise<Buffer> {
  const cfg = getConfig();
  if (!media.url) throw new Error(`Media #${media.id} no URL`);
  // Media.url thường là /api/media/file/<filename> (relative)
  const fullUrl = media.url.startsWith("http")
    ? media.url
    : `${cfg.PAYLOAD_URL.replace(/\/$/, "")}${media.url}`;
  const r = await fetch(fullUrl);
  if (!r.ok) throw new Error(`Download ${fullUrl} failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function repairPartner(partnerId: string): Promise<{ ok: boolean; msg: string }> {
  const p = await payload.request<{ id: string; name: string }>(`/api/partners/${partnerId}`);
  logger.info("ReOCR", `▶ ${p.name}`);

  const sc = await payload.request<{ docs: Array<{ id: string; media?: string | { id: string } }> }>(
    `/api/supply-contracts`,
    { query: { where: { partner: { equals: partnerId } }, limit: 1, depth: 0 } },
  );
  if (sc.docs.length === 0) return { ok: false, msg: "no SC" };
  const mediaId = typeof sc.docs[0].media === "string" ? sc.docs[0].media : sc.docs[0].media?.id;
  if (!mediaId) return { ok: false, msg: "no media" };

  const media = await payload.request<MediaDoc>(`/api/media/${mediaId}`);
  logger.info("ReOCR", `  download ${media.filename}...`);
  const buf = await downloadMedia(media);

  logger.info("ReOCR", `  pdftoppm DPI 300...`);
  const pages = await pdfToImages(buf, { maxPages: 5, dpi: 300 });
  logger.info("ReOCR", `  vision extract ${pages.length} pages...`);
  const data = await visionExtract(pages.map((p) => ({ buffer: p.buffer instanceof Buffer ? p.buffer : Buffer.from(new Uint8Array(p.buffer)), page: p.page })), p.name);

  if (!data.name) return { ok: false, msg: "AI không trích được Bên B name" };

  // Update Media.extractedText (replace old noisy)
  if (data.fullText && data.fullText.length > 500) {
    await payload.request(`/api/media/${mediaId}`, {
      method: "PATCH",
      body: { extractedText: data.fullText.slice(0, 50_000) },
    });
  }

  // PATCH Partner — chỉ điền field trống
  const patch: Record<string, unknown> = {};
  if (data.directorName) patch.directorName = data.directorName;
  if (data.address) patch.address = data.address;
  if (data.phone) patch.phone = data.phone;
  if (data.fax) patch.fax = data.fax;
  if (data.email) patch.email = data.email;
  if (data.bankAccount?.number || data.bankAccount?.holder) {
    patch.bankAccount = {
      holder: data.bankAccount.holder ?? null,
      number: data.bankAccount.number ?? null,
      bank: data.bankAccount.bank ?? null,
      branch: data.bankAccount.branch ?? null,
      swift: data.bankAccount.swift ?? null,
    };
  }

  const fields = Object.keys(patch);
  if (fields.length === 0) return { ok: false, msg: "AI vẫn không trích được data" };

  await payload.request(`/api/partners/${partnerId}`, { method: "PATCH", body: patch });
  return { ok: true, msg: `patched ${fields.join(", ")}` };
}

async function main(): Promise<void> {
  loadConfig();
  const TARGETS = [
    "6a05335c79b28c5988c295cb", // Kawachi Dream
    "6a05329579b28c5988c29525", // KYODO KUMIAI CREATE HIT
    "6a0531351bd4d23447ac5f4f", // HIROSHIMA CENTER
    "6a052ca31bd4d23447ac5a82", // FUJI UNITY
  ];
  logger.info("ReOCR", `▶▶▶ Re-OCR DPI 300 cho ${TARGETS.length} Partner trống`);
  let ok = 0, fail = 0;
  for (const pid of TARGETS) {
    try {
      const r = await repairPartner(pid);
      if (r.ok) { logger.info("ReOCR", `  ✓ ${r.msg}`); ok += 1; }
      else { logger.warn("ReOCR", `  ⊘ ${r.msg}`); fail += 1; }
    } catch (err) {
      const reason = err instanceof PayloadError ? err.message : err instanceof Error ? err.message : String(err);
      logger.error("ReOCR", `  ✗ ${pid}: ${reason}`);
      fail += 1;
    }
  }
  logger.info("ReOCR", `\nDONE — ok=${ok} fail=${fail}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
