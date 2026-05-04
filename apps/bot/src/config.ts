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

  // Bot HTTP server (Payload hooks gọi vào)
  BOT_HTTP_PORT: z.coerce.number().default(4002),
  INTERNAL_SECRET: z.string().min(8).default("change-me-internal-secret"),

  // Logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().default(5),
  QUEUE_MAX_SIZE: z.coerce.number().default(100),
  QUEUE_JOB_TIMEOUT_MS: z.coerce.number().default(660_000),

  // Pipeline
  MAX_TOOL_LOOPS: z.coerce.number().default(10),

  // Cron
  CRON_TICK_MS: z.coerce.number().default(10_000),

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
