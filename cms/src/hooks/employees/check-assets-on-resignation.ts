import type { CollectionAfterChangeHook } from "payload";

/**
 * Khi Employee chuyển sang `resigned` / `fired` / `suspended` → query tất cả
 * Assets đang gán cho user của nhân viên đó → tạo Reminder cho HCNS (role=
 * manager) liệt kê danh sách + nhắc thu hồi.
 *
 * Yêu cầu HCNS Quản lý tài sản — item #4 buổi họp 18/06/2026.
 *
 * Bot tool `bulk_release_assets({employeeId})` để HCNS xoá assignedTo + đổi
 * status='in_stock' sau khi thu hồi xong.
 */
const TRIGGER_STATUSES = new Set(["resigned", "fired", "suspended"]);

interface AssetLite {
  id: string;
  assetCode?: string;
  name?: string;
  category?: string;
  status?: string;
}

export const checkAssetsOnResignation: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== "update") return doc;

  const prev = previousDoc?.status as string | undefined;
  const next = doc?.status as string | undefined;
  if (!next || prev === next) return doc;
  if (!TRIGGER_STATUSES.has(next)) return doc;

  // Resolve user account của nhân viên này. assignedTo trên Assets gán theo
  // `users`, không phải `employees` → cần map qua Employee.userAccount.
  const userAccountRef = doc.userAccount as unknown;
  let userId: string | null = null;
  if (userAccountRef && typeof userAccountRef === "object") {
    userId = String((userAccountRef as { id?: string }).id ?? "");
  } else if (typeof userAccountRef === "string") {
    userId = userAccountRef;
  }

  if (!userId) {
    req.payload.logger.info(
      `[asset-recovery] employee ${doc.id} (${doc.fullName}) chuyển sang ${next} nhưng KHÔNG có userAccount — bỏ qua.`,
    );
    return doc;
  }

  // Query assets active (in_use / repairing) gán cho user này.
  let assets: AssetLite[] = [];
  try {
    const res = await req.payload.find({
      collection: "assets",
      where: {
        and: [
          { assignedTo: { equals: userId } },
          { status: { in: ["in_use", "repairing"] } },
        ],
      },
      limit: 200,
      depth: 0,
    });
    assets = res.docs as AssetLite[];
  } catch (e) {
    req.payload.logger.warn(
      `[asset-recovery] query assets failed for employee ${doc.id}: ${e instanceof Error ? e.message : e}`,
    );
    return doc;
  }

  if (assets.length === 0) {
    req.payload.logger.info(
      `[asset-recovery] employee ${doc.id} (${doc.fullName}) chuyển sang ${next} — không có tài sản cần thu hồi.`,
    );
    return doc;
  }

  // Tạo reminder cho HCNS / managers
  const statusLabel =
    next === "resigned" ? "đã nghỉ việc"
    : next === "fired" ? "bị sa thải"
    : "tạm hoãn công việc";

  const list = assets
    .map((a, i) => `${i + 1}. ${a.assetCode ?? "(không mã)"} — ${a.name ?? "(không tên)"}`)
    .join("\n");

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 1); // hạn thu hồi trong 1 ngày

  try {
    await req.payload.create({
      collection: "reminders",
      data: {
        title: `🔄 Thu hồi tài sản: ${doc.fullName ?? doc.employeeCode} (${assets.length} TS)`,
        description:
          `Nhân viên ${doc.fullName ?? "(không tên)"} (${doc.employeeCode ?? "?"}) ${statusLabel}.\n` +
          `Cần thu hồi ${assets.length} tài sản đang gán:\n\n${list}\n\n` +
          `Sau khi thu hồi xong, dùng trợ lý AI: "bulk release tài sản của nhân viên ${doc.employeeCode}" ` +
          `để hệ thống tự cập nhật trạng thái về kho.`,
        dueAt: dueAt.toISOString(),
        recipientType: "role",
        recipientRole: "manager",
        status: "pending",
        priority: "high",
      },
    });
    req.payload.logger.info(
      `[asset-recovery] tạo reminder thu hồi ${assets.length} tài sản cho employee ${doc.id} (${doc.fullName}).`,
    );
  } catch (e) {
    req.payload.logger.warn(
      `[asset-recovery] tạo reminder thất bại employee ${doc.id}: ${e instanceof Error ? e.message : e}`,
    );
  }

  return doc;
};
