import type { CollectionBeforeChangeHook } from "payload";
import { nextSeq } from "../next-seq";

/** Sinh `workerCode` dạng `LD-{seq}` khi tạo Worker mới. */
export const generateWorkerCode: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
}) => {
  if (operation !== "create") return data;
  if (data.workerCode) return data;
  const seq = await nextSeq(req.payload, "workers");
  data.workerCode = `LD-${String(seq).padStart(5, "0")}`;
  return data;
};
