/**
 * One pass of conversation: take user message, give to Claude, let it
 * call tools (which talk to Payload), return final reply.
 *
 * Stateless on purpose — conversation history is held in-memory by
 * caller (Telegram channel), passed in as `priorMessages`. Keep this
 * function pure for easier testing.
 */
import {
  query,
  createSdkMcpServer,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { allTools } from "../tools/index.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

export type PipelineAttachment =
  | {
      type: "document";
      /** Tên file gốc — Claude xem để biết đây là gì (vd "invoice.pdf"). */
      name: string;
      /** Markdown text đã chuyển từ MarkItDown. */
      markdown: string;
    }
  | {
      type: "image";
      name: string;
      mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      buffer: Buffer;
    };

export interface PipelineInput {
  /** Latest user message text (caption khi gửi file, có thể rỗng). */
  message: string;
  /** Files / ảnh user đính kèm cùng message này. */
  attachments?: PipelineAttachment[];
  /** Optional callback fired each time Claude calls a tool. Receives raw args
   *  để caller có thể format mô tả thân thiện hiển thị cho user. */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  /** Optional callback fired with intermediate "thinking" text. */
  onThinking?: (text: string) => void;
  /** Optional tag for log prefix — useful when caller wants to identify session. */
  logTag?: string;
}

export interface PipelineOutput {
  reply: string;
  ok: boolean;
  toolsUsed: string[];
}

/** Hard timeout (ms) — nếu Claude treo, thoát ra để log lỗi rõ. */
const PIPELINE_TIMEOUT_MS = 90_000;

function preview(s: string, n = 80): string {
  const compact = s.replace(/\s+/g, " ").trim();
  return compact.length > n ? compact.slice(0, n) + "…" : compact;
}

/**
 * Build claude-agent-sdk prompt. Khi không có ảnh, dùng string concat
 * (rẻ + dễ đọc trong log). Khi có ảnh, phải dùng AsyncIterable<SDKUserMessage>
 * để gửi content blocks (image + text) qua API vision.
 */
function buildPrompt(
  message: string,
  attachments: PipelineAttachment[],
): string | AsyncIterable<SDKUserMessage> {
  const docAttachments = attachments.filter(
    (a): a is Extract<PipelineAttachment, { type: "document" }> => a.type === "document",
  );
  const imageAttachments = attachments.filter(
    (a): a is Extract<PipelineAttachment, { type: "image" }> => a.type === "image",
  );

  const docsText = docAttachments
    .map(
      (d) =>
        `\n\n📎 Đính kèm: ${d.name}\n--- BẮT ĐẦU NỘI DUNG ---\n${d.markdown}\n--- HẾT NỘI DUNG ---`,
    )
    .join("");

  const composedText = (message?.trim() ? message : "(người dùng gửi tệp đính kèm — không kèm chú thích)") + docsText;

  if (imageAttachments.length === 0) {
    return composedText;
  }

  // Có ảnh → build async iterable với image + text blocks.
  async function* iter(): AsyncIterable<SDKUserMessage> {
    const content: Array<
      | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
      | { type: "text"; text: string }
    > = imageAttachments.map((img) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.buffer.toString("base64"),
      },
    }));
    content.push({ type: "text", text: composedText });
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: { role: "user", content: content as never },
    };
  }
  return iter();
}

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const config = getConfig();
  const tag = input.logTag ?? "Pipeline";
  const toolsUsed: string[] = [];
  let reply = "";
  let ok = true;

  const startTs = Date.now();
  const attachments = input.attachments ?? [];
  const attSummary =
    attachments.length > 0
      ? ` +${attachments.length} đính kèm: [${attachments
          .map((a) => `${a.type === "image" ? "🖼" : "📄"}${a.name}`)
          .join(", ")}]`
      : "";
  logger.info(tag, `▶ user: "${preview(input.message, 100)}"${attSummary}`);

  const mcpServer = createSdkMcpServer({
    name: "skillbot",
    tools: allTools,
  });

  // Wrap iterator with global timeout — Claude SDK sometimes hangs.
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    logger.warn(tag, `⏱ Timeout after ${PIPELINE_TIMEOUT_MS}ms — aborting`);
  }, PIPELINE_TIMEOUT_MS);

  try {
    const q = query({
      prompt: buildPrompt(input.message, attachments),
      options: {
        systemPrompt: SYSTEM_PROMPT,
        mcpServers: { skillbot: mcpServer },
        tools: [],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: config.MAX_TOOL_LOOPS,
        model: config.CLAUDE_MODEL,
        persistSession: false,
        ...(config.CLAUDE_BIN ? { pathToClaudeCodeExecutable: config.CLAUDE_BIN } : {}),
      },
    });

    for await (const msg of q) {
      if (timedOut) {
        ok = false;
        reply = "Hệ thống quá tải — vui lòng thử lại sau.";
        break;
      }

      const elapsed = Date.now() - startTs;

      if (msg.type === "assistant") {
        const blocks = msg.message.content as Array<{
          type: string;
          text?: string;
          name?: string;
          input?: unknown;
        }>;
        for (const b of blocks) {
          if (b.type === "tool_use" && b.name) {
            const short = b.name.replace(/^mcp__\w+__/, "");
            toolsUsed.push(short);
            const args = (b.input as Record<string, unknown>) ?? {};
            const argsJson = JSON.stringify(args);
            logger.info(tag, `  [+${elapsed}ms] 🔧 ${short}(${preview(argsJson, 100)})`);
            input.onToolCall?.(short, args);
          } else if (b.type === "text" && b.text?.trim()) {
            const t = b.text.trim();
            logger.info(tag, `  [+${elapsed}ms] 💭 ${preview(t, 120)}`);
            input.onThinking?.(t);
          }
        }
      } else if (msg.type === "user") {
        // tool_result blocks come back as user messages
        const blocks = (msg.message?.content as Array<{ type: string; content?: unknown; is_error?: boolean }>) ?? [];
        for (const b of blocks) {
          if (b.type === "tool_result") {
            const contentStr = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
            const mark = b.is_error ? "✗" : "✔";
            logger.info(tag, `  [+${elapsed}ms] ${mark} result: ${preview(contentStr, 140)}`);
          }
        }
      } else if (msg.type === "result") {
        if (msg.subtype === "success") {
          reply = msg.result;
          logger.info(tag, `◀ [+${elapsed}ms] reply (${reply.length} chars), tools: [${toolsUsed.join(", ")}]`);
        } else {
          ok = false;
          reply = "Có lỗi khi xử lý — vui lòng thử lại.";
          logger.error(tag, `[+${elapsed}ms] subtype=${msg.subtype} (${(msg as { error?: string }).error ?? "no detail"})`);
        }
      } else if (msg.type === "system") {
        // Init/setup messages — log once at debug
        logger.debug(tag, `system: ${(msg as { subtype?: string }).subtype ?? "init"}`);
      }
    }

    if (!reply && ok) {
      reply = "Không có phản hồi — vui lòng thử lại.";
      logger.warn(tag, `[+${Date.now() - startTs}ms] empty reply but no error`);
    }
  } catch (e) {
    ok = false;
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(tag, `Threw at +${Date.now() - startTs}ms: ${errMsg}`, e);
    reply = "Lỗi hệ thống. Vui lòng thử lại sau.";
  } finally {
    clearTimeout(timer);
  }

  logger.info(tag, `✓ done in ${Date.now() - startTs}ms (ok=${ok}, ${toolsUsed.length} tools)`);
  return { reply, ok, toolsUsed };
}
