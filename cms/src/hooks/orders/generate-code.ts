import type { CollectionBeforeChangeHook } from "payload";
import { nextSeq } from "../next-seq";

/**
 * Sinh `orderCode` dạng `XHR-{seq}` khi tạo Order mới. Idempotent —
 * không sinh lại khi update.
 */
export const generateOrderCode: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
}) => {
  if (operation !== "create") return data;
  if (data.orderCode) return data;
  const seq = await nextSeq(req.payload, "orders");
  data.orderCode = `XHR-${String(seq).padStart(4, "0")}`;
  return data;
};
