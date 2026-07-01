/**
 * Embedding service — wraps @xenova/transformers (ONNX runtime trong Node).
 *
 * Model: intfloat/multilingual-e5-small (384-dim, ~120MB)
 *  - Multilingual (Việt/Nhật/Anh)
 *  - Vector dim 384 → query nhanh, index nhỏ
 *  - Free, không cần API key
 *
 * Load 1 lần lúc bot khởi động (lazy singleton). Lần đầu mất ~10s download
 * model + warm-up. Sau đó embed/text ~50-100ms.
 *
 * E5 convention: prefix "passage: " khi index, "query: " khi search.
 */
import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

import { logger } from "../utils/logger.js";

// Cache models ở /tmp để không re-download mỗi lần restart bot
env.cacheDir = "/tmp/xenova-cache";

const MODEL_NAME = "Xenova/multilingual-e5-small";
export const VECTOR_DIM = 384;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    logger.info("Embed", `Loading model ${MODEL_NAME}...`);
    const start = Date.now();
    pipelinePromise = pipeline("feature-extraction", MODEL_NAME, {
      quantized: true, // INT8 quantized — nhỏ hơn + nhanh hơn
    }).then((p) => {
      logger.info("Embed", `Model loaded in ${Date.now() - start}ms`);
      return p as FeatureExtractionPipeline;
    });
  }
  return pipelinePromise;
}

/** Embed 1 đoạn text → vector 384-dim. Dùng `passage:` cho doc, `query:` cho query. */
export async function embed(text: string, kind: "passage" | "query" = "passage"): Promise<number[]> {
  const pipe = await getPipeline();
  const input = `${kind}: ${text.replace(/\s+/g, " ").trim().slice(0, 2000)}`;
  const out = await pipe(input, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

/** Batch embed nhiều text — nhanh hơn embed 1-by-1. */
export async function embedBatch(
  texts: string[],
  kind: "passage" | "query" = "passage",
): Promise<number[][]> {
  const pipe = await getPipeline();
  const inputs = texts.map((t) => `${kind}: ${t.replace(/\s+/g, " ").trim().slice(0, 2000)}`);
  const out = await pipe(inputs, { pooling: "mean", normalize: true });
  const dim = VECTOR_DIM;
  const data = out.data as Float32Array;
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
  }
  return vectors;
}

/** Eager-load model ngay khi bot khởi động (tránh delay request đầu). */
export async function preloadEmbedModel(): Promise<void> {
  await getPipeline();
}
