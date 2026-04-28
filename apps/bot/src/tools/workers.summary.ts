/**
 * Custom tool: tóm tắt 1 worker — hồ sơ + đơn đang ứng tuyển + trạng thái HĐ.
 *
 * Dùng khi user hỏi: "LD-00012 đang sao rồi", "Nguyễn Văn A đã ký HĐ chưa".
 */
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";

interface WorkerRow {
  id: string;
  workerCode: string;
  fullName: string;
  dob?: string;
  gender?: string;
  phone?: string;
  hometown?: string;
  status: string;
  healthStatus?: string;
  languages?: Array<{ code: string; level?: string }>;
  skills?: Array<{ name: string; yearsExp?: number }>;
}

interface OrderWorkerRow {
  id: string;
  status: string;
  order?: { id: string; orderCode?: string; employer?: string; position?: string } | string;
  interviewResult?: string;
  trainingStatus?: string;
}

interface ContractRow {
  id: string;
  contractCode: string;
  status: string;
  visaStatus?: string;
  signingDate?: string;
  deploymentDate?: string;
  order?: { orderCode?: string; employer?: string } | string;
}

const LANG: Record<string, string> = {
  ja: "tiếng Nhật", en: "tiếng Anh", ko: "tiếng Hàn",
  zh: "tiếng Trung", de: "tiếng Đức", other: "ngoại ngữ khác",
};

export const workerSummary = tool(
  "worker_summary",
  `Tóm tắt 1 người lao động: hồ sơ cơ bản + các đơn đang ứng tuyển +
hợp đồng (nếu có). Dùng khi user hỏi "LD-00012 sao rồi" hoặc tên LĐ.`,
  {
    workerCode: z.string().optional().describe("Mã LĐ (LD-00012)"),
    id: z.string().optional().describe("ID worker"),
  },
  async ({ workerCode, id }) => {
    if (!workerCode && !id) {
      return {
        content: [{ type: "text" as const, text: "⚠️ Cần workerCode hoặc id" }],
        isError: true,
      };
    }
    try {
      let worker: WorkerRow | null = null;
      if (workerCode) {
        const res = await payload.request<{ docs: WorkerRow[] }>("/api/workers", {
          query: { where: { workerCode: { equals: workerCode } }, limit: 1 },
        });
        worker = res.docs[0] ?? null;
      } else if (id) {
        worker = await payload.request<WorkerRow>(`/api/workers/${id}`);
      }
      if (!worker) {
        return {
          content: [
            { type: "text" as const, text: `❌ Không tìm thấy LĐ ${workerCode ?? id}` },
          ],
          isError: true,
        };
      }

      const [owRes, ctRes] = await Promise.all([
        payload.request<{ docs: OrderWorkerRow[] }>("/api/order-workers", {
          query: { where: { worker: { equals: worker.id } }, limit: 50, depth: 1 },
        }),
        payload.request<{ docs: ContractRow[] }>("/api/contracts", {
          query: { where: { worker: { equals: worker.id } }, limit: 20, depth: 1 },
        }),
      ]);

      const lines: string[] = [];
      lines.push(`👤 ${worker.fullName} — ${worker.workerCode}`);
      if (worker.dob) lines.push(`Sinh năm: ${worker.dob.slice(0, 10)}`);
      if (worker.phone) lines.push(`SĐT: ${worker.phone}`);
      if (worker.hometown) lines.push(`Quê: ${worker.hometown}`);
      lines.push(`Trạng thái: ${worker.status}`);
      if (worker.healthStatus) lines.push(`Sức khoẻ: ${worker.healthStatus}`);

      if (worker.languages?.length) {
        const langs = worker.languages
          .map((l) => `${LANG[l.code] ?? l.code}${l.level ? ` (${l.level})` : ""}`)
          .join(", ");
        lines.push(`Ngoại ngữ: ${langs}`);
      }
      if (worker.skills?.length) {
        const sk = worker.skills
          .map((s) => `${s.name}${s.yearsExp ? ` (${s.yearsExp}y)` : ""}`)
          .join(", ");
        lines.push(`Kỹ năng: ${sk}`);
      }

      lines.push("");
      lines.push(`📋 Đơn đang/đã ứng tuyển: ${owRes.docs.length}`);
      for (const ow of owRes.docs.slice(0, 10)) {
        const o = typeof ow.order === "string" ? null : ow.order;
        lines.push(
          `  • ${o?.orderCode ?? "?"} (${o?.employer ?? "?"}) — ${ow.status}` +
            (ow.interviewResult ? ` · phỏng vấn: ${ow.interviewResult}` : "") +
            (ow.trainingStatus ? ` · đào tạo: ${ow.trainingStatus}` : ""),
        );
      }

      if (ctRes.docs.length > 0) {
        lines.push("");
        lines.push(`📝 Hợp đồng: ${ctRes.docs.length}`);
        for (const c of ctRes.docs) {
          const o = typeof c.order === "string" ? null : c.order;
          lines.push(
            `  • ${c.contractCode} — ${o?.orderCode ?? "?"}/${o?.employer ?? "?"}` +
              ` — ${c.status}${c.visaStatus ? ` · visa: ${c.visaStatus}` : ""}` +
              (c.deploymentDate ? ` · xuất cảnh: ${c.deploymentDate.slice(0, 10)}` : ""),
          );
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err) {
      const msg = err instanceof PayloadError ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `⚠️ ${msg}` }],
        isError: true,
      };
    }
  },
);
