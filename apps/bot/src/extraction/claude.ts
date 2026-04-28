/**
 * One-shot Claude extraction qua `@anthropic-ai/claude-agent-sdk` —
 * KHÔNG cần API key, dùng OAuth token từ Claude Max subscription.
 *
 * Hai pattern:
 *   - extractFromText(prompt, doc) → JSON  (cho hóa đơn / đề bài đã MarkItDown)
 *   - extractFromImage(prompt, image)  → JSON  (cho ảnh xác nhận khách)
 *
 * Cả hai đều dùng `query()` với maxTurns=1, không tools, parse text reply
 * thành JSON.
 */
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

const SYSTEM_JSON_ONLY =
  "Bạn là agent trích xuất thông tin có cấu trúc. Trả lời CHỈ bằng JSON hợp lệ — không markdown ```, không text giải thích.";

function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function runQuery(
  prompt: string | AsyncIterable<SDKUserMessage>,
  tag: string,
): Promise<string> {
  const cfg = getConfig();
  const start = Date.now();
  const q = query({
    prompt,
    options: {
      systemPrompt: SYSTEM_JSON_ONLY,
      tools: [],
      mcpServers: {},
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 1,
      model: cfg.CLAUDE_MODEL,
      persistSession: false,
      ...(cfg.CLAUDE_BIN ? { pathToClaudeCodeExecutable: cfg.CLAUDE_BIN } : {}),
    },
  });

  let resultText = "";
  for await (const msg of q) {
    if (msg.type === "result") {
      if (msg.subtype === "success") {
        resultText = msg.result;
      } else {
        throw new Error(`Claude extract '${tag}' kết thúc lỗi: ${msg.subtype}`);
      }
      break;
    }
  }

  logger.debug("Extract", `${tag} done in ${Date.now() - start}ms (${resultText.length} chars)`);
  if (!resultText) throw new Error(`Claude extract '${tag}' không có output`);
  return resultText;
}

/** One-shot text extract: prompt là instruction, doc là markdown text. */
export async function extractFromText<T = unknown>(opts: {
  instruction: string;
  documentText: string;
  tag?: string;
}): Promise<T> {
  const fullPrompt = `${opts.instruction}\n\n--- TÀI LIỆU ---\n${opts.documentText}\n--- HẾT ---`;
  const raw = await runQuery(fullPrompt, opts.tag ?? "extract-text");
  const json = stripJsonFences(raw);
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error(`Claude trả JSON không hợp lệ: ${json.slice(0, 200)}`);
  }
}

/**
 * One-shot vision: gửi ảnh + instruction, nhận JSON.
 * Dùng AsyncIterable<SDKUserMessage> để claude-agent-sdk forward
 * nguyên `content` (image + text block) lên API.
 */
export async function extractFromImage<T = unknown>(opts: {
  imageBuffer: Buffer | ArrayBuffer;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  instruction: string;
  tag?: string;
}): Promise<T> {
  const buf = opts.imageBuffer instanceof Buffer
    ? opts.imageBuffer
    : Buffer.from(new Uint8Array(opts.imageBuffer));
  const base64 = buf.toString("base64");
  const tag = opts.tag ?? "extract-image";

  async function* messages(): AsyncIterable<SDKUserMessage> {
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: opts.mediaType, data: base64 },
          },
          { type: "text", text: opts.instruction },
        ],
      },
    };
  }

  const raw = await runQuery(messages(), tag);
  const json = stripJsonFences(raw);
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error(`Claude vision trả JSON không hợp lệ: ${json.slice(0, 200)}`);
  }
}
