/**
 * Qdrant client + collection setup.
 *
 * Qdrant chạy Docker container trên cùng server. Bot connect qua port 6333.
 *
 * Collections (đặt tên = Payload collection slug):
 *   - media, supply-contracts, partners, orders, workers
 *
 * Mỗi point có:
 *   - id: UUID (auto-gen từ docId+collection để dễ upsert)
 *   - vector: 384-dim float
 *   - payload: { docId, collection, title, snippet, market?, ... }
 *
 * Search: trả về docId + snippet → caller có thể get full record nếu cần.
 */
import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from "node:crypto";

import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { VECTOR_DIM } from "./embedding.js";

let _client: QdrantClient | null = null;

export function qdrant(): QdrantClient {
  if (!_client) {
    const cfg = getConfig();
    _client = new QdrantClient({ url: cfg.QDRANT_URL ?? "http://localhost:6333" });
  }
  return _client;
}

/** Deterministic UUID từ collection + docId — re-upsert không tạo trùng. */
export function pointIdOf(collection: string, docId: string): string {
  const h = crypto.createHash("sha256").update(`${collection}:${docId}`).digest("hex");
  // UUID v4-ish format
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "4" + h.slice(13, 16),
    "8" + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
}

export interface VectorPayload {
  /** Payload doc ID (Mongo ObjectId) */
  docId: string;
  /** Payload collection slug */
  collection: string;
  /** Title hiển thị cho user trong search result (vd Order.orderCode, Partner.name) */
  title: string;
  /** Snippet ngắn — đoạn text dùng làm preview kết quả */
  snippet: string;
  /** Filter optional — market, status, country, kind... tuỳ collection */
  [key: string]: unknown;
}

/**
 * Tạo collection nếu chưa có. Idempotent.
 *
 * `payload_schema` config index cho field thường lọc (giúp filter nhanh).
 */
export async function ensureCollection(name: string): Promise<void> {
  const c = qdrant();
  try {
    await c.getCollection(name);
  } catch {
    logger.info("Qdrant", `Creating collection: ${name}`);
    await c.createCollection(name, {
      vectors: { size: VECTOR_DIM, distance: "Cosine" },
    });
    // Index field hay filter — tăng tốc query filter
    for (const field of ["collection", "market", "country", "kind", "status"]) {
      try {
        await c.createPayloadIndex(name, { field_name: field, field_schema: "keyword" });
      } catch (e) {
        // Field có thể không tồn tại, không quan trọng
        void e;
      }
    }
  }
}

/** Upsert 1 point. */
export async function upsertPoint(
  collection: string,
  vector: number[],
  payload: VectorPayload,
): Promise<void> {
  const id = pointIdOf(collection, payload.docId);
  await qdrant().upsert(collection, {
    wait: true,
    points: [{ id, vector, payload: payload as Record<string, unknown> }],
  });
}

/** Upsert batch — nhanh hơn nhiều khi index lớn. */
export async function upsertBatch(
  collection: string,
  points: Array<{ vector: number[]; payload: VectorPayload }>,
): Promise<void> {
  if (points.length === 0) return;
  await qdrant().upsert(collection, {
    wait: true,
    points: points.map((p) => ({
      id: pointIdOf(collection, p.payload.docId),
      vector: p.vector,
      payload: p.payload as Record<string, unknown>,
    })),
  });
}

export interface SearchResult {
  docId: string;
  collection: string;
  title: string;
  snippet: string;
  score: number;
  payload: Record<string, unknown>;
}

/**
 * Search vector trong 1 collection. Trả top K kết quả.
 *
 * `filter` — Qdrant filter syntax, vd `{ must: [{ key: "market", match: { value: "jp" } }] }`
 */
export async function search(
  collection: string,
  queryVector: number[],
  topK = 10,
  filter?: Record<string, unknown>,
): Promise<SearchResult[]> {
  const c = qdrant();
  const res = await c.search(collection, {
    vector: queryVector,
    limit: topK,
    filter,
    with_payload: true,
  });
  return res.map((r) => {
    const p = (r.payload ?? {}) as VectorPayload;
    return {
      docId: p.docId,
      collection: p.collection ?? collection,
      title: p.title ?? "(no title)",
      snippet: p.snippet ?? "",
      score: r.score,
      payload: p as Record<string, unknown>,
    };
  });
}

/** Xoá 1 point khi entity bị delete. */
export async function deletePoint(collection: string, docId: string): Promise<void> {
  await qdrant().delete(collection, {
    wait: true,
    points: [pointIdOf(collection, docId)],
  });
}
