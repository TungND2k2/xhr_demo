import type { Config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface QueueJob {
  id: string;
  /** Lower = higher priority */
  priority: number;
  enqueuedAt: number;
  run: () => Promise<void>;
}

/**
 * In-process priority queue with bounded concurrency. Reused as-is from
 * the previous bot — battle-tested, no Mongo coupling so it transfers
 * to the Payload-based architecture without changes.
 */
export class MessageQueue {
  private readonly queue: QueueJob[] = [];
  private running = 0;
  private stopped = false;

  constructor(private readonly config: Config) {}

  enqueue(job: QueueJob): boolean {
    if (this.stopped) return false;
    if (this.queue.length >= this.config.QUEUE_MAX_SIZE) {
      logger.warn("Queue", `Full (${this.config.QUEUE_MAX_SIZE}), dropping ${job.id}`);
      return false;
    }
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].priority > job.priority) i--;
    this.queue.splice(i, 0, job);
    this.drain();
    return true;
  }

  stop(): void { this.stopped = true; }

  get size(): number { return this.queue.length; }
  get activeCount(): number { return this.running; }

  private drain(): void {
    while (this.running < this.config.QUEUE_CONCURRENCY && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      this.execute(job).finally(() => {
        this.running--;
        this.drain();
      });
    }
  }

  private async execute(job: QueueJob): Promise<void> {
    const timer = setTimeout(() => {
      logger.warn("Queue", `Job ${job.id} > ${this.config.QUEUE_JOB_TIMEOUT_MS}ms`);
    }, this.config.QUEUE_JOB_TIMEOUT_MS);
    try { await job.run(); }
    catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("Queue", `Job ${job.id} failed: ${msg}`, error);
    } finally { clearTimeout(timer); }
  }
}
