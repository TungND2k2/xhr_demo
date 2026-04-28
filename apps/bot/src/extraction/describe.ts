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

function parse(raw: string): FileDescription {
  try {
    const obj = JSON.parse(stripJsonFences(raw)) as Partial<FileDescription>;
    const kind = (obj.kind ?? "other") as MediaKind;
    const description = (obj.description ?? "").trim();
    if (!description) return FALLBACK;
    return { kind, description };
  } catch {
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
    return parse(raw);
  } catch (err) {
    logger.warn("Describe", `doc ${fileName} failed: ${err}`);
    return FALLBACK;
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
    return parse(raw);
  } catch (err) {
    logger.warn("Describe", `img ${fileName} failed: ${err}`);
    return FALLBACK;
  }
}
