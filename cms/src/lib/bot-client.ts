/**
 * Thin client gọi bot's internal HTTP API. Dùng trong Payload hooks
 * để trigger extract / verify khi user upload file mới.
 *
 * Auth bằng shared secret. Cả 2 phía đọc cùng env `INTERNAL_SECRET`.
 */

interface BotResponse<T> {
  ok?: true;
  data?: T;
  error?: string;
  message?: string;
}

const BOT_URL = process.env.BOT_INTERNAL_URL ?? "http://localhost:4001";
const SECRET = process.env.INTERNAL_SECRET ?? "change-me-internal-secret";

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BOT_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": SECRET,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const json = (await res.json().catch(() => null)) as BotResponse<T> | null;
  if (!res.ok || !json?.ok) {
    const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`;
    throw new Error(`Bot API ${path} thất bại: ${msg}`);
  }
  return json.data as T;
}

export const botClient = {
  extractInvoice: (mediaUrl: string, mediaName: string) =>
    call<unknown>("/api/extract-invoice", { mediaUrl, mediaName }),

  extractBrief: (mediaUrl: string, mediaName: string) =>
    call<unknown>("/api/extract-brief", { mediaUrl, mediaName }),

  compare: (invoice: unknown, brief: unknown) =>
    call<{
      status: "match" | "warning" | "rejected";
      qtyMatch: boolean;
      sizeMatch: boolean;
      descMatchPercent: number;
      details?: string;
    }>("/api/compare", { invoice, brief }),

  verifyImage: (mediaUrl: string, mediaType?: string) =>
    call<{
      isValid: boolean;
      reasoning: string;
      hasTwoSubjects: boolean;
      hasConfirmationKeyword: boolean;
      detectedKeywords: string[];
    }>("/api/verify-image", { mediaUrl, mediaType }),
};
