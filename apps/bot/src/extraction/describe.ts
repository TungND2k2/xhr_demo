/**
 * Sinh `description` cho file/ảnh — AI tự tóm tắt nội dung khi user upload.
 * Lưu vào Media.description để sau này AI tra cứu được dễ dàng.
 *
 * Mục tiêu output: 4-8 câu tiếng Việt, dày đặc thông tin (tên người,
 * ngày, số HĐ, loại giấy tờ, mã đơn, đối tác, các con số...). Càng
 * nhiều entity càng tốt — tra full-text search Mongo sẽ match dễ.
 *
 * Đồng thời trả về `kind` (1 trong các loại đã định trong Media collection)
 * để admin lọc nhanh.
 */
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export type MediaKind =
  | "id_doc"
  | "health_cert"
  | "contract"
  | "visa_doc"
  | "flight"
  | "cv"
  | "portrait"
  | "invoice"
  | "form"
  | "partner_doc"
  | "other";

export interface FileDescription {
  kind: MediaKind;
  description: string;
}

const SYSTEM_DESCRIBE = `Bạn là agent phân loại + tóm tắt tài liệu HR/XKLĐ.
Nhiệm vụ: nhìn vào nội dung document hoặc ảnh, trả về JSON đúng schema:

{
  "kind": "id_doc" | "health_cert" | "contract" | "visa_doc" | "flight" | "cv" | "portrait" | "invoice" | "form" | "partner_doc" | "other",
  "description": string  // 4-8 câu tiếng Việt, dày đặc thông tin
}

Quy tắc cho "description":
- Liệt kê CÁC THÔNG TIN CỤ THỂ tìm được: tên người, ngày sinh, CCCD/hộ chiếu,
  số HĐ, ngày ký, lương, đối tác, mã đơn, ngày khám SK, kết quả, visa loại gì,
  số chuyến bay, ...
- KHÔNG viết kiểu chung chung "đây là 1 tài liệu...". Phải có entity cụ thể.
- Nếu là ảnh chân dung: tả người (nam/nữ, tóc, áo, background) + bất kỳ chữ
  nào nhìn thấy được (badge, biển tên).
- Nếu không đọc rõ: ghi rõ "không đọc được" / "ảnh mờ" + những gì còn nhìn được.
- Không bịa.

CHỈ trả JSON — không markdown, không giải thích thêm.`;

function stripJsonFences(raw: string): string {
  return raw.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
}

/**
 * Tìm JSON object trong text. Claude đôi khi trả natural language wrap quanh
 * JSON — ta tìm `{...}` cân đối braces. Trả null nếu không có.
 */
function findFirstJsonBlock(raw: string): string | null {
  const stripped = stripJsonFences(raw);
  if (stripped.startsWith("{")) return stripped;
  // Find first '{' then walk to balanced '}'
  const start = stripped.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < stripped.length; i += 1) {
    const c = stripped[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
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
      systemPrompt: SYSTEM_DESCRIBE,
      tools: [],
      mcpServers: {},
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 5,
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
        throw new Error(`Describe '${tag}' kết thúc lỗi: ${msg.subtype}`);
      }
      break;
    }
  }
  logger.debug("Describe", `${tag} done in ${Date.now() - start}ms (${resultText.length} chars)`);
  if (!resultText) throw new Error(`Describe '${tag}' không có output`);
  return resultText;
}

const FALLBACK: FileDescription = {
  kind: "other",
  description: "Không tóm tắt được nội dung — bot lỗi khi gọi LLM.",
};

function parse(raw: string, tag: string): FileDescription {
  // Log raw output (cap 800 chars) để debug khi parse fail.
  logger.debug("Describe", `${tag} raw output: ${raw.slice(0, 800)}`);
  const block = findFirstJsonBlock(raw);
  if (!block) {
    logger.warn(
      "Describe",
      `${tag} no JSON block found in output (first 200 chars): ${raw.slice(0, 200)}`,
    );
    // Fallback: dùng raw text làm description (tốt hơn fallback "lỗi LLM")
    const cleaned = raw.trim().slice(0, 800);
    if (cleaned.length > 30) {
      return { kind: "other", description: cleaned };
    }
    return FALLBACK;
  }
  try {
    const obj = JSON.parse(block) as Partial<FileDescription>;
    const kind = (obj.kind ?? "other") as MediaKind;
    const description = (obj.description ?? "").trim();
    if (!description) {
      logger.warn("Describe", `${tag} parsed JSON but description empty: ${block.slice(0, 200)}`);
      return FALLBACK;
    }
    return { kind, description };
  } catch (err) {
    logger.warn("Describe", `${tag} JSON parse error: ${err}; block: ${block.slice(0, 200)}`);
    return FALLBACK;
  }
}

/**
 * Tóm tắt 1 document (PDF/DOCX/...) đã được MarkItDown convert sang markdown.
 * Cap markdown ở 12000 ký tự để tiết kiệm token (nếu file dài thật, đoạn
 * đầu thường đã đủ context để phân loại + lấy entity chính).
 */
export async function describeDocument(
  fileName: string,
  markdown: string,
): Promise<FileDescription> {
  const truncated = markdown.length > 12_000
    ? markdown.slice(0, 12_000) + `\n\n[...cắt bớt; tổng ${markdown.length} ký tự]`
    : markdown;

  const prompt = `Tên file: ${fileName}

Nội dung:
---
${truncated}
---`;
  try {
    const raw = await runQuery(prompt, `doc:${fileName}`);
    return parse(raw, `doc:${fileName}`);
  } catch (err) {
    logger.warn("Describe", `doc ${fileName} failed: ${err}`);
    return FALLBACK;
  }
}

/**
 * OCR + tóm tắt 1 PDF scan đã convert thành nhiều page PNGs.
 * Khác `describeImage` (1 ảnh): gửi tất cả pages 1 lượt, prompt yêu cầu
 * trả thêm `fullText` để bot save vào `extractedText`. Sau này AI có thể
 * `get_media_content`/`redescribe_media` mà không cần re-OCR.
 *
 * Output: { kind, description, fullText } — fullText là toàn bộ text từng
 * trang format "## Trang 1\n...\n## Trang 2\n..."
 */
export async function describeScannedPdf(
  fileName: string,
  pages: Array<{
    page: number;
    buffer: Buffer | ArrayBuffer;
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  }>,
): Promise<FileDescription & { fullText: string }> {
  if (pages.length === 0) {
    return { ...FALLBACK, fullText: "" };
  }

  async function* messages(): AsyncIterable<SDKUserMessage> {
    const content: Array<
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
      | { type: "text"; text: string }
    > = pages.map((p) => {
      const buf = p.buffer instanceof Buffer ? p.buffer : Buffer.from(new Uint8Array(p.buffer));
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: p.mediaType,
          data: buf.toString("base64"),
        },
      };
    });
    content.push({
      type: "text",
      text:
        `Tên file: ${fileName}\n\n` +
        `Đây là ${pages.length} trang scan của 1 tài liệu duy nhất (theo thứ tự). ` +
        `OCR toàn bộ text + phân loại theo schema:\n\n` +
        `{\n  "kind": "<một trong các loại>",\n` +
        `  "description": "<4-8 câu tiếng Việt dày đặc entity>",\n` +
        `  "fullText": "## Trang 1\\n<text trang 1>\\n\\n## Trang 2\\n<text trang 2>\\n..."\n}\n\n` +
        `CHỈ trả JSON.`,
    });
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: { role: "user", content: content as never },
    };
  }

  try {
    const raw = await runQuery(messages(), `pdf-scan:${fileName}`);
    const block = findFirstJsonBlock(raw);
    if (!block) {
      logger.warn("Describe", `pdf-scan ${fileName} no JSON block — fallback to raw text`);
      return {
        kind: "other",
        description: raw.trim().slice(0, 800) || FALLBACK.description,
        fullText: raw.trim(),
      };
    }
    const obj = JSON.parse(block) as Partial<FileDescription & { fullText: string }>;
    return {
      kind: (obj.kind ?? "other") as MediaKind,
      description: (obj.description ?? "").trim() || FALLBACK.description,
      fullText: (obj.fullText ?? "").trim(),
    };
  } catch (err) {
    logger.warn("Describe", `pdf-scan ${fileName} failed: ${err}`);
    return { ...FALLBACK, fullText: "" };
  }
}

/**
 * Tóm tắt 1 ảnh — gửi base64 qua claude-agent-sdk vision (OAuth Claude Max).
 */
export async function describeImage(
  fileName: string,
  buffer: Buffer | ArrayBuffer,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<FileDescription> {
  const buf = buffer instanceof Buffer ? buffer : Buffer.from(new Uint8Array(buffer));
  const base64 = buf.toString("base64");

  async function* messages(): AsyncIterable<SDKUserMessage> {
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Tên file: ${fileName}\n\nPhân loại + tóm tắt ảnh trên theo schema đã định.`,
          },
        ],
      },
    };
  }

  try {
    const raw = await runQuery(messages(), `img:${fileName}`);
    return parse(raw, `img:${fileName}`);
  } catch (err) {
    logger.warn("Describe", `img ${fileName} failed: ${err}`);
    return FALLBACK;
  }
}
