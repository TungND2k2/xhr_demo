import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool, query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { createCrudTools } from "./factory.js";
import { payload, PayloadError } from "../payload/client.js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

const SUPPLY_CONTRACT_STATUSES = ["active", "expired", "terminated", "superseded"] as const;

const crudTools = createCrudTools({
  slug: "supply-contracts",
  label: { singular: "hợp đồng cung ứng", plural: "hợp đồng cung ứng (HĐCU)" },
  titleField: "contractNumber",
  filterableFields: ["contractNumber", "status", "partner"],
  // Trả full info trong list → AI không cần loop get_supply-contracts.
  listFields: ["signedDate", "status", "partner.name", "partner.id", "partnerLicenseNo", "partnerRep.name", "tlgRep.name", "terms.durationMonths"],
  listDepth: 1,
  inputSchema: {
    contractNumber: z.string().describe("Số HĐ (unique)"),
    signedDate: z.string().describe("Ngày ký YYYY-MM-DD"),
    effectiveDate: z.string().optional(),
    expiryDate: z.string().optional(),
    partner: z.string().describe("Partner ID (relation)"),
    media: z.string().optional().describe("Media ID (file scan PDF)"),
    status: z.enum(SUPPLY_CONTRACT_STATUSES).optional(),
    notes: z.string().optional(),
  },
});

/**
 * Extract supply contract fields từ extractedText của 1 Media.
 *
 * Flow:
 *   1. Load Media → lấy extractedText
 *   2. Gọi Claude với JSON schema, parse output
 *   3. Upsert Partner (by name match) — nếu chưa có thì tạo
 *   4. Create SupplyContract record, link Partner + Media
 *
 * Idempotent: nếu Media đã có SupplyContract trỏ về → trả "already extracted".
 */
const EXTRACT_SYSTEM_PROMPT = `Bạn là agent extract dữ liệu Hợp đồng cung ứng lao động (HĐCU) ngành XKLĐ.

HĐCU là HĐ ký giữa CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI THỊNH LONG (TLG, Bên cung ứng / 送出機関)
và 1 đối tác nước ngoài (Nghiệp đoàn / 監理団体).

Nhiệm vụ: đọc text HĐCU và trả JSON đúng schema dưới.

{
  "contractNumber": string | null,        // số HĐ. Nếu không có số rõ ràng → null.
  "signedDate": string | null,            // YYYY-MM-DD. Nếu chỉ có năm/tháng → ghép YYYY-MM-01.
  "effectiveDate": string | null,         // ngày hiệu lực, YYYY-MM-DD. Thường = ngày ký.
  "expiryDate": string | null,            // ngày hết hạn, YYYY-MM-DD. Có thể không có.

  "partner": {                            // BÊN B - Nghiệp đoàn tiếp nhận
    "name": string,                       // tên Nghiệp đoàn (ưu tiên tiếng VIỆT, nếu không có thì tiếng Anh, cuối cùng tiếng Nhật)
    "nameJp": string | null,              // tên tiếng Nhật (vd "はっぴねす事業協同組合")
    "address": string | null,
    "phone": string | null,
    "fax": string | null,
    "email": string | null,
    "directorName": string | null,        // người đại diện
    "directorPosition": string | null,    // chức vụ (vd "Chủ tịch" / "代表理事")
    "licenseNo": string | null,           // số GP giám lý (vd "1804000092")
    "bankAccount": {                      // tài khoản NH đối tác
      "holder": string | null,
      "number": string | null,
      "bank": string | null,
      "branch": string | null,
      "swift": string | null
    } | null
  },

  "tlg": {                                // BÊN A - TLG. Hầu hết constant nhưng vẫn extract để track.
    "directorName": string | null,        // vd "NGUYEN THI KIM HOA"
    "directorPosition": string | null,    // vd "Chủ tịch HĐQT" / "代表取締役会長"
    "licenseNo": string | null,           // GP XKLĐ (vd "1174/LĐTBXH-GP")
    "licenseDate": string | null          // YYYY-MM-DD ngày cấp GP XKLĐ
  },

  "terms": {
    "durationMonths": number | null,      // tổng thời gian thực tập (TTSKN 1+2+3 thường = 60)
    "weeklyHours": number | null,         // default 40
    "dailyHours": number | null,          // default 8
    "leaveDaysPerYear": number | null,    // default 10
    "salaryNote": string | null,          // mô tả lương (1-3 câu)
    "serviceFeeNote": string | null,      // mô tả phí dịch vụ (nếu có)
    "additionalTerms": string | null      // điều khoản đặc biệt (1-3 câu)
  }
}

QUY TẮC:
- KHÔNG bịa. Trường nào không tìm được → để null.
- Date: nếu chỉ có "tháng 3 năm 2022" → 2022-03-01.
- Partner.name: ưu tiên dạng VIET / English chuẩn. Tránh tên thô lẫn ký tự lạ.
- Trả JSON THUẦN — không markdown, không giải thích.`;

function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
}

function findFirstJsonBlock(raw: string): string | null {
  const stripped = stripJsonFences(raw);
  if (stripped.startsWith("{")) return stripped;
  const start = stripped.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < stripped.length; i += 1) {
    const c = stripped[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
}

interface ExtractedContract {
  contractNumber: string | null;
  signedDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  partner: {
    name: string;
    nameJp: string | null;
    address: string | null;
    phone: string | null;
    fax: string | null;
    email: string | null;
    directorName: string | null;
    directorPosition: string | null;
    licenseNo: string | null;
    bankAccount: {
      holder: string | null;
      number: string | null;
      bank: string | null;
      branch: string | null;
      swift: string | null;
    } | null;
  };
  tlg: {
    directorName: string | null;
    directorPosition: string | null;
    licenseNo: string | null;
    licenseDate: string | null;
  };
  terms: {
    durationMonths: number | null;
    weeklyHours: number | null;
    dailyHours: number | null;
    leaveDaysPerYear: number | null;
    salaryNote: string | null;
    serviceFeeNote: string | null;
    additionalTerms: string | null;
  };
}

async function callClaudeExtract(text: string, mediaName: string): Promise<ExtractedContract> {
  const cfg = getConfig();
  // Cap 15K chars — đoạn đầu HĐCU thường đủ thông tin các bên + điều khoản chính.
  const truncated = text.length > 15_000
    ? text.slice(0, 15_000) + `\n\n[...cắt bớt; tổng ${text.length} ký tự]`
    : text;

  const prompt = `Tên file: ${mediaName}\n\nNội dung HĐCU:\n---\n${truncated}\n---`;
  const start = Date.now();
  const q = query({
    prompt,
    options: {
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      tools: [],
      mcpServers: {},
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 3,
      model: cfg.CLAUDE_MODEL,
      persistSession: false,
      ...(cfg.CLAUDE_BIN ? { pathToClaudeCodeExecutable: cfg.CLAUDE_BIN } : {}),
    },
  });

  let raw = "";
  for await (const msg of q) {
    if (msg.type === "result") {
      if (msg.subtype === "success") {
        raw = msg.result;
      } else {
        throw new Error(`extract '${mediaName}' kết thúc lỗi: ${msg.subtype}`);
      }
      break;
    }
  }
  logger.debug("Extract", `${mediaName} done in ${Date.now() - start}ms (${raw.length} chars)`);
  const block = findFirstJsonBlock(raw);
  if (!block) throw new Error(`Không tìm được JSON trong output: ${raw.slice(0, 200)}`);
  return JSON.parse(block) as ExtractedContract;
}

interface PartnerDoc {
  id: string;
  name: string;
  directorName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

async function upsertPartner(extracted: ExtractedContract["partner"], market: string): Promise<string> {
  if (!extracted.name) throw new Error("partner.name thiếu — không thể upsert Partner");

  // Try by exact name first
  const existingRes = await payload.request<{ docs: PartnerDoc[] }>(`/api/partners`, {
    query: {
      where: { name: { equals: extracted.name } },
      limit: 1,
      depth: 0,
    },
  });

  const partnerBody: Record<string, unknown> = {
    name: extracted.name,
    country: market || "jp",
    directorName: extracted.directorName ?? undefined,
    email: extracted.email ?? undefined,
    phone: extracted.phone ?? undefined,
    address: extracted.address ?? undefined,
    active: true,
  };
  // Strip undefined để PATCH không ghi đè field đã có
  for (const k of Object.keys(partnerBody)) {
    if (partnerBody[k] === undefined) delete partnerBody[k];
  }

  if (existingRes.docs.length > 0) {
    const id = existingRes.docs[0].id;
    // Chỉ PATCH những field hiện đang trống (tránh đè data tốt = data thô từ AI).
    const patch: Record<string, unknown> = {};
    for (const k of ["directorName", "email", "phone", "address"]) {
      const oldVal = (existingRes.docs[0] as unknown as Record<string, string | undefined>)[k];
      if ((!oldVal || oldVal.trim?.() === "") && partnerBody[k]) {
        patch[k] = partnerBody[k];
      }
    }
    if (Object.keys(patch).length > 0) {
      await payload.request(`/api/partners/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: patch,
      });
    }
    return id;
  }
  const created = await payload.request<{ doc: { id: string } }>(`/api/partners`, {
    method: "POST",
    body: partnerBody,
  });
  return created.doc.id;
}

const extract_supply_contract = tool(
  "extract_supply_contract",
  `Đọc text scan của 1 file HĐCU (lấy từ Media.extractedText) → AI parse các trường →
upsert Partner (đối tác) + tạo SupplyContract record link Partner + Media.

Workflow:
1. Truyền mediaId vào tool.
2. Tool load Media, lấy extractedText.
3. Gọi Claude với schema JSON → parse fields (số HĐ, ngày ký, đối tác, đại diện, điều khoản).
4. Upsert Partner (theo name match — nếu Partner đã có thì chỉ điền thêm field trống).
5. Create SupplyContract record với data extracted + link Partner + Media.

Idempotent: nếu Media đã được dùng cho 1 SupplyContract → trả ID record cũ, KHÔNG tạo trùng.

Trả về: ID SupplyContract + tóm tắt extracted fields.

Dùng khi:
- User nhờ "xử lý file HĐCU này" / "lưu thông tin HĐ này vào hệ thống".
- Admin import 1 batch HĐCU mới, AI gọi extract từng file.`,
  {
    mediaId: z.string().describe("ID của Media (file HĐCU) trong DB"),
    market: z.string().optional().describe('Thị trường — "jp" (default), "kr", "tw", "de", "me", "eu", "other"'),
  },
  async ({ mediaId, market }) => {
    try {
      // 1. Idempotent — check Media đã được dùng chưa
      const existingSC = await payload.request<{ docs: Array<{ id: string; contractNumber?: string }> }>(
        `/api/supply-contracts`,
        {
          query: {
            where: { media: { equals: mediaId } },
            limit: 1,
            depth: 0,
          },
        },
      );
      if (existingSC.docs.length > 0) {
        return ok(
          `↻ Media này đã được extract → SupplyContract#${existingSC.docs[0].id} ` +
          `(${existingSC.docs[0].contractNumber ?? "no number"}). Bỏ qua, không tạo trùng.`,
        );
      }

      // 2. Load Media
      type MediaDoc = { id: string; filename?: string; extractedText?: string };
      const media = await payload.request<MediaDoc>(
        `/api/media/${encodeURIComponent(mediaId)}`,
      );
      const text = media.extractedText ?? "";
      if (text.trim().length < 200) {
        return err(`Media #${mediaId} extractedText quá ngắn (${text.length} chars) — không extract được.`);
      }

      // 3. Claude extract
      const extracted = await callClaudeExtract(text, media.filename ?? mediaId);
      if (!extracted.partner?.name) {
        return err(`AI không trích được tên đối tác từ file ${media.filename ?? mediaId}.`);
      }

      // 4. Upsert Partner
      const partnerId = await upsertPartner(extracted.partner, market ?? "jp");

      // 5. Build SupplyContract body
      const body: Record<string, unknown> = {
        partner: partnerId,
        media: mediaId,
        contractNumber:
          extracted.contractNumber ??
          `HDCU-${(media.filename ?? mediaId).replace(/\W+/g, "-").slice(0, 40)}`,
        signedDate: extracted.signedDate ?? null,
        effectiveDate: extracted.effectiveDate ?? null,
        expiryDate: extracted.expiryDate ?? null,
        status: "active",
        tlgRep: {
          name: extracted.tlg?.directorName ?? null,
          position: extracted.tlg?.directorPosition ?? null,
        },
        tlgLicenseNo: extracted.tlg?.licenseNo ?? null,
        tlgLicenseDate: extracted.tlg?.licenseDate ?? null,
        partnerRep: {
          name: extracted.partner.directorName ?? null,
          position: extracted.partner.directorPosition ?? null,
        },
        partnerLicenseNo: extracted.partner.licenseNo ?? null,
        partnerBankAccount: extracted.partner.bankAccount
          ? {
              holder: extracted.partner.bankAccount.holder ?? null,
              number: extracted.partner.bankAccount.number ?? null,
              bank: extracted.partner.bankAccount.bank ?? null,
              branch: extracted.partner.bankAccount.branch ?? null,
              swift: extracted.partner.bankAccount.swift ?? null,
            }
          : undefined,
        terms: extracted.terms
          ? {
              durationMonths: extracted.terms.durationMonths ?? null,
              weeklyHours: extracted.terms.weeklyHours ?? 40,
              leaveDaysPerYear: extracted.terms.leaveDaysPerYear ?? 10,
              salaryNote: extracted.terms.salaryNote ?? null,
              serviceFeeNote: extracted.terms.serviceFeeNote ?? null,
              additionalTerms: extracted.terms.additionalTerms ?? null,
            }
          : undefined,
        extractedFromText: text.slice(0, 5_000),
      };
      // Strip undefined
      for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];

      const created = await payload.request<{ doc: { id: string; contractNumber?: string } }>(
        `/api/supply-contracts`,
        { method: "POST", body },
      );

      // Link 2 chiều: Media.linkedRecords push entry trỏ về SC vừa tạo.
      try {
        const m = await payload.request<{ linkedRecords?: Array<{ relationTo: string; value: string }> }>(
          `/api/media/${encodeURIComponent(mediaId)}`,
        );
        const existing = Array.isArray(m.linkedRecords) ? m.linkedRecords : [];
        const already = existing.some(
          (r) => r.relationTo === "supply-contracts" && r.value === created.doc.id,
        );
        if (!already) {
          await payload.request(`/api/media/${encodeURIComponent(mediaId)}`, {
            method: "PATCH",
            body: {
              linkedRecords: [
                ...existing,
                { relationTo: "supply-contracts", value: created.doc.id },
              ],
            },
          });
        }
      } catch {
        // Không quan trọng — file Media giữ độc lập nếu PATCH link fail
      }

      return ok(
        `✅ Đã tạo SupplyContract#${created.doc.id} (${created.doc.contractNumber ?? "no#"})\n` +
          `   Partner: ${extracted.partner.name} (#${partnerId})\n` +
          `   Ký ngày: ${extracted.signedDate ?? "?"}\n` +
          `   GP đối tác: ${extracted.partner.licenseNo ?? "?"}\n` +
          `   Đại diện: ${extracted.partner.directorName ?? "?"} (${extracted.partner.directorPosition ?? "?"})\n` +
          `   Thời hạn: ${extracted.terms?.durationMonths ?? "?"} tháng`,
      );
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : e instanceof Error ? e.message : String(e);
      return err(`Extract HĐCU thất bại: ${reason}`);
    }
  },
);

export const supplyContractTools: AnyTool[] = [
  ...crudTools,
  extract_supply_contract as AnyTool,
];
