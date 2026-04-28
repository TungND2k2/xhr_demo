import { getConfig } from "../config.js";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

function shouldLog(level: keyof typeof LEVELS): boolean {
  return LEVELS[level] >= LEVELS[getConfig().LOG_LEVEL];
}

function fmt(level: string, tag: string, msg: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${tag}] ${msg}`;
}

export const logger = {
  debug(tag: string, msg: string) { if (shouldLog("debug")) console.error(fmt("debug", tag, msg)); },
  info(tag: string, msg: string)  { if (shouldLog("info"))  console.error(fmt("info", tag, msg)); },
  warn(tag: string, msg: string)  { if (shouldLog("warn"))  console.error(fmt("warn", tag, msg)); },
  error(tag: string, msg: string, err?: unknown) {
    if (shouldLog("error")) {
      console.error(fmt("error", tag, msg));
      if (err instanceof Error) console.error(err.stack);
    }
  },
};
