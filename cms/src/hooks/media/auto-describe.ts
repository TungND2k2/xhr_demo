import type { CollectionAfterChangeHook } from "payload";

/**
 * Hook chạy sau khi 1 Media doc được create/update.
 *
 * Trigger condition (chỉ kick off khi):
 *  - Operation = 'create' (file mới upload), HOẶC
 *  - Description rỗng + có filename + mimeType (chưa được describe)
 *
 * Action: POST bot's internal HTTP API → bot làm background describe.
 * Bot side tự lo: download, MarkItDown/OCR, AI describe, PATCH back.
 *
 * Hook không await bot — không block admin save. Nếu bot down, có thể
 * gọi tay redescribe_media tool từ chat sau.
 *
 * Mục đích: admin drag-drop folder PDF (300MB, 100+ file) → mỗi file lưu
 * S3 + tự AI describe trong background → 5-10 phút sau search được hết.
 */
export const autoDescribeMedia: CollectionAfterChangeHook = ({
  doc,
  operation,
  previousDoc,
  req,
}) => {
  // Skip nếu không phải file mới HOẶC description đã có
  const hasFile = !!doc?.filename && !!doc?.mimeType;
  if (!hasFile) return doc;

  const isNew = operation === "create";
  const hadDescription =
    previousDoc?.description &&
    typeof previousDoc.description === "string" &&
    previousDoc.description.length > 50;
  const hasDescription =
    doc?.description &&
    typeof doc.description === "string" &&
    doc.description.length > 50;

  // Chỉ chạy khi: file mới chưa có desc, hoặc đã có file nhưng desc bị xoá
  const shouldDescribe = isNew && !hasDescription;
  if (!shouldDescribe) return doc;

  // Skip nếu uploadedFrom='telegram' — bot đã tự describe inline trong
  // channel.ts khi nhận message. Avoid double work.
  if (doc.uploadedFrom === "telegram") return doc;

  // POST bot HTTP API — fire and forget
  const botUrl = process.env.BOT_INTERNAL_URL ?? "http://localhost:4002";
  const secret = process.env.INTERNAL_SECRET ?? "change-me-internal-secret";

  // Use req.payload.logger for logging visibility in cms
  void fetch(`${botUrl}/api/describe-media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    body: JSON.stringify({ mediaId: doc.id, force: false }),
    signal: AbortSignal.timeout(5_000), // chỉ chờ accept, bot xử lý async
  })
    .then((res) => {
      if (res.ok || res.status === 202) {
        req.payload.logger.info(
          `[AutoDescribe] queued media#${doc.id} (${doc.filename}) for bot`,
        );
      } else {
        req.payload.logger.warn(
          `[AutoDescribe] bot returned ${res.status} for media#${doc.id}`,
        );
      }
    })
    .catch((err) => {
      req.payload.logger.warn(
        `[AutoDescribe] failed to reach bot for media#${doc.id}: ${err}`,
      );
    });

  return doc;
};
