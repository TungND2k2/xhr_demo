/**
 * CRUD tool factory. Given a Payload collection slug + zod input schema +
 * Vietnamese label, returns 5 standard MCP tools (list, get, create,
 * update, delete) — enough for 80% of entity-level interactions.
 *
 * Custom domain tools (workflow transitions, aggregations, reports)
 * are written separately and live alongside these.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import type { PayloadDoc, PayloadFindResponse, Where } from "../payload/types.js";
import { formatDoc, formatList } from "./format.js";

/** Loose tool definition we accept across heterogeneous tool arrays. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

export type CrudVerb = "list" | "get" | "create" | "update" | "delete";

export interface CrudOptions<TInput extends z.ZodRawShape> {
  /** Payload collection slug (e.g. "orders"). */
  slug: string;
  /** Vietnamese label, used in tool descriptions and result messages. */
  label: { singular: string; plural: string };
  /** zod shape describing fields the AI can pass when creating/updating. */
  inputSchema: TInput;
  /**
   * Field name (within the doc) used as a human title in list output.
   * Default: "id". For Orders use "orderCode", Fabrics use "code", etc.
   */
  titleField?: string;
  /**
   * Field names the AI is allowed to filter on via `list`. Each becomes
   * a top-level argument with `contains` semantics for strings.
   */
  filterableFields?: string[];
  /** Disable verbs you don't want exposed to the AI (default: none disabled). */
  exclude?: CrudVerb[];
}

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}

function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

function buildWhere(
  filters: Record<string, unknown>,
  fields: string[],
): Where {
  const where: Where = {};
  for (const f of fields) {
    const v = filters[f];
    if (v === undefined || v === null || v === "") continue;
    where[f] = typeof v === "string" ? { contains: v } : { equals: v };
  }
  return where;
}

export function createCrudTools<T extends z.ZodRawShape>(opts: CrudOptions<T>): AnyTool[] {
  const {
    slug,
    label,
    inputSchema,
    titleField = "id",
    filterableFields = [],
    exclude = [],
  } = opts;

  // Internal collection is loose-typed because each tool() call yields a
  // shape-specific generic the MCP server's array signature can't accept
  // directly (TS variance). We cast at the boundary instead of every push.
  const tools: unknown[] = [];

  // ── list ──────────────────────────────────────────────────────
  if (!exclude.includes("list")) {
    const listShape: z.ZodRawShape = {
      limit: z.number().int().positive().max(100).default(20).describe("Số bản ghi tối đa"),
    };
    for (const f of filterableFields) {
      listShape[f] = z.string().optional().describe(`Lọc theo ${f}`);
    }

    tools.push(
      tool(
        `list_${slug}`,
        `Liệt kê ${label.plural}. Dùng khi user hỏi "có những ${label.plural} nào", "danh sách ${label.plural}", hoặc cần xem nhiều bản ghi cùng lúc.`,
        listShape,
        async (args) => {
          try {
            const { limit, ...filters } = args as Record<string, unknown>;
            const where = buildWhere(filters, filterableFields);
            const res = await payload.request<PayloadFindResponse>(`/api/${slug}`, {
              query: {
                where: Object.keys(where).length > 0 ? where : undefined,
                limit: Number(limit) || 20,
              },
            });
            return ok(
              `Tìm thấy ${res.totalDocs} ${label.plural}` +
                (res.docs.length === 0 ? "" : `:\n${formatList(res.docs, titleField)}`),
            );
          } catch (e) {
            return err(e instanceof PayloadError ? e.message : String(e));
          }
        },
      ),
    );
  }

  // ── get ───────────────────────────────────────────────────────
  if (!exclude.includes("get")) {
    tools.push(
      tool(
        `get_${slug}`,
        `Xem chi tiết 1 ${label.singular} theo ID. Trả về toàn bộ field của bản ghi.`,
        {
          id: z.string().describe(`ID của ${label.singular}`),
        },
        async ({ id }) => {
          try {
            const doc = await payload.request<PayloadDoc>(`/api/${slug}/${encodeURIComponent(String(id))}`);
            return ok(formatDoc(doc));
          } catch (e) {
            return err(e instanceof PayloadError ? e.message : String(e));
          }
        },
      ),
    );
  }

  // ── create ────────────────────────────────────────────────────
  if (!exclude.includes("create")) {
    tools.push(
      tool(
        `create_${slug}`,
        `Tạo ${label.singular} mới. Hỏi user các trường bắt buộc trước khi gọi. Trả về ID của bản ghi vừa tạo.`,
        inputSchema,
        async (data) => {
          try {
            const res = await payload.request<{ doc: PayloadDoc; message: string }>(
              `/api/${slug}`,
              { method: "POST", body: data },
            );
            return ok(`✅ Đã tạo ${label.singular} #${res.doc.id}`);
          } catch (e) {
            return err(e instanceof PayloadError ? e.message : String(e));
          }
        },
      ),
    );
  }

  // ── update ────────────────────────────────────────────────────
  if (!exclude.includes("update")) {
    // Build a "partial" version of the input schema for update.
    const partialShape: z.ZodRawShape = { id: z.string().describe(`ID ${label.singular}`) };
    for (const [k, v] of Object.entries(inputSchema)) {
      // Wrap each field in optional() so the AI can update just one.
      partialShape[k] = (v as z.ZodTypeAny).optional();
    }

    tools.push(
      tool(
        `update_${slug}`,
        `Cập nhật ${label.singular} đã có. Truyền ID + các trường muốn đổi (không cần truyền hết).`,
        partialShape,
        async ({ id, ...patch }) => {
          try {
            const res = await payload.request<{ doc: PayloadDoc; message: string }>(
              `/api/${slug}/${encodeURIComponent(String(id))}`,
              { method: "PATCH", body: patch },
            );
            return ok(`✅ Đã cập nhật ${label.singular} #${res.doc.id}`);
          } catch (e) {
            return err(e instanceof PayloadError ? e.message : String(e));
          }
        },
      ),
    );
  }

  // ── delete ────────────────────────────────────────────────────
  if (!exclude.includes("delete")) {
    tools.push(
      tool(
        `delete_${slug}`,
        `Xoá ${label.singular}. CHỈ gọi sau khi user xác nhận rõ ràng "đồng ý xoá", "xoá thật". Không tự xoá.`,
        {
          id: z.string().describe(`ID ${label.singular} cần xoá`),
        },
        async ({ id }) => {
          try {
            await payload.request(`/api/${slug}/${encodeURIComponent(String(id))}`, {
              method: "DELETE",
            });
            return ok(`🗑 Đã xoá ${label.singular} #${id}`);
          } catch (e) {
            return err(e instanceof PayloadError ? e.message : String(e));
          }
        },
      ),
    );
  }

  return tools as unknown as AnyTool[];
}
