/**
 * MCP tool: semantic_search — tra cứu theo ngữ nghĩa (vector similarity).
 *
 * Thay cho list_X / get_X khi muốn tìm theo nội dung tự nhiên (vd "worker
 * biết tiếng Nhật N3 và pass khám SK Toyota"). Tránh load 1000+ records
 * vào context.
 *
 * Hỗ trợ filter cứng (market, country, status...) — combined với vector.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { embed } from "../vector/embedding.js";
import { search } from "../vector/qdrant.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

const COLLECTIONS = ["media", "supply-contracts", "partners", "orders", "workers"] as const;

const semantic_search = tool(
  "semantic_search",
  `Tra cứu theo ngữ nghĩa (vector similarity). DÙNG THAY CHO list_X / get_X khi:
- Tìm theo nội dung mô tả ("file scan hộ chiếu Nguyễn Văn A", "đối tác nhận điều dưỡng")
- Tìm khi không nhớ chính xác mã (vd "HĐ với công ty Toyota tháng 3")
- Data lớn (>100 records) — list_* sẽ overflow context

Trả về top K records relevant nhất + score similarity. Nếu cần chi tiết full → gọi get_<collection>({id: docId}).

Collections hỗ trợ:
- media: file scan/ảnh đã upload (search trong description + extractedText)
- supply-contracts: HĐCU (search trong tên đối tác, điều khoản)
- partners: đối tác Nhật (tên cty, giám đốc, địa chỉ)
- orders: đơn tuyển (employer, position)
- workers: hồ sơ LĐ (tên, kỹ năng, ngôn ngữ)

Filter cứng: tùy chọn lọc thêm market/country/status/kind trước khi rank vector.

Ví dụ:
- "Tìm HĐCU với đối tác Hiroshima" → semantic_search({collection:"supply-contracts", query:"Hiroshima"})
- "Đối tác nhận điều dưỡng ở Tokyo" → semantic_search({collection:"partners", query:"điều dưỡng Tokyo", country:"jp"})
- "File giấy khám SK của LD-001" → semantic_search({collection:"media", query:"giấy khám sức khoẻ LD-001", kind:"health_cert"})`,
  {
    collection: z.enum(COLLECTIONS).describe("Collection cần tìm"),
    query: z.string().min(1).describe("Câu truy vấn tự nhiên (tiếng Việt OK)"),
    topK: z.number().int().positive().max(50).default(10).describe("Số kết quả top (default 10)"),
    market: z.string().optional().describe('Filter market — vd "jp", "kr"'),
    country: z.string().optional().describe("Filter country (Partner)"),
    status: z.string().optional().describe("Filter status"),
    kind: z.string().optional().describe("Filter kind (Media)"),
  },
  async ({ collection, query, topK, market, country, status, kind }) => {
    try {
      // Build filter
      const must: Array<Record<string, unknown>> = [];
      for (const [k, v] of [["market", market], ["country", country], ["status", status], ["kind", kind]] as const) {
        if (v) must.push({ key: k, match: { value: v } });
      }
      const filter = must.length > 0 ? { must } : undefined;

      // Embed query — E5 dùng prefix "query: "
      const vec = await embed(query, "query");

      const results = await search(collection, vec, topK, filter);
      if (results.length === 0) {
        return ok(`🔍 Không có kết quả cho "${query}" trong ${collection}.`);
      }

      const lines = [`🔎 Top ${results.length} kết quả "${query}" trong ${collection}:\n`];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        lines.push(
          `${i + 1}. **${r.title}** (score ${(r.score * 100).toFixed(1)}%, id=${r.docId})\n   ${r.snippet}`,
        );
      }
      return ok(lines.join("\n"));
    } catch (e) {
      return err(`Vector search lỗi: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
);

export const vectorSearchTools: AnyTool[] = [semantic_search as AnyTool];
