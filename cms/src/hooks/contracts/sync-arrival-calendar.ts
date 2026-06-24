import type { CollectionAfterChangeHook } from "payload";

/**
 * Khi `Contracts.deploymentDate` thay đổi → upsert 1 Calendar event "✈️ Ngày
 * đến Nhật: <tên LĐ>" để hiện lên lịch chung. Yêu cầu HCNS item #2 — buổi họp
 * đối tác 18/06/2026.
 *
 * - Tạo mới nếu chưa có event nào liên kết contract này (`relatedContract`).
 * - Cập nhật ngày nếu đã có (vd lùi/dời ngày bay).
 * - Bỏ qua nếu deploymentDate bị xoá (không xoá event — để HCNS thấy lịch sử).
 */
export const syncArrivalCalendar: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  // afterChange chỉ fire trên create/update, không có delete.
  const prev = previousDoc?.deploymentDate as string | null | undefined;
  const next = doc?.deploymentDate as string | null | undefined;
  if (!next) return doc;
  if (prev === next) return doc;

  // Resolve worker name (depth có thể 0 hoặc 1)
  let workerName = "";
  const workerRef = doc.worker as unknown;
  if (workerRef && typeof workerRef === "object") {
    workerName = (workerRef as { fullName?: string }).fullName ?? "";
  } else if (typeof workerRef === "string") {
    try {
      const w = await req.payload.findByID({
        collection: "workers",
        id: workerRef,
        depth: 0,
      });
      workerName = (w as { fullName?: string }).fullName ?? "";
    } catch {
      // worker not found — leave name empty, event vẫn tạo
    }
  }

  const title = workerName
    ? `✈️ Ngày đến Nhật: ${workerName}`
    : `✈️ Ngày đến Nhật (HĐ ${doc.contractCode ?? doc.id})`;

  // Tìm event existing
  try {
    const existing = await req.payload.find({
      collection: "calendars",
      where: {
        and: [
          { relatedContract: { equals: doc.id } },
          { eventType: { equals: "flight" } },
        ],
      },
      limit: 1,
      depth: 0,
    });

    if (existing.docs.length > 0) {
      const e = existing.docs[0];
      await req.payload.update({
        collection: "calendars",
        id: e.id,
        data: { title, startAt: next, allDay: true },
      });
      req.payload.logger.info(
        `[arrival-calendar] updated event #${e.id} contract=${doc.id} date=${next}`,
      );
    } else {
      const created = await req.payload.create({
        collection: "calendars",
        data: {
          title,
          eventType: "flight",
          status: "scheduled",
          startAt: next,
          allDay: true,
          relatedContract: doc.id as string,
          description:
            `Ngày LĐ đến Nhật theo HĐ ${doc.contractCode ?? doc.id}. ` +
            `Event tự sinh từ trường deploymentDate của Contract.`,
        },
      });
      req.payload.logger.info(
        `[arrival-calendar] created event #${created.id} contract=${doc.id} date=${next}`,
      );
    }
  } catch (e) {
    req.payload.logger.warn(
      `[arrival-calendar] sync failed contract=${doc.id}: ${e instanceof Error ? e.message : e}`,
    );
  }

  return doc;
};
