/**
 * Media tools — AI tra cứu file/ảnh đã upload bằng nội dung.
 *
 * Bot tự động sinh `description` (LLM tóm tắt nội dung) khi upload —
 * tool này tận dụng để tìm:
 *   "có ai đã gửi hộ chiếu của LD-001 chưa?" → search_media({q:"LD-001"})
 *   "ảnh khám SK tháng 3" → search_media({q:"khám sức khoẻ tháng 3"})
 *   "HĐ với Toyota" → search_media({q:"Toyota hợp đồng"})
 *
 * Truy vấn match cả `description`, `filename`, `alt` để bắt được dù
 * AI lúc upload tóm tắt thiếu từ khoá.
 */
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";

interface MediaRow {
  id: string;
  filename: string;
  alt?: string;
  kind?: string;
  description?: string;
  mimeType?: string;
  filesize?: number;
  url?: string;
  uploadedFrom?: string;
  uploadedAt?: string;
  createdAt?: string;
}

const KIND_LABEL: Record<string, string> = {
  id_doc: "🆔 Giấy tờ tuỳ thân",
  health_cert: "🏥 Giấy khám SK",
  contract: "📜 Hợp đồng",
  visa_doc: "🛂 Visa/COE",
  flight: "✈️ Vé máy bay",
  cv: "💼 CV",
  portrait: "🖼 Ảnh chân dung",
  invoice: "💰 Hoá đơn",
  form: "📋 Form",
  partner_doc: "📄 Tài liệu đối tác",
  other: "📝 Khác",
};

function preview(s: string | undefined, n = 200): string {
  if (!s) return "";
  const compact = s.replace(/\s+/g, " ").trim();
  return compact.length > n ? compact.slice(0, n) + "…" : compact;
}

export const searchMedia = tool(
  "search_media",
  `Tìm file/ảnh đã upload theo nội dung (description AI đã tóm tắt) hoặc
tên file/alt. Dùng khi user hỏi "có ảnh/HĐ/giấy tờ ... nào của X chưa".
Trả top 10 kết quả với mô tả ngắn + URL.`,
  {
    q: z.string().min(1).describe("Từ khoá tìm — tên người, mã đơn, loại giấy tờ..."),
    kind: z
      .enum([
        "id_doc",
        "health_cert",
        "contract",
        "visa_doc",
        "flight",
        "cv",
        "portrait",
        "invoice",
        "form",
        "partner_doc",
        "other",
      ])
      .optional()
      .describe("Lọc theo loại tài liệu nếu user nói rõ"),
    limit: z.number().int().min(1).max(30).optional().default(10),
  },
  async ({ q, kind, limit }) => {
    try {
      const where: Record<string, unknown> = {
        or: [
          { description: { contains: q } },
          { filename: { contains: q } },
          { alt: { contains: q } },
        ],
      };
      if (kind) where.kind = { equals: kind };

      const res = await payload.request<{ docs: MediaRow[]; totalDocs: number }>(
        "/api/media",
        {
          query: { where, limit, sort: "-createdAt", depth: 0 },
        },
      );

      if (res.totalDocs === 0) {
        return {
          content: [
            { type: "text" as const, text: `🔍 Không tìm thấy file nào khớp "${q}"` },
          ],
        };
      }

      const lines = [`🔍 Tìm thấy ${res.totalDocs} file khớp "${q}" (top ${res.docs.length}):`, ""];
      for (const m of res.docs) {
        const kindL = m.kind ? KIND_LABEL[m.kind] ?? m.kind : "📄";
        const date = (m.uploadedAt ?? m.createdAt ?? "").slice(0, 10);
        lines.push(`${kindL} ${m.filename}  (#${m.id}, ${date})`);
        if (m.alt) lines.push(`   alt: ${m.alt}`);
        if (m.description) lines.push(`   📝 ${preview(m.description, 220)}`);
        if (m.url) lines.push(`   🔗 ${m.url}`);
        lines.push("");
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      const msg = err instanceof PayloadError ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `⚠️ ${msg}` }],
        isError: true,
      };
    }
  },
);

export const getMediaContent = tool(
  "get_media_content",
  `Lấy nội dung text gốc của 1 file đã upload (extractedText) — dùng khi
user muốn xem chi tiết tài liệu mà description không đủ. Chỉ có với
document, ảnh thì trả về description.`,
  {
    id: z.string().describe("ID media doc"),
  },
  async ({ id }) => {
    try {
      const m = await payload.request<MediaRow & { extractedText?: string }>(
        `/api/media/${encodeURIComponent(id)}`,
      );
      const lines = [
        `📄 ${m.filename}${m.alt ? ` — ${m.alt}` : ""}`,
        m.kind ? `Loại: ${KIND_LABEL[m.kind] ?? m.kind}` : "",
        "",
      ].filter(Boolean);

      if (m.description) {
        lines.push("📝 Mô tả:", m.description, "");
      }
      if (m.extractedText) {
        lines.push("📜 Nội dung text:", m.extractedText.slice(0, 6000));
        if (m.extractedText.length > 6000) {
          lines.push(`\n[...cắt ${m.extractedText.length - 6000} ký tự]`);
        }
      } else {
        lines.push("(Ảnh — không có text gốc)");
      }
      if (m.url) lines.push(`\n🔗 ${m.url}`);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      const msg = err instanceof PayloadError ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `⚠️ ${msg}` }],
        isError: true,
      };
    }
  },
);

export const mediaTools = [searchMedia, getMediaContent];
