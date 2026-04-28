import type { CollectionConfig } from "payload";

/**
 * Counters — atomic sequence storage. Mỗi key (vd "orders") giữ giá trị
 * `value` luôn tăng dần, dùng để sinh mã đơn dạng "PE100", "PE101"...
 *
 * Truy cập qua helper `nextSeq(payload, "orders")` chứ không qua admin UI.
 * Hide khỏi sidebar để admin không tự sửa giá trị (sai → trùng mã).
 */
export const Counters: CollectionConfig = {
  slug: "counters",
  labels: { singular: "Counter", plural: "Counters" },
  admin: {
    hidden: true,
    useAsTitle: "key",
  },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "key", type: "text", required: true, unique: true, index: true },
    { name: "value", type: "number", required: true, defaultValue: 0 },
  ],
};
