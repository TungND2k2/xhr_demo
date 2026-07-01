import { z } from "zod";

const ConfigSchema = z.object({
  // Payload backend
  PAYLOAD_URL: z.string().url().default("http://localhost:3002"),
  PAYLOAD_BOT_EMAIL: z.string().email(),
  PAYLOAD_BOT_PASSWORD: z.string().min(1),

  // Claude — claude-agent-sdk dùng OAuth Claude Max subscription, không cần key.
  CLAUDE_MODEL: z.string().default("claude-sonnet-4-5-20250929"),
  /** Đường dẫn tới `claude` native binary. Khi để trống, SDK tự dò.
   *  Trên Linux glibc (vd: Ubuntu) thường cần set rõ "/usr/bin/claude". */
  CLAUDE_BIN: z.string().optional(),

  // MarkItDown — file → markdown
  MARKITDOWN_URL: z.string().url().default("http://localhost:8080"),

  // Qdrant — vector search (Docker)
  QDRANT_URL: z.string().url().default("http://localhost:6333"),

  // Public URL của Payload CMS admin (cho FormInvite share, /admin link)
  PUBLIC_URL: z.string().url().default("https://xhr.cms-admin.x-or.cloud"),

  // Public URL của xHR Portal (cho khách hàng / nhân viên xem chi tiết).
  // Bot dùng link này khi handoff hoặc khi trả về "Xem hồ sơ".
  // Default = trỏ về VM LAN; khi gắn domain → update env.
  PORTAL_URL: z.string().url().default("https://x-hr.portal.x-or.cloud"),

  // Telegram Bot API base — mặc định cloud (limit 20MB upload).
  // Set sang "http://localhost:8081" để dùng self-hosted Telegram Bot API
  // Local Server (cho phép upload >20MB, tối đa 2GB).
  TELEGRAM_API_BASE: z.string().url().default("https://api.telegram.org"),

  // Bot HTTP server (Payload hooks gọi vào)
  BOT_HTTP_PORT: z.coerce.number().default(4002),
  INTERNAL_SECRET: z.string().min(8).default("change-me-internal-secret"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().default(5),
  QUEUE_MAX_SIZE: z.coerce.number().default(100),
  QUEUE_JOB_TIMEOUT_MS: z.coerce.number().default(660_000),

  // Pipeline — số "turn" tối đa (mỗi turn có thể gọi nhiều tool song song).
  // Bump 10→30 vì các flow đối tác phức tạp (search nhiều keyword + cập nhật
  // multi-field cho 4-5 đơn) thường cần 15-25 turns. Nếu loop infinite thật
  // sự thì 30 vẫn cap được.
  MAX_TOOL_LOOPS: z.coerce.number().default(30),

  // Cron
  CRON_TICK_MS: z.coerce.number().default(10_000),

  // SMTP để gửi email báo cáo cho lãnh đạo. Để trống = email tool tắt.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional().describe('From address, vd "xHR Bot <bot@tlg.vn>"'),
  /** Whitelist email được phép gửi tới — bảo mật, tránh AI gửi nhầm.
   *  Comma-separated. Để trống = cho phép tất cả (không khuyến nghị). */
  EMAIL_ALLOWED_RECIPIENTS: z.string().optional(),

  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;
  _config = ConfigSchema.parse(process.env);
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}
