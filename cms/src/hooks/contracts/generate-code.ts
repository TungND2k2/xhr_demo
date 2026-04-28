import type { CollectionBeforeChangeHook } from "payload";
import { nextSeq } from "../next-seq";

/** Sinh `contractCode` dạng `CT-{seq}` khi tạo HĐ mới. */
export const generateContractCode: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
}) => {
  if (operation !== "create") return data;
  if (data.contractCode) return data;
  const seq = await nextSeq(req.payload, "contracts");
  data.contractCode = `CT-${String(seq).padStart(5, "0")}`;
  return data;
};
