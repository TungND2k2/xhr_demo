// Re-used as-is from previous src/cron/cron-schedule.ts — no changes needed.
import { CronExpressionParser } from "cron-parser";

/** Parse a cron expression and return the next fire time as unix-ms. */
export function nextRunAt(schedule: string, fromMs?: number): number {
  const interval = CronExpressionParser.parse(schedule, {
    currentDate: fromMs ? new Date(fromMs) : new Date(),
  });
  return interval.next().getTime();
}

export function validateCron(schedule: string): string | null {
  try {
    CronExpressionParser.parse(schedule);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
