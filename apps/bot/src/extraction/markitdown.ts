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

  const text = await res.text();
  logger.debug("MarkItDown", `Converted ${fileName} → ${text.length} chars`);
  return text;
}
