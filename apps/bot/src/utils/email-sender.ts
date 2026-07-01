/**
 * Email sender — wrapped nodemailer + load SMTP config từ EmailSettings
 * global (portal) hoặc fallback env. Shared giữa email.tools.ts (AI tool)
 * và user-reminders.ts (cron worker).
 */
import nodemailer, { type Transporter } from "nodemailer";

import { getConfig } from "../config.js";
import { payload } from "../payload/client.js";
import { logger } from "./logger.js";

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
const SETTINGS_TTL_MS = 60_000;

async function loadSettings(): Promise<EmailSettings> {
  if (cachedSettings && cachedSettings.expiresAt > Date.now()) {
    return cachedSettings.data;
  }
  try {
    const data = await payload.request<EmailSettings>(`/api/globals/email-settings`);
    cachedSettings = { data, expiresAt: Date.now() + SETTINGS_TTL_MS };
    return data;
  } catch (e) {
    logger.warn("Email", `load EmailSettings fail (fallback env): ${e}`);
    return {};
  }
}

export interface ResolvedEmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  enabled: boolean;
  whitelist: Set<string> | null;
}

export async function resolveEmailConfig(): Promise<ResolvedEmailConfig | null> {
  const env = getConfig();
  const g = await loadSettings();
  const host = g.host ?? env.SMTP_HOST;
  const user = g.user ?? env.SMTP_USER;
  const pass = g.pass ?? env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  if (g.enabled === false) return null;

  let whitelist: Set<string> | null = null;
  if (g.allowedRecipients && g.allowedRecipients.length > 0) {
    whitelist = new Set(g.allowedRecipients.map((r) => r.email.trim().toLowerCase()).filter(Boolean));
  } else if (env.EMAIL_ALLOWED_RECIPIENTS) {
    whitelist = new Set(
      env.EMAIL_ALLOWED_RECIPIENTS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    );
  }

  return {
    host,
    port: g.port ?? env.SMTP_PORT,
    secure: g.secure ?? (env.SMTP_PORT === 465),
    user,
    pass,
    from: g.from ?? env.SMTP_FROM ?? user,
    enabled: true,
    whitelist,
  };
}

export function isAllowed(email: string, whitelist: Set<string> | null): boolean {
  if (!whitelist) return true;
  return whitelist.has(email.trim().toLowerCase());
}

let _transporter: Transporter | null = null;
let _txKey = "";

function getTransporter(cfg: ResolvedEmailConfig): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (_transporter && _txKey === key) return _transporter;
  _transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  _txKey = key;
  return _transporter;
}

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  plainTextBody?: string;
}

export interface SendEmailResult {
  ok: boolean;
  sent?: number;
  messageId?: string;
  error?: string;
  blockedRecipients?: string[];
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const cfg = await resolveEmailConfig();
  if (!cfg) return { ok: false, error: "SMTP chưa cấu hình hoặc đã tắt" };

  const allRecipients = [...input.to, ...(input.cc ?? []), ...(input.bcc ?? [])];
  if (cfg.whitelist) {
    const blocked = allRecipients.filter((e) => !isAllowed(e, cfg.whitelist));
    if (blocked.length > 0) {
      return { ok: false, error: "Có email không nằm trong whitelist", blockedRecipients: blocked };
    }
  }

  const plainText =
    input.plainTextBody ??
    input.htmlBody
      .replace(/<\/?[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

  try {
    const info = await getTransporter(cfg).sendMail({
      from: cfg.from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: plainText,
      html: input.htmlBody,
    });
    return { ok: true, sent: input.to.length, messageId: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
