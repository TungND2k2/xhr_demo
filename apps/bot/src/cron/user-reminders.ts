/**
 * Cron job quét bảng `reminders` của Payload mỗi phút:
 *  - lấy các bản ghi `status=pending && dueAt <= now && (snoozeUntil IS
 *    null OR snoozeUntil <= now)`
 *  - resolve recipient (user cụ thể, hoặc tất cả user thuộc 1 role)
 *  - DM Telegram cho từng user có `telegramUserId`
 *  - PATCH status='sent' + sentAt để không gửi lại
 *
 * Khác `runOrderReminders` (auto theo workflow stage), file này phục vụ
 * lịch nhắc tự do — CEO đặt qua bot ("nhắc tôi 9h gọi đối tác Toyota"),
 * hoặc admin tạo trong Payload portal.
 */
import { payload, PayloadError } from "../payload/client.js";
import { logger } from "../utils/logger.js";
import type { TelegramChannel } from "../telegram/channel.js";

interface UserDoc {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  telegramUserId?: string;
}

interface ReminderDoc {
  id: string;
  title: string;
  description?: string;
  dueAt: string;
  recipientType: "chat" | "user" | "role" | "telegram_user";
  recipientChatId?: string;
  recipientUser?: string | UserDoc;
  recipientRole?: string;
  recipientTelegramUserId?: string;
  status: "pending" | "sent" | "dismissed";
  snoozeUntil?: string;
  relatedOrder?: string | { id: string; orderCode?: string };
  relatedWorker?: string | { id: string; workerCode?: string };
}

interface PayloadFindResponse<T> {
  docs: T[];
  totalDocs: number;
}

function fmtRelated(rem: ReminderDoc): string {
  const bits: string[] = [];
  if (rem.relatedOrder) {
    const code =
      typeof rem.relatedOrder === "string"
        ? rem.relatedOrder
        : rem.relatedOrder.orderCode ?? rem.relatedOrder.id;
    bits.push(`📦 Đơn ${code}`);
  }
  if (rem.relatedWorker) {
    const code =
      typeof rem.relatedWorker === "string"
        ? rem.relatedWorker
        : rem.relatedWorker.workerCode ?? rem.relatedWorker.id;
    bits.push(`👤 LĐ ${code}`);
  }
  return bits.length > 0 ? `\n${bits.join(" · ")}` : "";
}

function buildMessage(rem: ReminderDoc): string {
  const lines: string[] = [`🔔 *${rem.title}*`];
  if (rem.description?.trim()) lines.push("", rem.description.trim());
  const related = fmtRelated(rem);
  if (related) lines.push(related);
  return lines.join("\n");
}

/**
 * Resolve "chatIds to send" — 1 reminder có thể bắn về 1 hoặc nhiều chat.
 * Hỗ trợ 4 dạng recipient:
 *  - "chat": bắn thẳng vào recipientChatId (DM với user nếu chatId dương,
 *    hoặc vào group/supergroup nếu chatId âm). Đây là default cho khi user
 *    nhờ bot trong group — reminder bắn lại đúng group đó.
 *  - "user": tra cứu users collection → lấy users.telegramUserId (DM)
 *  - "telegram_user": dùng trực tiếp recipientTelegramUserId (DM)
 *  - "role": broadcast tất cả users.role=X (DM cho từng user)
 *
 * Trả về list { chatId, label } để cron loop send.
 */
async function resolveChatTargets(
  rem: ReminderDoc,
): Promise<Array<{ chatId: number; label: string }>> {
  if (rem.recipientType === "chat") {
    if (!rem.recipientChatId) return [];
    const chatId = Number(rem.recipientChatId);
    if (!Number.isFinite(chatId)) return [];
    return [{ chatId, label: `chat ${rem.recipientChatId}` }];
  }
  if (rem.recipientType === "telegram_user") {
    if (!rem.recipientTelegramUserId) return [];
    const chatId = Number(rem.recipientTelegramUserId);
    if (!Number.isFinite(chatId)) return [];
    return [{ chatId, label: `tg user ${rem.recipientTelegramUserId}` }];
  }
  if (rem.recipientType === "user") {
    if (!rem.recipientUser) return [];
    const userId =
      typeof rem.recipientUser === "string" ? rem.recipientUser : rem.recipientUser.id;
    if (!userId) return [];
    try {
      const user = await payload.request<UserDoc>(`/api/users/${userId}`);
      if (!user.telegramUserId) return [];
      const chatId = Number(user.telegramUserId);
      if (!Number.isFinite(chatId)) return [];
      return [{ chatId, label: user.email }];
    } catch (err) {
      logger.debug("UserReminder", `lookup user ${userId} failed: ${err}`);
      return [];
    }
  }
  if (rem.recipientType === "role") {
    if (!rem.recipientRole) return [];
    try {
      const res = await payload.request<PayloadFindResponse<UserDoc>>(`/api/users`, {
        query: { where: { role: { equals: rem.recipientRole } }, limit: 50 },
      });
      const out: Array<{ chatId: number; label: string }> = [];
      for (const u of res.docs) {
        if (!u.telegramUserId) continue;
        const chatId = Number(u.telegramUserId);
        if (!Number.isFinite(chatId)) continue;
        out.push({ chatId, label: u.email });
      }
      return out;
    } catch (err) {
      logger.debug("UserReminder", `lookup role=${rem.recipientRole} failed: ${err}`);
      return [];
    }
  }
  return [];
}

export interface UserReminderRunOptions {
  telegram: TelegramChannel;
  /** Fallback chat khi recipient không có user nào có telegramUserId. */
  adminChatId?: number;
}

export async function runUserReminders({
  telegram,
  adminChatId,
}: UserReminderRunOptions): Promise<string> {
  const start = Date.now();
  const nowIso = new Date().toISOString();
  let sentTotal = 0;
  let processed = 0;

  try {
    // Bộ filter: dueAt <= now và (snoozeUntil không có OR snoozeUntil <= now)
    // Payload where syntax không có OR-NULL trực tiếp → 2 query nhỏ + concat,
    // hoặc fetch all pending due by dueAt rồi filter snoozeUntil ở JS. Vì
    // số reminders pending thường ≤ 100, filter JS đơn giản hơn.
    const res = await payload.request<PayloadFindResponse<ReminderDoc>>(
      `/api/reminders`,
      {
        query: {
          where: {
            and: [
              { status: { equals: "pending" } },
              { dueAt: { less_than_equal: nowIso } },
            ],
          },
          limit: 100,
          depth: 0,
        },
      },
    );

    for (const rem of res.docs) {
      processed += 1;
      if (rem.snoozeUntil && rem.snoozeUntil > nowIso) continue;

      const targets = await resolveChatTargets(rem);
      const text = buildMessage(rem);

      if (targets.length === 0 && adminChatId) {
        await telegram.sendMessage(adminChatId, `[fallback] ${text}`);
        sentTotal += 1;
      }

      for (const t of targets) {
        try {
          await telegram.sendMessage(t.chatId, text);
          sentTotal += 1;
          logger.info(
            "UserReminder",
            `→ ${t.label} (chat ${t.chatId}): "${rem.title.slice(0, 60)}"`,
          );
        } catch (err) {
          logger.warn(
            "UserReminder",
            `send to ${t.label} (chat ${t.chatId}) failed: ${err}`,
          );
        }
      }

      // Mark sent (kể cả khi không có recipient — tránh loop mỗi phút)
      try {
        await payload.request(`/api/reminders/${rem.id}`, {
          method: "PATCH",
          body: { status: "sent", sentAt: new Date().toISOString() },
        });
      } catch (err) {
        logger.warn("UserReminder", `PATCH sent on ${rem.id} failed: ${err}`);
      }
    }

    if (sentTotal > 0 || processed > 0) {
      logger.info(
        "UserReminder",
        `scan done in ${Date.now() - start}ms — ${processed} due, ${sentTotal} DMs sent`,
      );
    }
    return ""; // Không spam admin với log; đã có file log.
  } catch (err) {
    if (err instanceof PayloadError) {
      logger.error("UserReminder", `payload error: ${err.message}`);
    } else {
      logger.error("UserReminder", `failed: ${err}`);
    }
    return "";
  }
}
