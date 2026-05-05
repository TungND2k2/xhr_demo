/**
 * Pre-defined cron jobs cho công ty XKLĐ:
 *  - Mỗi giờ: scan đơn tuyển overdue → DM Telegram theo workflow.reminders
 *  - T6 17h: báo cáo tuần (đếm đơn theo status, ứng viên đang training, ...)
 *
 * Job mua vải / tồn kho của bản skillbot may thêu đã được loại bỏ.
 */
import type { CronJob } from "./worker.js";
import { payload, PayloadError } from "../payload/client.js";
import type { PayloadFindResponse } from "../payload/types.js";
import type { TelegramChannel } from "../telegram/channel.js";
import { runOrderReminders } from "./order-reminders.js";
import { runUserReminders } from "./user-reminders.js";

interface OrderStatusRow {
  id: string;
  status: string;
  market?: string;
  quantityNeeded?: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface WorkerStatusRow {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

const MARKET_LABEL: Record<string, string> = {
  jp: "Nhật",
  kr: "Hàn",
  tw: "Đài",
  de: "Đức",
  me: "TĐ",
  eu: "EU",
  other: "Khác",
};

export interface BuildCronJobsOptions {
  /** Cần để job order-reminders gửi DM trực tiếp tới user. */
  telegram?: TelegramChannel;
  /** Fallback chat khi user không có telegramUserId. */
  adminChatId?: number;
}

export function buildCronJobs(opts: BuildCronJobsOptions = {}): CronJob[] {
  const jobs: CronJob[] = [
    {
      name: "weekly-report-friday",
      schedule: "0 17 * * 5", // Thứ Sáu 17h
      async run() {
        try {
          const [orders, workers] = await Promise.all([
            payload.request<PayloadFindResponse<OrderStatusRow>>("/api/orders", {
              query: { limit: 200 },
            }),
            payload.request<PayloadFindResponse<WorkerStatusRow>>("/api/workers", {
              query: { limit: 0 },
            }),
          ]);

          const byOrderStatus: Record<string, number> = {};
          const byMarket: Record<string, number> = {};
          for (const o of orders.docs) {
            byOrderStatus[o.status] = (byOrderStatus[o.status] ?? 0) + 1;
            if (o.market) {
              byMarket[o.market] = (byMarket[o.market] ?? 0) + 1;
            }
          }
          const byWorkerStatus: Record<string, number> = {};
          for (const w of workers.docs ?? []) {
            byWorkerStatus[w.status] = (byWorkerStatus[w.status] ?? 0) + 1;
          }

          return [
            "📊 *Báo cáo cuối tuần XKLĐ*",
            "",
            `📦 Đơn tuyển: ${orders.totalDocs}`,
            ...Object.entries(byOrderStatus).map(([s, n]) => `  • ${s.toUpperCase()}: ${n}`),
            "",
            "🌏 Theo thị trường:",
            ...Object.entries(byMarket).map(
              ([m, n]) => `  • ${MARKET_LABEL[m] ?? m}: ${n}`,
            ),
            "",
            `👥 Người lao động: ${workers.totalDocs}`,
            ...Object.entries(byWorkerStatus).map(([s, n]) => `  • ${s}: ${n}`),
          ].join("\n");
        } catch (e) {
          return `⚠️ Không sinh được báo cáo: ${e instanceof PayloadError ? e.message : e}`;
        }
      },
    },
  ];

  // Job DM theo workflow reminders — chỉ chạy khi có TelegramChannel
  if (opts.telegram) {
    const tg = opts.telegram;
    const adminChat = opts.adminChatId;
    jobs.push({
      name: "hourly-order-reminders",
      schedule: "5 * * * *",
      run: () => runOrderReminders({ telegram: tg, adminChatId: adminChat }),
    });
    jobs.push({
      name: "minute-user-reminders",
      schedule: "* * * * *", // mỗi phút
      run: () => runUserReminders({ telegram: tg, adminChatId: adminChat }),
    });
  }

  return jobs;
}
