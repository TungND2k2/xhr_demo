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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const cfg = getConfig();
  if (!cfg.SMTP_HOST || !cfg.SMTP_USER || !cfg.SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: cfg.SMTP_PORT === 465,
    auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
  });
  return transporter;
}

function getAllowedRecipients(): Set<string> | null {
  const cfg = getConfig();
  if (!cfg.EMAIL_ALLOWED_RECIPIENTS) return null;
  return new Set(
    cfg.EMAIL_ALLOWED_RECIPIENTS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
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
    const cfg = getConfig();
    const tx = getTransporter();
    if (!tx) {
      return err(
        "SMTP chưa cấu hình (SMTP_HOST/USER/PASS env trống). Email tool tạm thời disabled.",
      );
    }

    // Whitelist check
    const whitelist = getAllowedRecipients();
    const allRecipients = [
      ...args.to,
      ...(args.cc ?? []),
      ...(args.bcc ?? []),
    ];
    const blocked = allRecipients.filter((e) => !isRecipientAllowed(e, whitelist));
    if (blocked.length > 0) {
      return err(
        `Các email sau KHÔNG có trong whitelist: ${blocked.join(", ")}. ` +
          `Admin cần thêm vào EMAIL_ALLOWED_RECIPIENTS để gửi.`,
      );
    }

    const from = cfg.SMTP_FROM ?? cfg.SMTP_USER ?? "bot@xhr.local";
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
