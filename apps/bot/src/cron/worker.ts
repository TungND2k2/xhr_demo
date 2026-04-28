/**
 * Cron worker — chạy job theo schedule định nghĩa cứng trong code.
 *
 * Khác con cron service cũ (chạy job từ DB), bot này chỉ có vài job
 * cố định nên hardcode đơn giản hơn. Mỗi job chạy 1 tool / aggregation
 * rồi push notification ra Telegram (qua callback `notify`).
 */
import { logger } from "../utils/logger.js";
import { nextRunAt } from "./cron-schedule.js";

export interface CronJob {
  name: string;
  /** Cron expression (5-field). VD "0 9 * * 1" = thứ Hai 9h. */
  schedule: string;
  /** Async fn returning text to send as notification. Empty string = skip. */
  run: () => Promise<string>;
}

export interface CronWorkerOptions {
  /** Polled period — không cần chính xác từng giây. */
  tickMs: number;
  /** Push notification callback (vd: gửi Telegram cho admin). */
  notify: (jobName: string, text: string) => Promise<void> | void;
}

export class CronWorker {
  private timer: NodeJS.Timeout | null = null;
  private nextRunByJob = new Map<string, number>();
  private running = false;

  constructor(
    private readonly jobs: CronJob[],
    private readonly options: CronWorkerOptions,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;

    // Compute initial next-run for each job.
    const now = Date.now();
    for (const j of this.jobs) {
      try {
        this.nextRunByJob.set(j.name, nextRunAt(j.schedule, now));
      } catch (err) {
        logger.error("Cron", `Bad schedule "${j.schedule}" for ${j.name}: ${err}`);
      }
    }

    this.tick();
    logger.info("Cron", `Started — ${this.jobs.length} jobs`);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private tick(): void {
    if (!this.running) return;
    const now = Date.now();

    for (const job of this.jobs) {
      const due = this.nextRunByJob.get(job.name);
      if (due === undefined || due > now) continue;

      this.runJob(job, now).catch((err) =>
        logger.error("Cron", `${job.name} threw: ${err}`),
      );
    }

    this.timer = setTimeout(() => this.tick(), this.options.tickMs);
  }

  private async runJob(job: CronJob, now: number): Promise<void> {
    // Reschedule first to avoid double-run on slow handlers.
    try {
      this.nextRunByJob.set(job.name, nextRunAt(job.schedule, now));
    } catch {/* keep old */}

    logger.info("Cron", `▶ ${job.name}`);
    let text = "";
    try {
      text = await job.run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Cron", `${job.name} failed: ${msg}`);
      return;
    }

    if (text.trim()) {
      try {
        await this.options.notify(job.name, text);
      } catch (e) {
        logger.error("Cron", `notify failed: ${e}`);
      }
    }
  }
}
