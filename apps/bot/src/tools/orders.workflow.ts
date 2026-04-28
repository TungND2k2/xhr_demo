/**
 * Custom workflow tools — beyond plain CRUD.
 *
 * `advance_order_status` chuyển W1→W2→...→W8→done. Backend Payload hooks
 * sẽ validate role + thứ tự bước.
 */
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { payload, PayloadError } from "../payload/client.js";
import { ORDER_STATUSES } from "./orders.tools.js";

export const advanceOrderStatus = tool(
  "advance_order_status",
  `Chuyển 1 đơn tuyển sang bước workflow tiếp theo (W1→W2→...→W8→done).
Gọi sau khi user xác nhận bước hiện tại đã xong (vd: "đơn XHR-12 đã đủ ứng viên, chuyển W2 khám SK").
Payload sẽ tự kiểm tra quyền + thứ tự; nếu sai trả lỗi.`,
  {
    orderId: z.string().describe("ID đơn tuyển"),
    toStatus: z.enum(ORDER_STATUSES).describe("Trạng thái mới (vd: w2)"),
    reason: z.string().optional().describe("Lý do/ghi chú khi chuyển bước"),
  },
  async ({ orderId, toStatus, reason }) => {
    try {
      const body: Record<string, unknown> = { status: toStatus };
      if (reason) body.notes = reason;

      const res = await payload.request<{ doc: { id: string; status: string } }>(
        `/api/orders/${encodeURIComponent(String(orderId))}`,
        { method: "PATCH", body },
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Đơn ${orderId} đã chuyển sang bước ${res.doc.status.toUpperCase()}`,
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof PayloadError ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `⚠️ ${msg}` }],
        isError: true,
      };
    }
  },
);
