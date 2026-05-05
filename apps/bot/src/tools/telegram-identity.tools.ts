/**
 * Tools để AI tra cứu Telegram identity registry — biến tên hiển thị
 * (vd "@ha_ntv") thành telegramUserId, hoặc kiểm tra danh sách thành
 * viên 1 group, v.v.
 *
 * Read-only. Bot tự upsert qua telegram-sync khi nhận message.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import type { PayloadFindResponse } from "../payload/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

interface TgUserRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  isBot?: boolean;
  blocked?: boolean;
  lastSeenAt?: string;
  messageCount?: number;
  linkedSystemUser?: string | { id: string; email?: string; displayName?: string };
  [key: string]: unknown;
}

interface TgGroupRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  telegramChatId: string;
  title?: string;
  type?: string;
  active?: boolean;
  purpose?: string;
  lastActivityAt?: string;
  messageCount?: number;
  [key: string]: unknown;
}

interface TgMembershipRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  telegramUser?: TgUserRow | string;
  telegramGroup?: TgGroupRow | string;
  role?: string;
  joinedAt?: string;
  leftAt?: string;
  lastSeenAt?: string;
  messageCount?: number;
  [key: string]: unknown;
}

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

function fmtUser(u: TgUserRow): string {
  const linked =
    typeof u.linkedSystemUser === "object" && u.linkedSystemUser !== null
      ? `${u.linkedSystemUser.email ?? u.linkedSystemUser.id}`
      : (u.linkedSystemUser as string | undefined) ?? "(chưa link)";
  return [
    `#${u.id} ${u.displayName ?? u.telegramUserId}`,
    `  telegramUserId: ${u.telegramUserId}`,
    `  username: ${u.username ? "@" + u.username : "(không có)"}`,
    `  linkedSystemUser: ${linked}`,
    `  lastSeen: ${u.lastSeenAt ?? "?"} · msg=${u.messageCount ?? 0}`,
  ].join("\n");
}

const lookup_telegram_user = tool(
  "lookup_telegram_user",
  `Tra cứu Telegram user qua telegramUserId, username (không có @), hoặc
displayName (contains). Trả về thông tin để bot biết DM ai khi user nói
"@ha_ntv" hay "anh Nam tuyển dụng".`,
  {
    telegramUserId: z
      .string()
      .optional()
      .describe("ID dạng số, vd '123456789'"),
    username: z
      .string()
      .optional()
      .describe("Username KHÔNG có @ ở đầu, vd 'ha_ntv'"),
    q: z
      .string()
      .optional()
      .describe("Tìm trong displayName/firstName/lastName (contains)"),
    limit: z.number().int().positive().max(50).default(10),
  },
  async ({ telegramUserId, username, q, limit }) => {
    if (!telegramUserId && !username && !q) {
      return err("Phải truyền 1 trong: telegramUserId, username, q.");
    }
    try {
      const conditions: Record<string, unknown>[] = [];
      if (telegramUserId)
        conditions.push({ telegramUserId: { equals: telegramUserId } });
      if (username) conditions.push({ username: { equals: username } });
      if (q) {
        conditions.push({
          or: [
            { displayName: { contains: q } },
            { firstName: { contains: q } },
            { lastName: { contains: q } },
          ],
        });
      }
      const where =
        conditions.length === 1 ? conditions[0] : { or: conditions };
      const res = await payload.request<PayloadFindResponse<TgUserRow>>(
        "/api/telegram-users",
        { query: { where, limit, depth: 1 } },
      );
      if (res.totalDocs === 0) {
        return ok(
          `🔍 Không tìm thấy Telegram user nào khớp. (User chưa từng chat với bot, hoặc tên/username sai.)`,
        );
      }
      return ok(
        `👤 ${res.totalDocs} kết quả${res.docs.length < res.totalDocs ? ` (top ${res.docs.length})` : ""}:\n\n${res.docs.map(fmtUser).join("\n\n")}`,
      );
    } catch (e) {
      return err(`Lookup thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

const list_telegram_groups = tool(
  "list_telegram_groups",
  `Liệt kê các group Telegram bot đang ở.`,
  {
    active: z.boolean().optional(),
    purpose: z
      .enum(["internal_general", "internal_dept", "partner", "candidates", "other"])
      .optional(),
    limit: z.number().int().positive().max(50).default(20),
  },
  async ({ active, purpose, limit }) => {
    try {
      const conditions: Record<string, unknown>[] = [];
      if (active !== undefined) conditions.push({ active: { equals: active } });
      if (purpose) conditions.push({ purpose: { equals: purpose } });
      const where = conditions.length > 0 ? { and: conditions } : undefined;
      const res = await payload.request<PayloadFindResponse<TgGroupRow>>(
        "/api/telegram-groups",
        { query: { where, limit, depth: 0 } },
      );
      if (res.totalDocs === 0) return ok("🔍 Chưa có group Telegram nào.");
      const lines = res.docs.map((g) =>
        `#${g.id} "${g.title ?? "?"}" (${g.type})\n  chatId: ${g.telegramChatId}\n  purpose: ${g.purpose ?? "?"} · msg=${g.messageCount ?? 0} · active=${g.active}`,
      );
      return ok(
        `🏢 ${res.totalDocs} group${res.docs.length < res.totalDocs ? ` (top ${res.docs.length})` : ""}:\n\n${lines.join("\n\n")}`,
      );
    } catch (e) {
      return err(`Liệt kê groups thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

const list_group_members = tool(
  "list_group_members",
  `Liệt kê member của 1 group Telegram qua bảng membership.`,
  {
    telegramGroupId: z.string().describe("Internal ID của TelegramGroup row"),
    limit: z.number().int().positive().max(100).default(50),
  },
  async ({ telegramGroupId, limit }) => {
    try {
      const res = await payload.request<PayloadFindResponse<TgMembershipRow>>(
        "/api/telegram-membership",
        {
          query: {
            where: { telegramGroup: { equals: telegramGroupId } },
            limit,
            depth: 1,
          },
        },
      );
      if (res.totalDocs === 0)
        return ok("🔍 Group này chưa có member nào trong DB.");
      const lines = res.docs.map((m) => {
        const u = typeof m.telegramUser === "object" ? m.telegramUser : null;
        const who = u
          ? `${u.displayName ?? u.telegramUserId} (${u.telegramUserId})`
          : String(m.telegramUser ?? "?");
        return `  • ${who} · role=${m.role} · msg=${m.messageCount ?? 0} · last=${m.lastSeenAt ?? "?"}`;
      });
      return ok(
        `👥 ${res.totalDocs} member trong group:\n${lines.join("\n")}`,
      );
    } catch (e) {
      return err(`Liệt kê member thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

export const telegramIdentityTools: AnyTool[] = [
  lookup_telegram_user as AnyTool,
  list_telegram_groups as AnyTool,
  list_group_members as AnyTool,
];
