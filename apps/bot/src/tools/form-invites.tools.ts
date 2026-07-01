/**
 * Tool MCP: generate_form_link — tạo invite token + URL để NLĐ điền form.
 *
 * Flow:
 *   1. Recruiter chat Telegram "Tạo link form đăng ký cho Nguyễn Văn A SĐT 0901..."
 *   2. AI gọi generate_form_link({workerName, phone, formCode})
 *   3. Tool:
 *      - Lookup hoặc tạo Worker với info đã có
 *      - Tìm Form template theo title (vd "Sơ yếu lý lịch thực tập sinh")
 *      - Tạo FormInvite record (Payload auto sinh token + expiresAt 7 ngày)
 *      - Return URL `<PUBLIC_URL>/forms/<token>`
 *   4. AI gửi link trong chat cho recruiter, recruiter forward cho NLĐ
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import { getConfig } from "../config.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = ReturnType<typeof tool<any>>;

function ok(text: string): CallToolResult {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string): CallToolResult {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

interface WorkerLite {
  id: string;
  workerCode?: string;
  fullName?: string;
  phone?: string;
}
interface FormLite {
  id: string;
  title: string;
}
interface InviteCreated {
  doc: { id: string; token: string; expiresAt: string };
}

const generate_form_link = tool(
  "generate_form_link",
  `Tạo link form đăng ký cho NLĐ.

QUAN TRỌNG: Có thể gọi tool này KHÔNG CẦN bất kỳ thông tin NLĐ nào — chỉ cần \`notifyChatId\` + \`notifyThreadId\`. Tool sẽ tự tạo Worker placeholder ("LĐ chưa rõ tên (...)"), sinh link form, LĐ tự điền tên + SĐT vào form → bot tự update Worker khi submit.

Tham số:
- formTitle: tiêu đề form template (vd "Sơ yếu lý lịch thực tập sinh"). Default = form đầu tiên.
- workerName: CHỈ điền nếu user đã cung cấp tên — nếu KHÔNG có, BỎ TRỐNG, tool tự tạo placeholder.
- workerId: ID Worker existing (nếu đã có, ưu tiên hơn workerName).
- phone: SĐT NLĐ — CHỈ điền nếu user cung cấp.
- expiresInDays: số ngày hết hạn (default 7).
- prefillData: dict {field: value} để pre-fill form.
- telegramUserId: ID Telegram của recruiter tạo (để track).

Trả về: link dạng "<PUBLIC_URL>/forms/<token>" + expire time.

Khi dùng:
- User chỉ nói "tạo hồ sơ" / "gửi link form" → GỌI NGAY, KHÔNG hỏi gì thêm.
- User có cung cấp tên/SĐT → parse rồi điền vào workerName/phone.`,
  {
    formTitle: z.string().optional().describe("Tên form template, default 'Sơ yếu lý lịch thực tập sinh'"),
    workerName: z.string().optional().describe("Họ tên NLĐ (cần để pre-fill + tạo Worker mới)"),
    workerId: z.string().optional().describe("ID Worker existing (ưu tiên nếu có)"),
    phone: z.string().optional().describe("SĐT NLĐ"),
    expiresInDays: z.number().int().positive().max(30).optional().describe("Ngày hết hạn (default 7)"),
    prefillData: z.record(z.string()).optional().describe('Pre-fill các field, vd {"fullName":"A","phone":"0901"}'),
    telegramUserId: z.string().optional().describe("ID Telegram recruiter (lấy từ system prompt)"),
    notifyChatId: z.string().optional().describe("Chat ID hiện tại (lấy từ system prompt) — bot sẽ bắn thông báo về đây khi NLĐ submit"),
    notifyThreadId: z.string().optional().describe("Topic ID hiện tại (lấy từ system prompt)"),
  },
  async (args) => {
    const cfg = getConfig();
    try {
      // 1. Tìm form template
      const formTitle = args.formTitle ?? "Sơ yếu lý lịch thực tập sinh";
      const formRes = await payload.request<{ docs: FormLite[]; totalDocs: number }>(`/api/forms`, {
        query: { where: { title: { equals: formTitle } }, limit: 1, depth: 0 },
      });
      if (formRes.docs.length === 0) {
        return err(`Không tìm thấy form "${formTitle}". Admin cần seed form trước (xem /admin/collections/forms).`);
      }
      const form = formRes.docs[0];

      // 2. Xử lý Worker — nếu không có workerId & không có name → tạo placeholder Worker để LĐ tự điền sau
      let workerId = args.workerId;
      let workerSummary = "";
      if (!workerId) {
        const hasName = !!args.workerName?.trim();
        if (hasName) {
          // Lookup Worker by name trước
          const wlookup = await payload.request<{ docs: WorkerLite[] }>(`/api/workers`, {
            query: { where: { fullName: { equals: args.workerName } }, limit: 1, depth: 0 },
          });
          if (wlookup.docs.length > 0) {
            workerId = wlookup.docs[0].id;
            workerSummary = `(reuse Worker #${wlookup.docs[0].workerCode ?? workerId} ${args.workerName})`;
          }
        }
        if (!workerId) {
          // Tạo Worker draft — nếu chưa có tên thì placeholder, LĐ sẽ tự điền qua form
          const placeholderName = args.workerName?.trim() || `LĐ chưa rõ tên (${new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })})`;
          try {
            const created = await payload.request<{ doc: WorkerLite }>(`/api/workers`, {
              method: "POST",
              body: {
                fullName: placeholderName,
                phone: args.phone,
                status: "researching",
              },
            });
            workerId = created.doc.id;
            workerSummary = `(tạo Worker mới #${created.doc.workerCode ?? workerId} ${placeholderName})`;
          } catch (e) {
            workerSummary = `(không tạo được Worker — ${e instanceof Error ? e.message : e})`;
          }
        }
      }

      // 3. Tạo FormInvite
      const prefillArray = args.prefillData
        ? Object.entries(args.prefillData)
            .filter(([, v]) => v != null && v !== "")
            .map(([field, value]) => ({ field, value: String(value) }))
        : [];
      // Tự thêm fullName + phone vào prefill nếu chưa có
      if (args.workerName && !prefillArray.find((p) => p.field === "fullName")) {
        prefillArray.push({ field: "fullName", value: args.workerName });
      }
      if (args.phone && !prefillArray.find((p) => p.field === "personalPhone")) {
        prefillArray.push({ field: "personalPhone", value: args.phone });
      }

      const expiresInDays = args.expiresInDays ?? 7;
      const inviteBody: Record<string, unknown> = {
        form: form.id,
        expiresAt: new Date(Date.now() + expiresInDays * 86400_000).toISOString(),
        status: "pending",
        ...(workerId ? { worker: workerId } : {}),
        ...(prefillArray.length > 0 ? { prefillData: prefillArray } : {}),
        ...(args.telegramUserId ? { createdByTelegram: args.telegramUserId } : {}),
        ...(args.notifyChatId ? { notifyChatId: args.notifyChatId } : {}),
        ...(args.notifyThreadId ? { notifyThreadId: args.notifyThreadId } : {}),
      };

      const invite = await payload.request<InviteCreated>(`/api/form-invites`, {
        method: "POST",
        body: inviteBody,
      });

      // Dùng PORTAL_URL (đẹp, thân thiện LĐ) thay vì PUBLIC_URL (admin CMS).
      // Yêu cầu: nginx portal cần proxy /forms/* → CMS port 3002.
      const url = `${cfg.PORTAL_URL.replace(/\/$/, "")}/forms/${invite.doc.token}`;
      const expVN = new Date(invite.doc.expiresAt).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      });

      return ok(
        `✅ Đã tạo link form **${form.title}**\n\n` +
          `🔗 **Link:** ${url}\n` +
          `⏰ **Hết hạn:** ${expVN} (giờ VN)\n` +
          (workerSummary ? `👤 **NLĐ:** ${workerSummary}\n` : "") +
          (prefillArray.length > 0 ? `📝 **Pre-fill:** ${prefillArray.length} fields\n` : "") +
          `\nForward link này cho NLĐ. Khi NLĐ submit, bot sẽ notify trong topic này.`,
      );
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : e instanceof Error ? e.message : String(e);
      return err(`Tạo link form thất bại: ${reason}`);
    }
  },
);

export const formInviteTools: AnyTool[] = [generate_form_link as AnyTool];
