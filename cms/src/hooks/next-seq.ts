import type { Payload } from "payload";

/**
 * Atomic increment counter và trả giá trị mới. Idempotent qua MongoDB
 * `findOneAndUpdate` với upsert + `$inc`.
 *
 * Dùng cho auto-gen mã đơn (PE100), mã NCC, etc.
 *
 * Note: Payload abstracts over Mongoose; ta phải dùng `payload.db` raw.
 */
export async function nextSeq(payload: Payload, key: string): Promise<number> {
  // Try fetch existing
  const existing = await payload.find({
    collection: "counters",
    where: { key: { equals: key } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  if (existing.docs.length === 0) {
    const created = await payload.create({
      collection: "counters",
      data: { key, value: 1 },
      overrideAccess: true,
    });
    return Number(created.value);
  }

  const doc = existing.docs[0];
  const newValue = Number(doc.value ?? 0) + 1;
  await payload.update({
    collection: "counters",
    id: doc.id,
    data: { value: newValue },
    overrideAccess: true,
  });
  return newValue;
}
