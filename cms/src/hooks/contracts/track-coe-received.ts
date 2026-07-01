import type { CollectionAfterChangeHook } from "payload";

/**
 * Track `coeReceivedAt` transitions từ null → set.
 *
 * COE (Certificate of Eligibility) là giấy phép Cục XNC Nhật cấp cho LĐ trước
 * khi xin visa. Khi COE về tay TLG → kích timeline đặt vé:
 *
 *   T+1d: Nộp visa ĐSQ Nhật
 *   T+8d: Check visa, đặt vé
 *   T+18d: Confirm vé + người đón
 *
 * Hook fire-and-forget POST sang bot. Bot resolve worker info + topic
 * jp_departure rồi tạo reminders.
 */
export const trackCoeReceived: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update") return doc;

  const prev = previousDoc?.coeReceivedAt as string | null | undefined;
  const next = doc?.coeReceivedAt as string | null | undefined;
  if (!next || prev === next) return doc;
  // Chỉ fire khi transition từ rỗng → có (tránh edit lại ngày).
  if (prev) return doc;

  const botUrl = process.env.BOT_INTERNAL_URL ?? "http://localhost:4002";
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) {
    req.payload.logger.debug("Contracts.afterChange: INTERNAL_SECRET missing — skip");
    return doc;
  }

  void fetch(`${botUrl}/internal/coe-received`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": secret },
    body: JSON.stringify({
      contractId: String(doc.id),
      contractCode: doc.contractCode,
      workerId: typeof doc.worker === "object" ? String(doc.worker?.id) : String(doc.worker),
      orderId: typeof doc.order === "object" ? String(doc.order?.id) : String(doc.order),
      coeReceivedAt: next,
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch((e) =>
    req.payload.logger.warn(`Contracts.afterChange notify bot failed: ${e}`),
  );

  return doc;
};
