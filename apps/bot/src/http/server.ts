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
import { convertToMarkdown } from "../extraction/markitdown.js";
import { extractInvoice } from "../extraction/invoice.js";
import { extractBrief } from "../extraction/brief.js";
import { compareDocuments } from "../extraction/compare.js";
import { verifyConfirmationImage } from "../extraction/verify-image.js";
import type { InvoiceExtract, BriefExtract } from "../extraction/types.js";

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
