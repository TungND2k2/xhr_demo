/**
 * Custom tool: tóm tắt 1 đơn tuyển XKLĐ + tiến độ ứng viên.
 *
 * Dùng khi user hỏi: "đơn XHR-12 sao rồi", "còn mấy người chưa khám SK",
 * "tiến độ tuyển đơn Toyota tháng 3".
 */
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";

interface OrderRow {
  id: string;
  orderCode: string;
  market?: string;
  employer?: string;
  position?: string;
  quantityNeeded?: number;
  status: string;
  deadline?: string;
  deploymentDate?: string;
  stageStartedAt?: string;
}

interface StageDoc {
  code: string;
  name: string;
  durationDays?: number;
  responsibleRole?: string;
}

interface OrderWorkerRow {
  id: string;
  status: string;
  screeningStatus?: string;
  medicalStatus?: string;
  trainingStatus?: string;
  interviewResult?: string;
  worker?: { fullName?: string; workerCode?: string } | string;
}

const MARKET_LABEL: Record<string, string> = {
  jp: "🇯🇵 Nhật",
  kr: "🇰🇷 Hàn",
  tw: "🇹🇼 Đài",
  de: "🇩🇪 Đức",
  me: "🇸🇦 Trung Đông",
  eu: "🇪🇺 EU",
  other: "Khác",
};

function days(fromIso: string, to = new Date()): number {
  return Math.floor((to.getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

export const orderProgressSummary = tool(
  "order_progress_summary",
  `Tóm tắt 1 đơn tuyển: bước hiện tại, ngày còn lại đến hạn, tiến độ
ứng viên (đã đủ chưa, đang ở giai đoạn nào).
Dùng khi user hỏi: "đơn XHR-12 sao rồi", "tiến độ Toyota Q1", v.v.`,
  {
    orderCode: z.string().optional().describe("Mã đơn (XHR-001, XHR-12...)"),
    id: z.string().optional().describe("ID đơn (nếu không có orderCode)"),
  },
  async ({ orderCode, id }) => {
    if (!orderCode && !id) {
      return {
        content: [{ type: "text" as const, text: "⚠️ Cần truyền orderCode hoặc id" }],
        isError: true,
      };
    }

    try {
      let order: OrderRow | null = null;
      if (orderCode) {
        const res = await payload.request<{ docs: OrderRow[] }>("/api/orders", {
          query: { where: { orderCode: { equals: orderCode } }, limit: 1 },
        });
        order = res.docs[0] ?? null;
      } else if (id) {
        order = await payload.request<OrderRow>(`/api/orders/${id}`);
      }

      if (!order) {
        return {
          content: [
            { type: "text" as const, text: `❌ Không tìm thấy đơn ${orderCode ?? id}` },
          ],
          isError: true,
        };
      }

      // Stage
      const stagesRes = await payload.request<{ docs: StageDoc[] }>(
        "/api/workflow-stages",
        { query: { where: { code: { equals: order.status } }, limit: 1 } },
      );
      const stage = stagesRes.docs[0];

      // Order workers — đếm theo status
      const owRes = await payload.request<{ docs: OrderWorkerRow[]; totalDocs: number }>(
        "/api/order-workers",
        { query: { where: { order: { equals: order.id } }, limit: 200, depth: 1 } },
      );
      const total = owRes.totalDocs;
      const byStatus: Record<string, number> = {};
      for (const r of owRes.docs) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      }

      const lines: string[] = [];
      lines.push(
        `📦 Đơn ${order.orderCode} — ${MARKET_LABEL[order.market ?? "other"] ?? ""} ${order.employer ?? "?"}`,
      );
      if (order.position) lines.push(`Vị trí: ${order.position}`);
      lines.push(
        `Trạng thái: ${order.status.toUpperCase()}${stage ? " — " + stage.name : ""}`,
      );

      if (order.stageStartedAt && stage) {
        const elapsed = days(order.stageStartedAt);
        const dur = stage.durationDays ?? 0;
        const remaining = dur > 0 ? dur - elapsed : 0;
        lines.push(
          `Đã ở bước ${stage.code.toUpperCase()}: ${elapsed} ngày` +
            (dur > 0
              ? remaining >= 0
                ? ` (còn ${remaining} ngày dự kiến)`
                : ` (TRỄ ${-remaining} ngày)`
              : ""),
        );
      }

      if (order.deadline) {
        const dDays = days(new Date().toISOString(), new Date(order.deadline));
        lines.push(
          `Hạn tuyển đủ: ${order.deadline.slice(0, 10)} (${
            dDays >= 0 ? `còn ${dDays} ngày` : `TRỄ ${-dDays} ngày`
          })`,
        );
      }
      if (order.deploymentDate) {
        lines.push(`Dự kiến xuất cảnh: ${order.deploymentDate.slice(0, 10)}`);
      }

      lines.push("");
      lines.push(
        `Ứng viên: ${total}/${order.quantityNeeded ?? "?"} ` +
          `(${order.quantityNeeded ? Math.round((total / order.quantityNeeded) * 100) : 0}%)`,
      );
      if (Object.keys(byStatus).length > 0) {
        const breakdown = Object.entries(byStatus)
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ");
        lines.push(`Phân bố trạng thái: ${breakdown}`);
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
