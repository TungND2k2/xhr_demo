/**
 * PDF → page PNGs qua poppler `pdftoppm`. Dùng cho fallback khi MarkItDown
 * trả empty (= PDF scan, không có text layer). Mỗi trang sau đó được push
 * như image attachment vào pipeline → Claude vision OCR + phân tích.
 *
 * Yêu cầu: `apt install poppler-utils` trên host. Wrapper sẽ throw rõ ràng
 * nếu binary thiếu để caller fallback gracefully.
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { newId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

export class PdfToImagesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfToImagesError";
  }
}

export interface PdfPageImage {
  page: number;
  buffer: Buffer;
}

/**
 * Convert PDF (buffer) thành PNG từng trang. Limit số trang để tránh
 * blowup token khi user gửi PDF dài.
 *
 * pdftoppm tự pad page suffix: 1 chữ số nếu < 10 trang, 2 chữ số nếu < 100,
 * v.v. Sort tên file theo thứ tự tự nhiên (numeric) để đúng thứ tự trang.
 */
export async function pdfToImages(
  pdfBuffer: Buffer,
  opts: { maxPages?: number; dpi?: number } = {},
): Promise<PdfPageImage[]> {
  const maxPages = opts.maxPages ?? 5;
  const dpi = opts.dpi ?? 150;

  const tmpDir = path.join(os.tmpdir(), `pdf2img-${newId()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, "input.pdf");
  const outputPrefix = path.join(tmpDir, "page");

  try {
    await fs.writeFile(inputPath, pdfBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("pdftoppm", [
        "-png",
        "-r",
        String(dpi),
        "-l",
        String(maxPages), // last page
        inputPath,
        outputPrefix,
      ]);
      let stderr = "";
      proc.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on("error", (err: Error) => {
        reject(
          new PdfToImagesError(
            err.message.includes("ENOENT")
              ? "pdftoppm không có trên host (cần `apt install poppler-utils`)"
              : `pdftoppm spawn error: ${err.message}`,
          ),
        );
      });
      proc.on("close", (code: number | null) => {
        if (code === 0) resolve();
        else reject(new PdfToImagesError(`pdftoppm exit ${code}: ${stderr.slice(0, 200)}`));
      });
    });

    const all = await fs.readdir(tmpDir);
    const files = all
      .filter((f: string) => f.startsWith("page") && f.endsWith(".png"))
      .sort((a: string, b: string) => {
        const na = Number(a.match(/-(\d+)\.png$/)?.[1] ?? 0);
        const nb = Number(b.match(/-(\d+)\.png$/)?.[1] ?? 0);
        return na - nb;
      });

    if (files.length === 0) {
      throw new PdfToImagesError("pdftoppm chạy xong nhưng không có file PNG nào");
    }

    const out: PdfPageImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = await fs.readFile(path.join(tmpDir, files[i]));
      out.push({ page: i + 1, buffer: buf });
    }
    logger.info("PdfToImages", `${files.length} pages @ ${dpi}dpi từ ${pdfBuffer.length} bytes`);
    return out;
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch((e: unknown) => {
      logger.warn("PdfToImages", `Cleanup ${tmpDir} failed: ${e}`);
    });
  }
}
