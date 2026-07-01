/**
 * HTTP server cho bot — Payload hooks gọi vào để trigger extract/verify.
 *
 * Endpoints (cần header `X-Internal-Secret` khớp env):
 *   POST /api/extract-invoice  { mediaUrl, mediaName }  → InvoiceExtract
 *   POST /api/extract-brief    { mediaUrl, mediaName }  → BriefExtract
 *   POST /api/compare          { invoice, brief }       → DocumentMatchResult
 *   POST /api/verify-image     { mediaUrl, mediaType }  → ImageVerifyResult
 *
 * Chỉ Payload (cùng máy) được gọi qua secret. Không expose ra internet.
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { z } from "zod";

import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { convertToMarkdown, MarkItDownError } from "../extraction/markitdown.js";
import { describeDocument, describeImage, describeScannedPdf } from "../extraction/describe.js";
import { pdfToImages, PdfToImagesError } from "../extraction/pdf-to-images.js";
import { extractInvoice } from "../extraction/invoice.js";
import { extractBrief } from "../extraction/brief.js";
import { compareDocuments } from "../extraction/compare.js";
import { verifyConfirmationImage } from "../extraction/verify-image.js";
import type { InvoiceExtract, BriefExtract } from "../extraction/types.js";
import { payload, PayloadError } from "../payload/client.js";

export interface HttpServerHandle {
  stop: () => Promise<void>;
}

async function downloadFile(url: string): Promise<{ buffer: Buffer; mediaType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Tải file thất bại: ${res.status}`);
  const arr = await res.arrayBuffer();
  const mt = res.headers.get("content-type") ?? "application/octet-stream";
  return { buffer: Buffer.from(arr), mediaType: mt };
}

export function startHttpServer(): HttpServerHandle {
  const cfg = getConfig();
  const app = new Hono();

  // ── Auth middleware ─────────────────────────────────────────
  app.use("/api/*", async (c, next) => {
    const secret = c.req.header("x-internal-secret");
    if (secret !== cfg.INTERNAL_SECRET) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return next();
  });

  // ── Health ──────────────────────────────────────────────────
  app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

  // ── Extract invoice ─────────────────────────────────────────
  const invoiceSchema = z.object({
    mediaUrl: z.string().url(),
    mediaName: z.string().default("invoice.pdf"),
  });
  app.post("/api/extract-invoice", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = invoiceSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "bad-request", details: parsed.error.issues }, 400);
    try {
      const { buffer } = await downloadFile(parsed.data.mediaUrl);
      const md = await convertToMarkdown(buffer, parsed.data.mediaName);
      const data = await extractInvoice(md);
      return c.json({ ok: true, data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Extract", `invoice failed: ${msg}`);
      return c.json({ error: "extract-failed", message: msg }, 500);
    }
  });

  // ── Extract brief ───────────────────────────────────────────
  app.post("/api/extract-brief", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = invoiceSchema.safeParse(body);  // same shape
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    try {
      const { buffer } = await downloadFile(parsed.data.mediaUrl);
      const md = await convertToMarkdown(buffer, parsed.data.mediaName);
      const data = await extractBrief(md);
      return c.json({ ok: true, data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Extract", `brief failed: ${msg}`);
      return c.json({ error: "extract-failed", message: msg }, 500);
    }
  });

  // ── Compare invoice vs brief ────────────────────────────────
  const compareSchema = z.object({
    invoice: z.unknown(),
    brief: z.unknown(),
  });
  app.post("/api/compare", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = compareSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    try {
      const result = compareDocuments(
        parsed.data.invoice as InvoiceExtract,
        parsed.data.brief as BriefExtract,
      );
      return c.json({ ok: true, data: result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ error: "compare-failed", message: msg }, 500);
    }
  });

  // ── Verify image ────────────────────────────────────────────
  const verifySchema = z.object({
    mediaUrl: z.string().url(),
    mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]).optional(),
  });
  app.post("/api/verify-image", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "bad-request" }, 400);
    try {
      const { buffer, mediaType } = await downloadFile(parsed.data.mediaUrl);
      const mt = parsed.data.mediaType ?? (
        mediaType.startsWith("image/")
          ? (mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
          : "image/jpeg"
      );
      const result = await verifyConfirmationImage(buffer, mt);
      return c.json({ ok: true, data: result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Verify", `image failed: ${msg}`);
      return c.json({ error: "verify-failed", message: msg }, 500);
    }
  });

  // ── Auto-describe media (admin upload trigger) ────────────────
  // Payload Media afterChange hook gọi vào đây khi:
  //  - File mới upload qua admin web (uploadedFrom='admin') chưa có description
  //  - Hoặc admin gọi tay redescribe
  // Bot: download bytes → MarkItDown (hoặc OCR nếu PDF scan) → AI describe →
  // PATCH lại media doc với kind + description + extractedText. Chạy async,
  // hook chỉ kick off rồi return ngay — admin không phải đợi.
  const describeMediaSchema = z.object({
    mediaId: z.string().min(1),
    /** Force = bỏ qua điều kiện "đã có description" → describe lại từ đầu. */
    force: z.boolean().optional().default(false),
    /** mode:
     *   - "lite" (default): chỉ extract text (MarkItDown / OCR), KHÔNG gọi
     *     AI describe. Nhanh ~3s/file. Dùng cho bulk upload. Description
     *     auto-set từ filename + 200 chars đầu extracted text.
     *   - "full": extract text + AI describe (kind + 4-8 câu mô tả). Chậm
     *     ~30s/file. Dùng cho từng file riêng lẻ hoặc retrigger từ AI. */
    mode: z.enum(["lite", "full"]).optional().default("lite"),
  });

  interface MediaDoc {
    id: string;
    filename?: string;
    mimeType?: string;
    url?: string;
    description?: string;
    extractedText?: string;
    uploadedFrom?: string;
  }

  app.post("/api/describe-media", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = describeMediaSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "bad-request", details: parsed.error.issues }, 400);
    }

    // Trả 202 ngay — chạy describe trong background. Admin upload nhiều file
    // không bị block.
    const { mediaId, force, mode } = parsed.data;
    void runAutoDescribe(mediaId, force, mode).catch((err) =>
      logger.error("AutoDescribe", `media#${mediaId} failed: ${err}`),
    );
    return c.json({ ok: true, queued: true, mediaId, mode }, 202);
  });

  /** Run describe asynchronously — không block HTTP response. */
  async function runAutoDescribe(
    mediaId: string,
    force: boolean,
    mode: "lite" | "full" = "lite",
  ): Promise<void> {
    const start = Date.now();
    try {
      const media = await payload.request<MediaDoc>(
        `/api/media/${encodeURIComponent(mediaId)}`,
      );
      if (!media.filename || !media.url) {
        logger.warn("AutoDescribe", `media#${mediaId} missing filename/url — skip`);
        return;
      }

      // Skip nếu đã có description (trừ khi force)
      if (!force && media.description && media.description.length > 50) {
        logger.debug(
          "AutoDescribe",
          `media#${mediaId} already has description (${media.description.length} chars) — skip`,
        );
        return;
      }

      logger.info(
        "AutoDescribe",
        `▶ media#${mediaId} ${media.filename} (${media.mimeType ?? "?"})`,
      );

      // Download file qua Payload proxy URL
      const fileUrl = media.url.startsWith("http")
        ? media.url
        : `${getConfig().PAYLOAD_URL}${media.url}`;
      const { buffer } = await downloadFile(fileUrl);

      const mime = media.mimeType ?? "application/octet-stream";

      // Image → vision direct
      if (mime.startsWith("image/")) {
        const claudeMime =
          mime === "image/jpeg" || mime === "image/png" ||
          mime === "image/gif" || mime === "image/webp"
            ? (mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
            : "image/jpeg";
        const d = await describeImage(media.filename, buffer, claudeMime);
        await payload.request(`/api/media/${encodeURIComponent(mediaId)}`, {
          method: "PATCH",
          body: { kind: d.kind, description: d.description },
        });
        logger.info(
          "AutoDescribe",
          `✓ media#${mediaId} image done in ${Date.now() - start}ms`,
        );
        return;
      }

      // Document — try MarkItDown
      let markdown = "";
      try {
        markdown = await convertToMarkdown(buffer, media.filename);
      } catch (err) {
        const reason = err instanceof MarkItDownError ? err.message : String(err);
        logger.warn("AutoDescribe", `MarkItDown ${media.filename}: ${reason}`);
      }

      // PDF scan fallback (MarkItDown empty)
      if (markdown.trim().length < 50 && mime === "application/pdf") {
        try {
          const pages = await pdfToImages(buffer, { maxPages: 5, dpi: 150 });
          const pgs = pages.map((p) => ({
            page: p.page,
            buffer: p.buffer,
            mediaType: "image/png" as const,
          }));
          const d = await describeScannedPdf(media.filename, pgs);
          await payload.request(`/api/media/${encodeURIComponent(mediaId)}`, {
            method: "PATCH",
            body: {
              kind: d.kind,
              description: d.description,
              extractedText: d.fullText.slice(0, 50_000),
            },
          });
          logger.info(
            "AutoDescribe",
            `✓ media#${mediaId} PDF-scan OCR'd (${pages.length} pages) in ${Date.now() - start}ms`,
          );
          return;
        } catch (err) {
          const reason = err instanceof PdfToImagesError ? err.message : String(err);
          logger.warn("AutoDescribe", `pdf-to-images failed: ${reason}`);
        }
      }

      // Text document — describe từ markdown
      if (markdown.trim().length > 50) {
        const d = await describeDocument(media.filename, markdown);
        await payload.request(`/api/media/${encodeURIComponent(mediaId)}`, {
          method: "PATCH",
          body: {
            kind: d.kind,
            description: d.description,
            extractedText: markdown.slice(0, 50_000),
          },
        });
        logger.info(
          "AutoDescribe",
          `✓ media#${mediaId} text doc done in ${Date.now() - start}ms`,
        );
        return;
      }

      // Không có nội dung — chỉ set description placeholder
      await payload.request(`/api/media/${encodeURIComponent(mediaId)}`, {
        method: "PATCH",
        body: {
          kind: "other",
          description: `${media.filename} — không trích được text/ảnh OCR. Có thể là PDF scan hoặc file binary.`,
        },
      });
      logger.warn(
        "AutoDescribe",
        `! media#${mediaId} no extractable content — placeholder description set`,
      );
    } catch (err) {
      const msg =
        err instanceof PayloadError ? err.message : err instanceof Error ? err.message : String(err);
      logger.error("AutoDescribe", `media#${mediaId} failed: ${msg}`);
    }
  }

  // ── Form Submission notify ──────────────────────────────────
  // Auth qua /internal/ prefix dùng cùng secret.
  app.use("/internal/*", async (c, next) => {
    const secret = c.req.header("x-internal-secret");
    if (secret !== cfg.INTERNAL_SECRET) {
      return c.json({ error: "unauthorized" }, 401);
    }
    return next();
  });

  const formSubmittedSchema = z.object({
    inviteId: z.string(),
    formId: z.string(),
    submissionId: z.string(),
    workerId: z.string().optional(),
    workerName: z.string().optional(),
    fullName: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  });

  app.post("/internal/form-submitted", async (c) => {
    try {
      const body = formSubmittedSchema.parse(await c.req.json());
      const { handleFormSubmitted } = await import("../telegram/form-notify.js");
      await handleFormSubmitted(body);
      return c.json({ ok: true });
    } catch (e) {
      logger.warn("HTTP", `form-submitted: ${e instanceof Error ? e.message : e}`);
      return c.json({ error: "failed" }, 500);
    }
  });

  const workerStatusSchema = z.object({
    workerId: z.string(),
    workerCode: z.string().optional(),
    fullName: z.string().optional(),
    market: z.string().optional(),
    previousStatus: z.string(),
    newStatus: z.string(),
  });

  app.post("/internal/worker-status-changed", async (c) => {
    try {
      const body = workerStatusSchema.parse(await c.req.json());
      const { handleWorkerStatusChanged } = await import("../telegram/worker-handoff.js");
      await handleWorkerStatusChanged(body);
      return c.json({ ok: true });
    } catch (e) {
      logger.warn("HTTP", `worker-status-changed: ${e instanceof Error ? e.message : e}`);
      return c.json({ error: "failed" }, 500);
    }
  });

  const coeReceivedSchema = z.object({
    contractId: z.string(),
    contractCode: z.string().optional(),
    workerId: z.string(),
    orderId: z.string().optional(),
    coeReceivedAt: z.string(),
  });

  app.post("/internal/coe-received", async (c) => {
    try {
      const body = coeReceivedSchema.parse(await c.req.json());
      const { handleCoeReceived } = await import("../telegram/coe-handoff.js");
      await handleCoeReceived(body);
      return c.json({ ok: true });
    } catch (e) {
      logger.warn("HTTP", `coe-received: ${e instanceof Error ? e.message : e}`);
      return c.json({ error: "failed" }, 500);
    }
  });

  app.notFound((c) => c.json({ error: "not-found" }, 404));
  app.onError((err, c) => {
    logger.error("HTTP", `Unhandled: ${err.message}`, err);
    return c.json({ error: "internal" }, 500);
  });

  const server = serve({ fetch: app.fetch, port: cfg.BOT_HTTP_PORT }, ({ port }) => {
    logger.info("HTTP", `Bot internal API listening on http://localhost:${port}`);
  });

  return {
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
