/**
 * Tools để AI tra cứu nhân viên trong hệ thống (collection `users`).
 * Đọc-only — AI không tạo/sửa/xoá user (admin làm trên portal).
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import type { PayloadFindResponse } from "../payload/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

interface UserRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  displayName?: string;
  role?: string;
  isActive?: boolean;
  telegramUserId?: string;
  [key: string]: unknown;
}

const ROLE_VALUES = [
  "admin",
  "manager",
  "recruiter",
  "trainer",
  "visa_specialist",
  "accountant",
  "medical",
] as const;

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

function fmt(u: UserRow): string {
  const lines = [
    `#${u.id} ${u.displayName ?? u.email}`,
    `  email: ${u.email}`,
    `  role: ${u.role ?? "?"}`,
    `  active: ${u.isActive !== false}`,
  ];
  if (u.telegramUserId) lines.push(`  telegramUserId: ${u.telegramUserId}`);
  return lines.join("\n");
}

const list_users = tool(
  "list_users",
  `Liệt kê nhân viên trong hệ thống. Lọc theo role / active / search keyword.`,
  {
    role: z.enum(ROLE_VALUES).optional(),
    active: z.boolean().optional().describe("true = đang dùng"),
    q: z
      .string()
      .optional()
      .describe("Tìm trong email hoặc displayName (contains)"),
    limit: z.number().int().positive().max(100).default(30),
  },
  async ({ role, active, q, limit }) => {
    try {
      const conditions: Record<string, unknown>[] = [];
      if (role) conditions.push({ role: { equals: role } });
      if (active !== undefined) conditions.push({ isActive: { equals: active } });
      if (q) {
        conditions.push({
          or: [
            { email: { contains: q } },
            { displayName: { contains: q } },
          ],
        });
      }
      const where = conditions.length > 0 ? { and: conditions } : undefined;
      const res = await payload.request<PayloadFindResponse<UserRow>>(
        "/api/users",
        { query: { where, limit, depth: 0 } },
      );
      if (res.totalDocs === 0) return ok("🔍 Không có user nào khớp.");
      return ok(
        `👥 ${res.totalDocs} user${res.docs.length < res.totalDocs ? ` (top ${res.docs.length})` : ""}:\n\n${res.docs.map(fmt).join("\n\n")}`,
      );
    } catch (e) {
      return err(`Liệt kê users thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

const get_user = tool(
  "get_user",
  `Lấy 1 user theo ID hoặc email.`,
  {
    id: z.string().optional(),
    email: z.string().optional(),
  },
  async ({ id, email }) => {
    if (!id && !email) return err("Phải truyền id hoặc email.");
    try {
      if (id) {
        const u = await payload.request<UserRow>(`/api/users/${encodeURIComponent(id)}`);
        return ok(fmt(u));
      }
      const res = await payload.request<PayloadFindResponse<UserRow>>("/api/users", {
        query: { where: { email: { equals: email } }, limit: 1, depth: 0 },
      });
      if (res.docs.length === 0) return err(`Không tìm thấy user email=${email}`);
      return ok(fmt(res.docs[0]));
    } catch (e) {
      return err(`Lấy user thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

export const userTools: AnyTool[] = [list_users as AnyTool, get_user as AnyTool];
