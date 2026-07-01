/**
 * File validator — sniff magic bytes qua Google Magika (deep-learning content
 * type detection). Bảo vệ pipeline ingestion khỏi:
 *  - File giả mạo (.exe đổi đuôi .pdf)
 *  - File rỗng / corrupted
 *  - File loại không support (vd archive lớn, executable...)
 *
 * Cost: ~10-50ms/file CPU. Model ONNX load 1 lần khi bot khởi động.
 *
 * Returns:
 *   - allowed: true → file safe, có thể vào MarkItDown/vision OCR
 *   - allowed: false → reject với reason cụ thể
 */
import { MagikaNode as Magika } from "magika/node";

import { logger } from "../utils/logger.js";

/** Loại file Magika CHO PHÉP đi tiếp vào pipeline. Tất cả khác → reject. */
const ALLOWED_LABELS = new Set([
  // Documents
  "pdf",
  "docx",
  "doc",
  "xlsx",
  "xls",
  "pptx",
  "ppt",
  "odt",
  "ods",
  "odp",
  "rtf",
  // Text
  "txt",
  "md",
  "csv",
  "tsv",
  "html",
  "xml",
  "json",
  "yaml",
  "markdown",
  // Images
  "jpeg",
  "png",
  "gif",
  "webp",
  "tiff",
  "bmp",
  "svg",
  "heic",
  "heif",
  // Generic fallback Magika dùng cho text không xác định
  "asciidoc",
  "ascii_text",
  "unknown_text",
]);

/** Đặc biệt nguy hiểm — REJECT ngay cả khi user tin tưởng (extension đúng). */
const BLOCKED_LABELS = new Set([
  "pebin",        // Windows PE executable
  "elfbinary",    // Linux ELF executable
  "macho",        // macOS Mach-O
  "msi",          // Windows installer
  "script",       // generic script
  "javascript",   // .js (script chạy được)
  "vba",          // VBA macro
  "powershell",   // PowerShell script
  "shellscript",  // bash/sh
  "batch",        // Windows .bat
  "appx",         // Windows AppX
]);

let _magikaPromise: Promise<Magika> | null = null;

async function getMagika(): Promise<Magika> {
  if (!_magikaPromise) {
    const start = Date.now();
    logger.info("Magika", "Loading model...");
    _magikaPromise = Magika.create().then((m) => {
      logger.info("Magika", `Model loaded in ${Date.now() - start}ms`);
      return m;
    });
  }
  return _magikaPromise;
}

export interface FileValidationResult {
  allowed: boolean;
  /** Loại file Magika detect được (vd "pdf", "jpeg"). */
  detectedLabel: string;
  /** Confidence score 0-1. */
  score: number;
  /** Reason reject nếu allowed=false. */
  reason?: string;
}

/**
 * Validate buffer trước khi đưa vào MarkItDown / vision OCR / upload Media.
 * Throws KHÔNG được — caller có thể chọn skip hoặc warn.
 */
export async function validateFile(
  buf: Buffer,
  claimedFilename?: string,
): Promise<FileValidationResult> {
  if (buf.length === 0) {
    return { allowed: false, detectedLabel: "empty", score: 1, reason: "File rỗng (0 bytes)" };
  }
  // Magika sniff
  let label: string;
  let score: number;
  try {
    const m = await getMagika();
    const res = await m.identifyBytes(new Uint8Array(buf));
    label = res.prediction.output.label;
    score = res.prediction.score ?? 0;
  } catch (err) {
    logger.warn("Magika", `identifyBytes failed: ${err}`);
    // Magika lỗi → cho qua (fail-open). Không block pipeline vì model bị issue.
    return { allowed: true, detectedLabel: "unknown", score: 0, reason: undefined };
  }

  if (BLOCKED_LABELS.has(label)) {
    return {
      allowed: false,
      detectedLabel: label,
      score,
      reason: `File loại "${label}" có thể nguy hiểm (executable/script). Reject.`,
    };
  }

  if (!ALLOWED_LABELS.has(label)) {
    logger.warn(
      "Magika",
      `Unknown/unsupported label "${label}" for ${claimedFilename ?? "?"} (score=${score.toFixed(2)})`,
    );
    return {
      allowed: false,
      detectedLabel: label,
      score,
      reason: `Loại file "${label}" không nằm trong danh sách hỗ trợ.`,
    };
  }

  return { allowed: true, detectedLabel: label, score };
}

/** Eager-load model khi bot khởi động (tránh delay request đầu). */
export async function preloadMagika(): Promise<void> {
  await getMagika();
}
