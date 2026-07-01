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
  /**
   * Extra field names to include in list output (in addition to titleField).
   * Each field rendered as `  fieldKey=value` line. Nested fields via dot
   * (vd "partner.name", "tlgRep.name"). Skip if value is null/empty.
   * → AI có đủ info trong 1 list call, không cần loop get_*.
   */
  listFields?: string[];
  /**
   * Populate depth for list/get response (default 0 = raw IDs only).
   * Set 1 nếu listFields có nested (vd "partner.name").
   */
  listDepth?: number;
  /**
   * Fields to search across when AI passes `q` filter. Tạo 1 OR query
   * `field1 contains q OR field2 contains q OR ...`. Hữu ích cho tool
   * lookup nhanh (vd find employee by name OR phone OR code).
   */
  qSearchFields?: string[];
}

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}

function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

/** Auto-cast string "true"/"false" → boolean cho boolean-ish fields. */
function smartCast(field: string, v: unknown): unknown {
  if (typeof v !== "string") return v;
  // Field tên dạng "active", "isXxx", "hasXxx" thường là boolean
  if (/^(active|is[A-Z]|has[A-Z])/.test(field) || field === "active") {
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return v;
}

function buildWhere(
  filters: Record<string, unknown>,
  fields: string[],
): Where {
  const where: Where = {};
  for (const f of fields) {
    const raw = filters[f];
    if (raw === undefined || raw === null || raw === "") continue;
    const v = smartCast(f, raw);
    // String → contains (fuzzy); other (boolean/number) → equals
    where[f] = typeof v === "string" ? { contains: v } : { equals: v };
  }
  return where;
}

/** Lấy nested value qua dot path (vd "partner.name", "tlgRep.name"). */
function getNested(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function fmtValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 200);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    // Date stored as ISO string in Mongo
    if ("id" in (v as Record<string, unknown>)) {
      const o = v as Record<string, unknown>;
      return `${o.name ?? o.title ?? o.id} (#${o.id})`;
    }
    return JSON.stringify(v).slice(0, 200);
  }
  return String(v);
}

export function createCrudTools<T extends z.ZodRawShape>(opts: CrudOptions<T>): AnyTool[] {
  const {
    slug,
    label,
    inputSchema,
    titleField = "id",
    filterableFields = [],
    exclude = [],
    listFields = [],
    listDepth = 0,
    qSearchFields = [],
  } = opts;

  // Builder cho 1 dòng list output — có thêm các field meta nếu cấu hình.
  function fmtListItem(doc: Record<string, unknown>): string {
    const title = String(getNested(doc, titleField) ?? doc.id);
    const lines = [`#${doc.id} ${title}`];
    for (const fp of listFields) {
      const v = fmtValue(getNested(doc, fp));
      if (v) lines.push(`  ${fp}=${v}`);
    }
    return lines.join("\n");
  }

  // Internal collection is loose-typed because each tool() call yields a
  // shape-specific generic the MCP server's array signature can't accept
  // directly (TS variance). We cast at the boundary instead of every push.
  const tools: unknown[] = [];

  // ── list ──────────────────────────────────────────────────────
  if (!exclude.includes("list")) {
    const listShape: z.ZodRawShape = {
      limit: z.number().int().positive().max(500).default(50).describe("Số bản ghi tối đa (max 500)"),
    };
    for (const f of filterableFields) {
      listShape[f] = z.string().optional().describe(`Lọc theo ${f}`);
    }
    if (qSearchFields.length > 0) {
      listShape.q = z.string().optional().describe(
        `Search fuzzy trên nhiều field (${qSearchFields.join(", ")}). Ưu tiên dùng khi không biết match field nào.`,
      );
    }

    const listDescBase = `Liệt kê ${label.plural}. Dùng khi user hỏi "có những ${label.plural} nào", "danh sách ${label.plural}", hoặc cần xem nhiều bản ghi cùng lúc.`;
    const listDesc = listFields.length > 0
      ? `${listDescBase}\n\n⚠ Tool này trả KÈM các field: ${listFields.join(", ")}. KHÔNG cần gọi get_${slug} cho từng record — 1 list call đủ data.`
      : listDescBase;

    tools.push(
      tool(
        `list_${slug}`,
        listDesc,
        listShape,
        async (args) => {
          try {
            const { limit, q, ...filters } = args as Record<string, unknown>;
            const where = buildWhere(filters, filterableFields);
            // Apply q (fuzzy multi-field search) — OR across qSearchFields
            if (q && typeof q === "string" && qSearchFields.length > 0) {
              const qConditions = qSearchFields.map((f) => ({ [f]: { contains: q } }));
              const existing = Object.keys(where).length > 0 ? [{ and: [where] }] : [];
              (where as Record<string, unknown>).or = qConditions;
              if (existing.length > 0) {
                // wrap into and: [filter, or: qConditions]
                delete (where as Record<string, unknown>).or;
                (where as Record<string, unknown>).and = [...existing.flatMap((x) => x.and), { or: qConditions }];
              }
            }
            const res = await payload.request<PayloadFindResponse>(`/api/${slug}`, {
              query: {
                where: Object.keys(where).length > 0 ? where : undefined,
                limit: Number(limit) || 20,
                depth: listDepth,
              },
            });
            const fmt = listFields.length > 0
              ? res.docs.map(fmtListItem).join("\n\n")
              : formatList(res.docs, titleField);
            return ok(
              `Tìm thấy ${res.totalDocs} ${label.plural}` +
                (res.docs.length === 0 ? "" : `:\n${fmt}`),
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
