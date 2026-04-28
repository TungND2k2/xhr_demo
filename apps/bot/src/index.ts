/**
 * SkillBot — Telegram bot + Claude AI orchestrator.
 *
 * Process responsibilities:
 *  - Long-poll Telegram, queue messages, run Claude pipeline → reply.
 *  - Run cron jobs (weekly purchase Monday, weekly report Friday, hourly stock watch).
 *  - Notify admins via Telegram when crons fire or alerts trigger.
 *
 * All data lives in Payload CMS. This process never touches MongoDB directly.
 */
import "dotenv/config";

import { loadConfig } from "./config.js";
import { logger } from "./utils/logger.js";
import { payload } from "./payload/client.js";
import { TelegramChannel } from "./telegram/channel.js";
import { CronWorker } from "./cron/worker.js";
import { buildCronJobs } from "./cron/jobs.js";
import { startHttpServer, type HttpServerHandle } from "./http/server.js";

let telegram: TelegramChannel | null = null;
let cron: CronWorker | null = null;
let httpServer: HttpServerHandle | null = null;

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info("Boot", `SkillBot (${config.NODE_ENV}) starting`);

  // Sanity check: Payload must be reachable.
  try {
    await payload.request("/api/users/me");
    logger.info("Boot", `Payload reachable @ ${config.PAYLOAD_URL}`);
  } catch (e) {
    logger.error("Boot", `Cannot reach Payload — exit. ${e}`);
    process.exit(1);
  }

  // HTTP server cho Payload hooks gọi vào (extract / verify).
  httpServer = startHttpServer();

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (telegramToken) {
    telegram = new TelegramChannel(telegramToken, config);
    telegram.start();

    const adminChatNum = adminChatId ? Number(adminChatId) : undefined;
    cron = new CronWorker(
      buildCronJobs({ telegram, adminChatId: adminChatNum }),
      {
        tickMs: config.CRON_TICK_MS,
        notify: async (jobName, text) => {
          if (!adminChatNum) return; // không có admin chat → bỏ qua admin DM
          logger.info("Cron", `→ admin: ${jobName}`);
          await telegram!.sendMessage(adminChatNum, text);
        },
      },
    );
    cron.start();
    if (!adminChatNum) {
      logger.warn("Boot", "TELEGRAM_ADMIN_CHAT_ID not set — admin notifications disabled (per-user DMs vẫn chạy)");
    }
  } else {
    logger.warn("Boot", "TELEGRAM_BOT_TOKEN not set — Telegram channel disabled (running headless)");
  }

  logger.info("Boot", "Ready");
}

async function shutdown(signal: string): Promise<void> {
  logger.info("Boot", `${signal} received — shutting down`);
  telegram?.stop();
  cron?.stop();
  await httpServer?.stop();
  setTimeout(() => process.exit(0), 200);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
