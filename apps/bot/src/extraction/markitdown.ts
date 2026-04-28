/**
 * MarkItDown client — convert PDF/DOCX/XLSX/etc → markdown text.
 *
 * Service chạy ở: docker run -p 8080:8080 ghcr.io/microsoft/markitdown
 * Endpoint: POST /convert (multipart) → returns text/markdown
 *
 * Bot tải file từ Payload media URL, gửi sang MarkItDown, nhận text.
 */
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export class MarkItDownError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "MarkItDownError";
  }
}

/**
 * Convert a file (binary) into markdown text.
 * @param fileBuffer raw bytes
 * @param fileName  original filename (used for content-type sniffing)
 * @returns markdown text representation
 */
export async function convertToMarkdown(
  fileBuffer: ArrayBuffer | Buffer,
  fileName: string,
): Promise<string> {
  const cfg = getConfig();
  const url = `${cfg.MARKITDOWN_URL.replace(/\/$/, "")}/convert`;

  const form = new FormData();
  const blob = fileBuffer instanceof Buffer
    ? new Blob([new Uint8Array(fileBuffer)])
    : new Blob([fileBuffer]);
  form.append("file", blob, fileName);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new MarkItDownError(0, `MarkItDown unreachable: ${msg}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MarkItDownError(res.status, `MarkItDown ${res.status}: ${body.slice(0, 200)}`);
  }

  const raw = await res.text();
  // Service trả JSON `{"content":"...","title":"..."}` (bản fork phổ biến)
  // hoặc raw markdown text. Auto-detect bằng content-type + thử parse.
  const ct = res.headers.get("content-type") ?? "";
  let text = raw;
  if (ct.includes("application/json") || raw.trimStart().startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as { content?: string; markdown?: string; text?: string };
      const extracted = obj.content ?? obj.markdown ?? obj.text;
      if (typeof extracted === "string") text = extracted;
    } catch {
      // Không phải JSON hợp lệ — giữ raw
    }
  }
  logger.debug("MarkItDown", `Converted ${fileName} → ${text.length} chars (ct=${ct})`);
  return text;
}
