/**
 * Form-builder integration. Manager creates form templates trong Payload
 * admin (collection `forms`), bot dùng các tool này để:
 *   - Liệt kê form đang có
 *   - Hỏi chi tiết 1 form (fields, label, type) → AI biết hỏi user gì
 *   - Submit form thay user (sau khi gom đủ dữ liệu qua chat)
 *   - Liệt kê submissions cũ
 *
 * Submission shape khớp với plugin: { form, submissionData: [{ field, value }] }
 */
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import type { PayloadDoc, PayloadFindResponse } from "../payload/types.js";

interface FormBlock {
  blockType: string;          // "text" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date" | "message"
  name?: string;
  label?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  message?: unknown;
}
interface FormDoc extends PayloadDoc {
  title: string;
  fields: FormBlock[];
  submitButtonLabel?: string;
  confirmationMessage?: unknown;
}

interface SubmissionDoc extends PayloadDoc {
  form: string | { id: string; title: string };
  submissionData: Array<{ field: string; value: unknown }>;
}

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function err(message: string) {
  return { content: [{ type: "text" as const, text: `⚠️ ${message}` }], isError: true };
}

// ── list_forms ─────────────────────────────────────────────────

export const listForms = tool(
  "list_forms",
  `Liệt kê các form template có sẵn (do manager/admin tạo trong dashboard).
Dùng khi user nói "có form nào", "form nhập kho ở đâu", "danh sách form".`,
  {
    limit: z.number().int().positive().max(50).default(20),
  },
  async ({ limit }) => {
    try {
      const res = await payload.request<PayloadFindResponse<FormDoc>>("/api/forms", {
        query: { limit },
      });
      if (res.totalDocs === 0) {
        return ok("Chưa có form nào. Manager có thể tạo form trong dashboard mục “Form mẫu”.");
      }
      const lines = res.docs.map((f, i) =>
        `${i + 1}. #${f.id} — *${f.title}* (${f.fields?.length ?? 0} trường)`,
      );
      return ok(`Có ${res.totalDocs} form:\n${lines.join("\n")}`);
    } catch (e) {
      return err(e instanceof PayloadError ? e.message : String(e));
    }
  },
);

// ── get_form ───────────────────────────────────────────────────

export const getForm = tool(
  "get_form",
  `Xem chi tiết 1 form template — danh sách field, kiểu, label, có bắt buộc không.
AI dùng để biết cần hỏi user những gì khi điền form. Gọi khi user nói
"điền form nhập kho", "submit phiếu QC", v.v.`,
  {
    id: z.string().describe("ID của form"),
  },
  async ({ id }) => {
    try {
      const f = await payload.request<FormDoc>(`/api/forms/${encodeURIComponent(String(id))}`);
      const lines = [`📋 *${f.title}*`, ""];
      for (const block of f.fields ?? []) {
        if (block.blockType === "message") continue;
        const required = block.required ? " *(bắt buộc)*" : "";
        const typeLabel = ({
          text: "văn bản ngắn",
          textarea: "văn bản dài",
          number: "số",
          date: "ngày",
          select: "chọn 1 (dropdown)",
          radio: "chọn 1 (radio)",
          checkbox: "đánh dấu",
        } as Record<string, string>)[block.blockType] ?? block.blockType;
        const opts = block.options?.map((o) => o.label).join(", ");
        lines.push(`• ${block.label ?? block.name} — ${typeLabel}${required}${opts ? ` [${opts}]` : ""}`);
      }
      return ok(lines.join("\n"));
    } catch (e) {
      return err(e instanceof PayloadError ? e.message : String(e));
    }
  },
);

// ── submit_form ────────────────────────────────────────────────

export const submitForm = tool(
  "submit_form",
  `Nộp form thay user. Truyền form ID và một mảng { field, value } khớp
với các field name trong template. CHỈ gọi sau khi đã hỏi đủ dữ liệu
qua chat — không tự bịa giá trị.`,
  {
    formId: z.string().describe("ID của form template"),
    data: z.array(z.object({
      field: z.string().describe("Tên field (name) trong form"),
      value: z.union([z.string(), z.number(), z.boolean()]).describe("Giá trị user trả lời"),
    })).describe("Mảng các field-value đã thu thập"),
  },
  async ({ formId, data }) => {
    try {
      const res = await payload.request<{ doc: SubmissionDoc; message: string }>(
        "/api/form-submissions",
        {
          method: "POST",
          body: { form: formId, submissionData: data },
        },
      );
      return ok(`✅ Đã nộp form. Mã submission: #${res.doc.id}`);
    } catch (e) {
      return err(e instanceof PayloadError ? e.message : String(e));
    }
  },
);

// ── list_submissions ──────────────────────────────────────────

export const listSubmissions = tool(
  "list_submissions",
  `Xem các form đã nộp. Filter theo formId nếu chỉ quan tâm 1 loại form.
Dùng khi user hỏi "đã nhập kho gì hôm nay", "phiếu QC tuần này".`,
  {
    formId: z.string().optional().describe("Lọc theo form template (optional)"),
    limit: z.number().int().positive().max(50).default(20),
  },
  async ({ formId, limit }) => {
    try {
      const res = await payload.request<PayloadFindResponse<SubmissionDoc>>(
        "/api/form-submissions",
        {
          query: {
            where: formId ? { form: { equals: formId } } : undefined,
            limit,
            depth: 1, // populate form title
            sort: "-createdAt",
          },
        },
      );
      if (res.totalDocs === 0) return ok("Chưa có form nào được nộp.");
      const lines = res.docs.map((s, i) => {
        const formTitle = typeof s.form === "string" ? s.form : s.form.title;
        const summary = s.submissionData.slice(0, 3)
          .map((kv) => `${kv.field}=${kv.value}`)
          .join(", ");
        const date = new Date(s.createdAt).toLocaleString("vi-VN");
        return `${i + 1}. ${formTitle} — ${summary}${s.submissionData.length > 3 ? "…" : ""} (${date})`;
      });
      return ok(`Có ${res.totalDocs} submission:\n${lines.join("\n")}`);
    } catch (e) {
      return err(e instanceof PayloadError ? e.message : String(e));
    }
  },
);

export const formTools = [listForms, getForm, submitForm, listSubmissions];
