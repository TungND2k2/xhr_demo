/**
 * Bulk import — đọc 1 thư mục scan HĐCU TLG, mỗi file:
 *
 *   1. Upload bytes → Payload Media (S3 + DB metadata)
 *   2. Extract text qua MarkItDown; nếu là PDF scan → fallback pdftoppm + vision OCR
 *   3. Parse filename để lấy `signedDate` + `employer` (vd "01032022 HĐCU TTSKN TLG J-Front.pdf"
 *      → date=2022-03-01, employer="J-Front")
 *   4. **Tạo Order draft** với info parse được, market='jp', status='paused'
 *      (draft — admin sẽ edit thêm position/quantity/...)
 *   5. Link Media với Order qua `orderDocuments[]` (kind="HĐCU scan", file=mediaId)
 *
 * Idempotent: skip nếu Media đã có cùng filename, hoặc Order đã có cùng contractNumber.
 *
 * Usage (chạy trên server):
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/bulk-import.js /tmp/scan-hdcu-tlg
 *
 * Performance ~3s/file PDF có text, ~30-60s/file PDF scan (vision OCR). 59 file
 * mix ≈ 8-15 phút.
 */
import "dotenv/config";
import { promises as fs } from "node:fs";
import * as path from "node:path";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";
import { convertToMarkdown, MarkItDownError } from "../extraction/markitdown.js";
import { pdfToImages, PdfToImagesError } from "../extraction/pdf-to-images.js";
import { describeScannedPdf } from "../extraction/describe.js";

interface ImportStats {
  total: number;
  mediaCreated: number;
  ordersCreated: number;
  skipped: number;
  failed: number;
  failedFiles: string[];
}

interface ParsedMeta {
  /** ISO date "YYYY-MM-DD" hoặc null nếu không parse được. */
  signedDate: string | null;
  /** Tên đối tác sau khi strip các từ khoá HĐCU/TTSKN/KNDD/TLG/CKS. */
  employer: string;
  /** "TTSKN" (Thực tập sinh kỹ năng) | "KNDD" (Kỹ năng đặc định) | "Khác". */
  programType: "TTSKN" | "KNDD" | "OTHER";
  /** Filename gốc không có extension — dùng làm contractNumber dự phòng. */
  baseName: string;
}

const SUPPORTED_EXTS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".md",
  ".csv",
]);

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
};

async function walkFolder(folder: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(folder, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(folder, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkFolder(full)));
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (SUPPORTED_EXTS.has(ext)) out.push(full);
    }
  }
  return out;
}

/**
 * Parse filename HĐCU TLG để lấy date + employer + program type.
 *
 * Examples:
 *   "01032022 HĐCU TTSKN TLG J-Front.pdf"       → 2022-03-01, J-Front, TTSKN
 *   "20220215 OKAYAMA EVENT.pdf"                → 2022-02-15, OKAYAMA EVENT, OTHER
 *   "20250630 SCAN HDCU LDKNDD TLG-TEX (CKS).pdf" → 2025-06-30, TEX, KNDD
 *   "15052024 HĐCU KNDD TLG Aichi Gijutsu...pdf" → 2024-05-15, Aichi Gijutsu, KNDD
 */
function parseHdcuFilename(filename: string): ParsedMeta {
  const baseName = path.basename(filename, path.extname(filename));
  const result: ParsedMeta = {
    signedDate: null,
    employer: "",
    programType: "OTHER",
    baseName,
  };

  // 1. Detect date prefix — 8 chữ số đầu
  const m = baseName.match(/^(\d{8})\s+(.+)$/);
  let rest = baseName;
  if (m) {
    const dateStr = m[1];
    rest = m[2];
    const a = parseInt(dateStr.slice(0, 2), 10);
    const b = parseInt(dateStr.slice(2, 4), 10);
    const c = parseInt(dateStr.slice(4, 8), 10);
    const yyyyFirst = parseInt(dateStr.slice(0, 4), 10);
    const mmMid = parseInt(dateStr.slice(4, 6), 10);
    const ddEnd = parseInt(dateStr.slice(6, 8), 10);

    if (yyyyFirst >= 2020 && yyyyFirst <= 2030 && mmMid >= 1 && mmMid <= 12 && ddEnd >= 1 && ddEnd <= 31) {
      // YYYYMMDD style: 20220215
      result.signedDate = `${yyyyFirst}-${String(mmMid).padStart(2, "0")}-${String(ddEnd).padStart(2, "0")}`;
    } else if (a >= 1 && a <= 31 && b >= 1 && b <= 12 && c >= 2020 && c <= 2030) {
      // DDMMYYYY style: 01032022
      result.signedDate = `${c}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }
  }

  // 2. Detect program type
  if (/KNDD/i.test(rest)) result.programType = "KNDD";
  else if (/TTSKN|TTKN/i.test(rest)) result.programType = "TTSKN";

  // 3. Extract employer — strip common keywords
  const employer = rest
    .replace(/HĐCƯ|HĐCU|HDCU|HĐ\s+Đặc định/gi, "")
    .replace(/TTSKN|TTKN|TPC|KNDD|LDKNDD/gi, "")
    .replace(/SCAN/gi, "")
    .replace(/\bTLG\b/gi, "")
    .replace(/\(CKS\)|\(Cks\)|\(cks\)/gi, "")
    .replace(/\(kèm[^)]*\)/gi, "")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  result.employer = employer || "Unknown";

  return result;
}

interface UploadedMedia {
  id: string;
  url?: string;
}

async function processFile(
  filePath: string,
  stats: ImportStats,
): Promise<void> {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = MIME_MAP[ext] ?? "application/octet-stream";

  try {
    const buffer = await fs.readFile(filePath);
    const sizeKb = (buffer.length / 1024).toFixed(1);
    logger.info("Import", `▶ ${filename} (${sizeKb}KB)`);

    const meta = parseHdcuFilename(filename);
    logger.info(
      "Import",
      `  📋 parsed: date=${meta.signedDate ?? "?"}, employer="${meta.employer}", program=${meta.programType}`,
    );

    // 1. Find Media by filename — reuse nếu đã có, upload mới nếu chưa
    let mediaId: string;
    let mediaWasNew = false;
    const existing = await payload.request<{ docs: Array<{ id: string }> }>(
      `/api/media`,
      {
        query: {
          where: { filename: { equals: filename } },
          limit: 1,
          depth: 0,
        },
      },
    );
    if (existing.docs.length > 0) {
      mediaId = existing.docs[0].id;
      logger.info("Import", `  ↻ media đã tồn tại (#${mediaId}) — reuse`);
    } else {
      const media = (await payload.uploadMedia({
        buffer,
        filename,
        mimeType,
        alt: meta.employer
          ? `HĐCU TLG - ${meta.employer}${meta.signedDate ? " - " + meta.signedDate : ""}`
          : filename,
      })) as UploadedMedia;
      mediaId = media.id;
      mediaWasNew = true;
      stats.mediaCreated += 1;
      logger.info("Import", `  ↑ uploaded → media#${mediaId}`);
    }

    // 3. Extract text — MarkItDown (chỉ chạy khi media mới)
    let extractedText = "";
    let extractionMethod = "markitdown";
    let visionDescription: string | null = null;
    let visionKind: string | null = null;

    if (mediaWasNew) {
      try {
        extractedText = await convertToMarkdown(buffer, filename);
        logger.info("Import", `  📄 MarkItDown → ${extractedText.length} chars`);
      } catch (err) {
        const reason = err instanceof MarkItDownError ? err.message : String(err);
        logger.warn("Import", `  ⚠️ MarkItDown failed: ${reason}`);
      }
    } else {
      logger.info("Import", `  ⊘ skip extract (media reused)`);
    }

    // 4. PDF scan fallback — vision OCR (chỉ khi media mới + có text < 50)
    if (mediaWasNew && extractedText.trim().length < 50 && mimeType === "application/pdf") {
      try {
        logger.info("Import", `  👁 PDF scan — falling back to vision OCR (5 pages)...`);
        const pages = await pdfToImages(buffer, { maxPages: 5, dpi: 150 });
        const pgs = pages.map((p) => ({
          page: p.page,
          buffer: p.buffer,
          mediaType: "image/png" as const,
        }));
        const d = await describeScannedPdf(filename, pgs);
        extractedText = d.fullText;
        visionDescription = d.description;
        visionKind = d.kind;
        extractionMethod = `vision-OCR (${pages.length} pages)`;
        logger.info(
          "Import",
          `  ✓ vision OCR → ${extractedText.length} chars text + description`,
        );
      } catch (err) {
        const reason = err instanceof PdfToImagesError ? err.message : String(err);
        logger.warn("Import", `  ⚠️ vision OCR failed: ${reason}`);
      }
    }

    // 5. PATCH metadata cho Media (chỉ khi mới upload — tránh đè description
    //    đã có nếu chạy lại)
    if (mediaWasNew) {
      const shortText = extractedText.replace(/\s+/g, " ").trim().slice(0, 300);
      const mediaDescription =
        visionDescription ??
        [
          `HĐCU TLG - ${meta.employer}`,
          meta.signedDate ? `Ký ngày ${meta.signedDate}` : null,
          `Chương trình ${meta.programType}`,
          shortText
            ? `Trích nội dung: ${shortText}${extractedText.length > 300 ? "..." : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(". ");

      await payload.request(`/api/media/${encodeURIComponent(mediaId)}`, {
        method: "PATCH",
        body: {
          uploadedFrom: "api",
          kind: visionKind ?? "contract",
          description: mediaDescription,
          extractedText: extractedText.slice(0, 50_000),
        },
      });
      logger.info(
        "Import",
        `  ✓ patched media#${mediaId} (kind=${visionKind ?? "contract"}, ${extractionMethod})`,
      );
    }

    // 6. Tạo Order draft + link media qua orderDocuments
    //    Bot không xoá Order có status='paused' của bulk import → safe để rerun.
    const contractNumber = meta.baseName.slice(0, 80); // unique-ish identifier
    const existingOrder = await payload.request<{ docs: Array<{ id: string; orderCode?: string }> }>(
      `/api/orders`,
      {
        query: {
          where: { contractNumber: { equals: contractNumber } },
          limit: 1,
          depth: 0,
        },
      },
    );

    if (existingOrder.docs.length > 0) {
      logger.info(
        "Import",
        `  ⊘ order đã tồn tại (#${existingOrder.docs[0].orderCode ?? existingOrder.docs[0].id}) — không tạo mới`,
      );
    } else {
      try {
        // deadline là field required. Đặt = signedDate + 1 năm (placeholder
        // hợp lệ cho draft); admin sẽ edit lại khi activate đơn.
        const fallbackDeadline = meta.signedDate
          ? new Date(new Date(meta.signedDate).getTime() + 365 * 86400_000)
              .toISOString()
              .slice(0, 10)
          : new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);

        const orderBody: Record<string, unknown> = {
          market: "jp",
          employer: meta.employer,
          employerCountry: "Japan",
          position: `[Draft] ${meta.programType} — chưa xác định vị trí`,
          quantityNeeded: 1,
          contractNumber,
          contractDate: meta.signedDate,
          deadline: fallbackDeadline,
          status: "paused", // draft state — admin sẽ activate sau khi điền đủ
          notes:
            `Bulk imported từ file scan HĐCU.\n` +
            `Filename gốc: ${filename}\n` +
            `Program: ${meta.programType}${meta.signedDate ? "\nNgày ký HĐCU: " + meta.signedDate : ""}\n` +
            `Admin cần edit để bổ sung: position, quantityNeeded, lương, deadline...`,
          orderDocuments: [
            {
              kind: "HĐCU scan",
              file: mediaId,
              notes: `Scan bản gốc HĐCU - ${meta.employer}`,
            },
          ],
        };
        const createdOrder = await payload.request<{ doc: { id: string; orderCode?: string } }>(
          `/api/orders`,
          { method: "POST", body: orderBody },
        );
        stats.ordersCreated += 1;
        logger.info(
          "Import",
          `  ✓ order#${createdOrder.doc.orderCode ?? createdOrder.doc.id} created + linked media`,
        );
      } catch (err) {
        const reason = err instanceof PayloadError ? err.message : String(err);
        logger.warn(
          "Import",
          `  ⚠️ tạo Order thất bại: ${reason} — Media đã lưu nhưng chưa link`,
        );
      }
    }
  } catch (err) {
    const msg =
      err instanceof PayloadError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    logger.error("Import", `  ✗ ${filename} failed: ${msg}`);
    stats.failed += 1;
    stats.failedFiles.push(filename);
  }
}

async function main(): Promise<void> {
  const folder = process.argv[2];
  if (!folder) {
    console.error("Usage: bulk-import <folder-path>");
    process.exit(1);
  }

  loadConfig();
  logger.info("Import", `▶▶▶ Bulk import folder: ${folder}`);

  const startTs = Date.now();
  const files = await walkFolder(folder);
  logger.info("Import", `Found ${files.length} supported files`);

  const stats: ImportStats = {
    total: files.length,
    mediaCreated: 0,
    ordersCreated: 0,
    skipped: 0,
    failed: 0,
    failedFiles: [],
  };

  for (let i = 0; i < files.length; i++) {
    logger.info("Import", `\n[${i + 1}/${files.length}]`);
    await processFile(files[i], stats);
  }

  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
  logger.info("Import", `\n╔═══════════════════════════════════════════════╗`);
  logger.info("Import", `║ DONE in ${elapsed}s`);
  logger.info("Import", `║   total files:     ${stats.total}`);
  logger.info("Import", `║   media created:   ${stats.mediaCreated}`);
  logger.info("Import", `║   orders created:  ${stats.ordersCreated}`);
  logger.info("Import", `║   skipped:         ${stats.skipped} (đã tồn tại)`);
  logger.info("Import", `║   failed:          ${stats.failed}`);
  logger.info("Import", `╚═══════════════════════════════════════════════╝`);
  if (stats.failed > 0) {
    logger.warn("Import", `Failed files:\n  - ${stats.failedFiles.join("\n  - ")}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
