import type { CollectionBeforeChangeHook, CollectionAfterChangeHook } from "payload";

/**
 * Track status timestamps + notify Telegram hand-off khi worker chuyển bước.
 *
 * - beforeChange: auto-set `agreedAt` khi status đổi sang "agreed".
 * - afterChange: gọi bot HTTP endpoint `/internal/worker-status-changed` để
 *   bot bắn message vào topic kế tiếp (W1→W8 chain).
 *
 * Map status → topic được bot lookup từ TelegramTopics + agent docs.
 * Hook chỉ pass workerId + oldStatus + newStatus, bot tự resolve topic.
 */
export const trackStatusChangesBefore: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation === "create") {
    // Auto-track người nhập dữ liệu khi tạo mới. Field readOnly trên admin
    // form → admin sửa sau không thay đổi giá trị này.
    if (!data.createdByUser && req?.user?.id) {
      data.createdByUser = req.user.id;
    }
    return data;
  }
  const prev = originalDoc?.status;
  const next = data?.status;
  if (prev && next && prev !== next) {
    // Set agreedAt khi LĐ đồng ý (lần đầu).
    if (next === "agreed" && !data.agreedAt) {
      data.agreedAt = new Date().toISOString();
    }
  }
  return data;
};

export const trackStatusChangesAfter: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update") return doc;
  const prev = previousDoc?.status as string | undefined;
  const next = doc?.status as string | undefined;
  if (!prev || !next || prev === next) return doc;

  // Fire-and-forget HTTP call to bot — không block Payload response.
  const botUrl = process.env.BOT_INTERNAL_URL ?? "http://localhost:4002";
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    req.payload.logger.debug("Workers.afterChange: INTERNAL_SECRET missing — skip notify");
    return doc;
  }

  void fetch(`${botUrl}/internal/worker-status-changed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": secret },
    body: JSON.stringify({
      workerId: doc.id,
      workerCode: doc.workerCode,
      fullName: doc.fullName,
      market: doc.market,
      previousStatus: prev,
      newStatus: next,
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch((e) =>
    req.payload.logger.warn(`Workers.afterChange notify bot failed: ${e}`),
  );

  return doc;
};
