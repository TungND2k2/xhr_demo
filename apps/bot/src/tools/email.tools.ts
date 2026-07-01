/**
 * Email tool — AI gửi email cho lãnh đạo (chị Hương + chị Hoa) qua SMTP.
 *
 * Cấu hình:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM trong .env.
 *
 * Bảo mật:
 *   - EMAIL_ALLOWED_RECIPIENTS whitelist các địa chỉ AI được phép gửi tới
 *     (comma-separated). Để trống = cho phép tất cả (chỉ dùng dev).
 *   - HTML body cho phép format đẹp; nội dung do AI sinh.
 *
 * Use case:
 *   - Báo cáo sáng 8h cho c.Hương + c.Hoa
 *   - Báo cáo tuần cho sếp tổng
 *   - Thông báo khẩn cấp khi đơn ì
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";

import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload } from "../payload/client.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

interface EmailSettings {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  allowedRecipients?: Array<{ email: string; note?: string }>;
}

let cachedSettings: { data: EmailSettings; expiresAt: number } | null = null;
const SETTINGS_TTL_MS = 60_000; // refresh mỗi 60s

async function loadSettings(): Promise<EmailSettings> {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.data;
  }
  try {
    const data = await payload.request<EmailSettings>(`/api/globals/email-settings`);
    cachedSettings = { data, expiresAt: Date.now() + SETTINGS_TTL_MS };
    return data;
  } catch (e) {
    logger.warn("Email", `load EmailSettings global fail (sẽ fallback env): ${e}`);
    return {};
  }
}

/** Resolve config: portal Global ưu tiên, env làm fallback. */
async function resolveConfig(): Promise<{
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  enabled: boolean;
  whitelist: Set<string> | null;
}> {
  const env = getConfig();
  const g = await loadSettings();
  // Whitelist: ưu tiên portal array; fallback env (comma-separated)
  let whitelist: Set<string> | null = null;
  if (g.allowedRecipients && g.allowedRecipients.length > 0) {
    whitelist = new Set(g.allowedRecipients.map((r) => r.email.trim().toLowerCase()).filter(Boolean));
  } else if (env.EMAIL_ALLOWED_RECIPIENTS) {
    whitelist = new Set(
      env.EMAIL_ALLOWED_RECIPIENTS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    );
  }
  return {
    host: g.host ?? env.SMTP_HOST,
    port: g.port ?? env.SMTP_PORT,
    secure: g.secure ?? (env.SMTP_PORT === 465),
    user: g.user ?? env.SMTP_USER,
    pass: g.pass ?? env.SMTP_PASS,
    from: g.from ?? env.SMTP_FROM,
    enabled: g.enabled !== false, // default ON if portal not set
    whitelist,
  };
}

async function getTransporter(): Promise<{ tx: Transporter; from: string; whitelist: Set<string> | null; enabled: boolean } | null> {
  const c = await resolveConfig();
  if (!c.enabled) return null;
  if (!c.host || !c.user || !c.pass) return null;
  const tx = nodemailer.createTransport({
    host: c.host,
    port: c.port ?? 587,
    secure: !!c.secure,
    auth: { user: c.user, pass: c.pass },
  });
  return { tx, from: c.from ?? c.user, whitelist: c.whitelist, enabled: c.enabled };
}

function isRecipientAllowed(addr: string, whitelist: Set<string> | null): boolean {
  if (!whitelist) return true;
  return whitelist.has(addr.trim().toLowerCase());
}

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

const send_email = tool(
  "send_email",
  `Gửi 1 email qua SMTP công ty. Dùng cho:
- Báo cáo sáng / cuối ngày / tuần cho lãnh đạo (chị Hương, chị Hoa, sếp tổng)
- Thông báo khẩn khi có đơn quá hạn / sự cố LĐ
- Forward thông tin quan trọng từ chat → email cho người không dùng Telegram

Bảo mật: chỉ gửi được tới địa chỉ trong whitelist (EMAIL_ALLOWED_RECIPIENTS env).
Format body: hỗ trợ HTML đầy đủ. Dùng <h2>/<table>/<ul> cho báo cáo có cấu trúc.`,
  {
    to: z
      .array(z.string().email())
      .min(1)
      .describe("Danh sách email người nhận. Sẽ kiểm whitelist."),
    cc: z.array(z.string().email()).optional().describe("CC (tuỳ chọn)"),
    bcc: z.array(z.string().email()).optional().describe("BCC (tuỳ chọn)"),
    subject: z.string().min(1).describe("Tiêu đề email"),
    htmlBody: z
      .string()
      .min(1)
      .describe(
        "Nội dung HTML. AI có thể dùng <h1>/<h2>/<p>/<ul>/<table>/<strong> để format đẹp.",
      ),
    plainTextBody: z
      .string()
      .optional()
      .describe(
        "Plain text fallback. Nếu để trống, server tự strip HTML tags.",
      ),
  },
  async (args) => {
    const conf = await getTransporter();
    if (!conf) {
      return err(
        "SMTP chưa cấu hình hoặc đã tắt. Admin vào /admin/globals/email-settings để bật + điền config.",
      );
    }
    const { tx, from, whitelist } = conf;

    // Whitelist check
    const allRecipients = [
      ...args.to,
      ...(args.cc ?? []),
      ...(args.bcc ?? []),
    ];
    if (whitelist) {
      const blocked = allRecipients.filter((e) => !whitelist.has(e.trim().toLowerCase()));
      if (blocked.length > 0) {
        return err(
          `Các email sau KHÔNG có trong whitelist: ${blocked.join(", ")}. ` +
            `Admin vào /admin/globals/email-settings → "Whitelist địa chỉ nhận" để thêm.`,
        );
      }
    }

    const plainText =
      args.plainTextBody ??
      args.htmlBody
        .replace(/<\/?[^>]+>/g, "") // strip tags
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();

    try {
      const info = await tx.sendMail({
        from,
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        subject: args.subject,
        text: plainText,
        html: args.htmlBody,
      });
      logger.info(
        "Email",
        `→ ${args.to.join(",")}${args.cc ? ` cc=${args.cc.join(",")}` : ""}: "${args.subject}" (id=${info.messageId})`,
      );
      return ok(
        `✅ Đã gửi email "${args.subject}" tới ${args.to.length} người (${args.to.join(", ")})${args.cc ? ` + ${args.cc.length} CC` : ""}.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn("Email", `sendMail failed: ${msg}`);
      return err(`Gửi email thất bại: ${msg}`);
    }
  },
);

export const emailTools: AnyTool[] = [send_email as AnyTool];
