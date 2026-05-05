/**
 * Tools để AI tạo / quản lý lịch nhắc tự do (collection `reminders`).
 *
 * Khác auto reminder theo workflow stage (file `cron/order-reminders.ts`),
 * collection này phục vụ "CEO/quản lý nhờ AI đặt lịch":
 *   - "Nhắc tôi 9h sáng mai gọi đối tác Toyota"
 *   - "Nhắc team tuyển dụng follow-up đơn XHR-12 sau 3 ngày"
 *   - "Hoãn lịch nhắc #abc tới thứ 6 tuần sau"
 *
 * AI chịu trách nhiệm parse "9h sáng mai" / "3 ngày nữa" thành ISO datetime.
 * Pipeline đã inject `Thời gian hệ thống hiện tại: <ISO>` để AI biết today.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import type { PayloadFindResponse } from "../payload/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

const ROLE_VALUES = [
  "admin",
  "manager",
  "recruiter",
  "trainer",
  "visa_specialist",
  "accountant",
  "medical",
] as const;

interface ReminderRow {
  id: string;
  title: string;
  description?: string;
  dueAt: string;
  recipientType: "user" | "role";
  recipientUser?: string | { id: string; email?: string; displayName?: string };
  recipientRole?: string;
  status: "pending" | "sent" | "dismissed";
  sentAt?: string;
  snoozeUntil?: string;
  relatedOrder?: string | { id: string; orderCode?: string };
  relatedWorker?: string | { id: string; workerCode?: string };
}

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

function fmt(rem: ReminderRow): string {
  const lines: string[] = [`#${rem.id} ${rem.title}`];
  lines.push(`  📅 dueAt: ${rem.dueAt}`);
  if (rem.recipientType === "user") {
    const u = rem.recipientUser;
    const who =
      typeof u === "string"
        ? u
        : (u?.displayName ?? u?.email ?? u?.id ?? "?");
    lines.push(`  👤 recipient: ${who}`);
  } else if (rem.recipientType === "role") {
    lines.push(`  🏢 recipient: role=${rem.recipientRole}`);
  }
  lines.push(`  status: ${rem.status}`);
  if (rem.snoozeUntil) lines.push(`  ⏸ snooze: ${rem.snoozeUntil}`);
  if (rem.sentAt) lines.push(`  ✅ sentAt: ${rem.sentAt}`);
  if (rem.description?.trim()) {
    lines.push(`  📝 ${rem.description.trim().slice(0, 200)}`);
  }
  return lines.join("\n");
}

const create_reminder = tool(
  "create_reminder",
  `Tạo 1 lịch nhắc nhở. Bot sẽ DM Telegram người nhận đúng giờ \`dueAt\`.

Khi user nói "nhắc tôi" → recipientType="user" + recipientUser=<id user
hiện tại> (nếu biết, hoặc bỏ trống và để admin handle).
Khi user nói "nhắc team tuyển dụng" → recipientType="role" + recipientRole="recruiter".

\`dueAt\` PHẢI là ISO 8601 với timezone (vd "2026-05-04T09:00:00+07:00"
cho 9h sáng giờ VN). Tự suy ra date dựa vào "Thời gian hệ thống hiện tại"
trong system prompt.`,
  {
    title: z.string().min(1).describe("Tiêu đề ngắn — sẽ hiện đầu DM"),
    dueAt: z
      .string()
      .describe("ISO 8601 datetime với timezone, vd 2026-05-04T09:00:00+07:00"),
    recipientType: z.enum(["user", "role"]).describe("'user' = 1 người, 'role' = cả phòng ban"),
    recipientUser: z
      .string()
      .optional()
      .describe("User ID khi recipientType='user'"),
    recipientRole: z
      .enum(ROLE_VALUES)
      .optional()
      .describe(
        "Role khi recipientType='role'. Hợp lệ: admin, manager, recruiter, trainer, visa_specialist, accountant, medical",
      ),
    description: z.string().optional().describe("Mô tả thêm context (vài câu)"),
    relatedOrderId: z.string().optional().describe("Liên kết đơn tuyển nếu có"),
    relatedWorkerId: z.string().optional().describe("Liên kết LĐ nếu có"),
  },
  async (args) => {
    if (args.recipientType === "user" && !args.recipientUser) {
      return err(
        "Thiếu recipientUser. Nếu chưa biết user ID, hỏi user xác nhận họ là ai (qua list_workers/list orders cũng không lấy được — cần user trong collection users).",
      );
    }
    if (args.recipientType === "role" && !args.recipientRole) {
      return err("Thiếu recipientRole khi recipientType='role'.");
    }
    try {
      const body: Record<string, unknown> = {
        title: args.title,
        dueAt: args.dueAt,
        recipientType: args.recipientType,
        status: "pending",
      };
      if (args.recipientUser) body.recipientUser = args.recipientUser;
      if (args.recipientRole) body.recipientRole = args.recipientRole;
      if (args.description) body.description = args.description;
      if (args.relatedOrderId) body.relatedOrder = args.relatedOrderId;
      if (args.relatedWorkerId) body.relatedWorker = args.relatedWorkerId;

      const created = await payload.request<{ doc: ReminderRow }>("/api/reminders", {
        method: "POST",
        body,
      });
      return ok(`✅ Đã tạo lịch nhắc #${created.doc.id}\n\n${fmt(created.doc)}`);
    } catch (e) {
      return err(`Tạo reminder thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

const list_reminders = tool(
  "list_reminders",
  `Liệt kê lịch nhắc — lọc theo status, người nhận, hoặc khoảng thời gian.`,
  {
    status: z
      .enum(["pending", "sent", "dismissed"])
      .optional()
      .describe("Lọc theo trạng thái. Default: tất cả."),
    recipientUser: z
      .string()
      .optional()
      .describe("Lọc reminder gửi cho user ID này"),
    recipientRole: z
      .enum(ROLE_VALUES)
      .optional()
      .describe("Lọc reminder gửi cho role này"),
    fromDate: z
      .string()
      .optional()
      .describe("ISO date — lọc dueAt >= fromDate"),
    toDate: z
      .string()
      .optional()
      .describe("ISO date — lọc dueAt <= toDate"),
    limit: z.number().int().positive().max(100).default(20),
  },
  async (args) => {
    try {
      const conditions: Record<string, unknown>[] = [];
      if (args.status) conditions.push({ status: { equals: args.status } });
      if (args.recipientUser)
        conditions.push({ recipientUser: { equals: args.recipientUser } });
      if (args.recipientRole)
        conditions.push({ recipientRole: { equals: args.recipientRole } });
      if (args.fromDate)
        conditions.push({ dueAt: { greater_than_equal: args.fromDate } });
      if (args.toDate)
        conditions.push({ dueAt: { less_than_equal: args.toDate } });

      const where = conditions.length > 0 ? { and: conditions } : undefined;
      const res = await payload.request<PayloadFindResponse<ReminderRow>>(
        "/api/reminders",
        { query: { where, limit: args.limit, sort: "dueAt", depth: 1 } },
      );
      if (res.totalDocs === 0) {
        return ok("🔍 Không có lịch nhắc nào khớp.");
      }
      const lines = res.docs.map(fmt);
      return ok(
        `🔔 ${res.totalDocs} lịch nhắc${res.docs.length < res.totalDocs ? ` (top ${res.docs.length})` : ""}:\n\n${lines.join("\n\n")}`,
      );
    } catch (e) {
      return err(`Liệt kê thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

const update_reminder = tool(
  "update_reminder",
  `Sửa 1 lịch nhắc (đổi giờ, đổi người nhận, đổi tiêu đề, ...). Truyền chỉ field cần đổi.`,
  {
    id: z.string().describe("Reminder ID"),
    title: z.string().optional(),
    dueAt: z.string().optional(),
    recipientType: z.enum(["user", "role"]).optional(),
    recipientUser: z.string().optional(),
    recipientRole: z.enum(ROLE_VALUES).optional(),
    description: z.string().optional(),
  },
  async (args) => {
    const { id, ...patch } = args;
    const body = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(body).length === 0) {
      return err("Không có field nào để cập nhật.");
    }
    try {
      const res = await payload.request<{ doc: ReminderRow }>(
        `/api/reminders/${encodeURIComponent(id)}`,
        { method: "PATCH", body },
      );
      return ok(`✅ Đã cập nhật reminder\n\n${fmt(res.doc)}`);
    } catch (e) {
      return err(`Cập nhật thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

const snooze_reminder = tool(
  "snooze_reminder",
  `Hoãn 1 reminder pending tới thời điểm khác. Nếu reminder đã sent thì
việc snooze không có tác dụng — phải tạo cái mới.`,
  {
    id: z.string().describe("Reminder ID"),
    snoozeUntil: z
      .string()
      .describe("ISO 8601 datetime — bot sẽ bỏ qua reminder cho tới thời điểm này"),
  },
  async ({ id, snoozeUntil }) => {
    try {
      const res = await payload.request<{ doc: ReminderRow }>(
        `/api/reminders/${encodeURIComponent(id)}`,
        { method: "PATCH", body: { snoozeUntil } },
      );
      return ok(`⏸ Đã hoãn reminder tới ${snoozeUntil}\n\n${fmt(res.doc)}`);
    } catch (e) {
      return err(`Hoãn thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

const dismiss_reminder = tool(
  "dismiss_reminder",
  `Huỷ 1 reminder (sẽ không gửi nữa, kể cả khi đã đến giờ). Khác delete:
giữ lại bản ghi trong DB để audit.`,
  {
    id: z.string().describe("Reminder ID"),
  },
  async ({ id }) => {
    try {
      const res = await payload.request<{ doc: ReminderRow }>(
        `/api/reminders/${encodeURIComponent(id)}`,
        { method: "PATCH", body: { status: "dismissed" } },
      );
      return ok(`🚫 Đã huỷ reminder\n\n${fmt(res.doc)}`);
    } catch (e) {
      return err(`Huỷ thất bại: ${e instanceof PayloadError ? e.message : e}`);
    }
  },
);

export const reminderTools: AnyTool[] = [
  create_reminder as AnyTool,
  list_reminders as AnyTool,
  update_reminder as AnyTool,
  snooze_reminder as AnyTool,
  dismiss_reminder as AnyTool,
];
