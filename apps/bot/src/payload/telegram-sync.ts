/**
 * Auto-upsert Telegram identity (TelegramUsers / TelegramGroups /
 * TelegramMembership) trên mỗi message bot nhận. Fire-and-forget — không
 * block message processing.
 *
 * Pattern: find-by-unique-key trước → nếu thấy thì PATCH, không thì POST.
 * Payload không có "upsert" native nên helper xử lý logic này. Race
 * condition (2 message cùng user gần nhau) có thể tạo duplicate; mitigate
 * bằng `unique: true` index ở DB → POST thứ 2 fail, helper retry-find.
 *
 * Helper trả về `{ telegramUserId, telegramGroupId, membershipId }` để
 * caller tham chiếu nếu cần. Không throw — log warning rồi nuốt lỗi.
 */
import { payload, PayloadError } from "./client.js";
import { logger } from "../utils/logger.js";

export interface TgUserPayload {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TgChatPayload {
  id: number;
  type: string;
  title?: string;
}

interface TelegramUserRow {
  id: string;
  telegramUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isBot?: boolean;
  blocked?: boolean;
  messageCount?: number;
}

interface TelegramGroupRow {
  id: string;
  telegramChatId: string;
  title?: string;
  type?: string;
  active?: boolean;
  messageCount?: number;
}

interface TelegramMembershipRow {
  id: string;
  telegramUser?: string | { id: string };
  telegramGroup?: string | { id: string };
  messageCount?: number;
}

interface FindResp<T> {
  docs: T[];
  totalDocs: number;
}

/**
 * Upsert TelegramUser. Trả `{id, blocked}` để caller biết internal ID
 * và có nên skip xử lý message này không.
 */
export async function syncTelegramUser(
  user: TgUserPayload,
): Promise<{ id: string; blocked: boolean } | null> {
  const tgId = String(user.id);
  try {
    // 1. Find existing by unique telegramUserId
    const find = await payload.request<FindResp<TelegramUserRow>>(
      `/api/telegram-users`,
      {
        query: {
          where: { telegramUserId: { equals: tgId } },
          limit: 1,
          depth: 0,
        },
      },
    );

    const nowIso = new Date().toISOString();
    const updateBody: Record<string, unknown> = {
      lastSeenAt: nowIso,
    };
    if (user.username !== undefined) updateBody.username = user.username;
    if (user.first_name !== undefined) updateBody.firstName = user.first_name;
    if (user.last_name !== undefined) updateBody.lastName = user.last_name;

    if (find.docs.length > 0) {
      // 2a. Found → PATCH cập nhật + tăng messageCount
      const existing = find.docs[0];
      updateBody.messageCount = (existing.messageCount ?? 0) + 1;
      try {
        await payload.request(`/api/telegram-users/${existing.id}`, {
          method: "PATCH",
          body: updateBody,
        });
      } catch (err) {
        logger.debug("TgSync", `PATCH user ${tgId} failed: ${err}`);
      }
      return { id: existing.id, blocked: !!existing.blocked };
    }

    // 2b. Not found → POST tạo mới
    const createBody = {
      ...updateBody,
      telegramUserId: tgId,
      isBot: !!user.is_bot,
      messageCount: 1,
    };
    try {
      const created = await payload.request<{ doc: TelegramUserRow }>(
        `/api/telegram-users`,
        { method: "POST", body: createBody },
      );
      logger.info(
        "TgSync",
        `+ user ${tgId} ${user.username ? "@" + user.username : ""}`,
      );
      return { id: created.doc.id, blocked: false };
    } catch (err) {
      // Có thể race: user khác vừa tạo cùng telegramUserId → unique conflict.
      // Retry find 1 lần.
      logger.debug("TgSync", `POST user ${tgId} failed (likely race): ${err}`);
      const retry = await payload.request<FindResp<TelegramUserRow>>(
        `/api/telegram-users`,
        {
          query: {
            where: { telegramUserId: { equals: tgId } },
            limit: 1,
            depth: 0,
          },
        },
      );
      if (retry.docs.length > 0) {
        return { id: retry.docs[0].id, blocked: !!retry.docs[0].blocked };
      }
      return null;
    }
  } catch (err) {
    logger.warn(
      "TgSync",
      `syncTelegramUser ${tgId} failed: ${err instanceof PayloadError ? err.message : err}`,
    );
    return null;
  }
}

/**
 * Upsert TelegramGroup. Chỉ gọi khi chat.type !== 'private'.
 */
export async function syncTelegramGroup(
  chat: TgChatPayload,
): Promise<{ id: string } | null> {
  const tgChatId = String(chat.id);
  try {
    const find = await payload.request<FindResp<TelegramGroupRow>>(
      `/api/telegram-groups`,
      {
        query: {
          where: { telegramChatId: { equals: tgChatId } },
          limit: 1,
          depth: 0,
        },
      },
    );
    const nowIso = new Date().toISOString();

    if (find.docs.length > 0) {
      const existing = find.docs[0];
      const updateBody: Record<string, unknown> = {
        lastActivityAt: nowIso,
        messageCount: (existing.messageCount ?? 0) + 1,
      };
      if (chat.title !== undefined && chat.title !== existing.title) {
        updateBody.title = chat.title;
      }
      try {
        await payload.request(`/api/telegram-groups/${existing.id}`, {
          method: "PATCH",
          body: updateBody,
        });
      } catch (err) {
        logger.debug("TgSync", `PATCH group ${tgChatId} failed: ${err}`);
      }
      return { id: existing.id };
    }

    const createBody = {
      telegramChatId: tgChatId,
      title: chat.title,
      type: chat.type,
      active: true,
      lastActivityAt: nowIso,
      botJoinedAt: nowIso,
      messageCount: 1,
    };
    try {
      const created = await payload.request<{ doc: TelegramGroupRow }>(
        `/api/telegram-groups`,
        { method: "POST", body: createBody },
      );
      logger.info(
        "TgSync",
        `+ group ${tgChatId} "${chat.title ?? "?"}" (${chat.type})`,
      );
      return { id: created.doc.id };
    } catch (err) {
      logger.debug("TgSync", `POST group ${tgChatId} failed (likely race): ${err}`);
      const retry = await payload.request<FindResp<TelegramGroupRow>>(
        `/api/telegram-groups`,
        {
          query: {
            where: { telegramChatId: { equals: tgChatId } },
            limit: 1,
            depth: 0,
          },
        },
      );
      return retry.docs.length > 0 ? { id: retry.docs[0].id } : null;
    }
  } catch (err) {
    logger.warn(
      "TgSync",
      `syncTelegramGroup ${tgChatId} failed: ${err instanceof PayloadError ? err.message : err}`,
    );
    return null;
  }
}

/**
 * Upsert membership. Cần ID nội bộ của TelegramUser + TelegramGroup
 * (gọi sau syncTelegramUser/syncTelegramGroup).
 */
export async function syncTelegramMembership(
  telegramUserDocId: string,
  telegramGroupDocId: string,
): Promise<void> {
  try {
    const find = await payload.request<FindResp<TelegramMembershipRow>>(
      `/api/telegram-membership`,
      {
        query: {
          where: {
            and: [
              { telegramUser: { equals: telegramUserDocId } },
              { telegramGroup: { equals: telegramGroupDocId } },
            ],
          },
          limit: 1,
          depth: 0,
        },
      },
    );
    const nowIso = new Date().toISOString();

    if (find.docs.length > 0) {
      const existing = find.docs[0];
      try {
        await payload.request(`/api/telegram-membership/${existing.id}`, {
          method: "PATCH",
          body: {
            lastSeenAt: nowIso,
            messageCount: (existing.messageCount ?? 0) + 1,
          },
        });
      } catch (err) {
        logger.debug("TgSync", `PATCH membership ${existing.id} failed: ${err}`);
      }
      return;
    }

    try {
      await payload.request(`/api/telegram-membership`, {
        method: "POST",
        body: {
          telegramUser: telegramUserDocId,
          telegramGroup: telegramGroupDocId,
          role: "member",
          joinedAt: nowIso,
          lastSeenAt: nowIso,
          messageCount: 1,
        },
      });
      logger.info(
        "TgSync",
        `+ membership user#${telegramUserDocId} ↔ group#${telegramGroupDocId}`,
      );
    } catch (err) {
      logger.debug("TgSync", `POST membership failed (likely race): ${err}`);
    }
  } catch (err) {
    logger.warn(
      "TgSync",
      `syncTelegramMembership failed: ${err instanceof PayloadError ? err.message : err}`,
    );
  }
}

/**
 * Convenience — gọi 1 lần cho 1 message: sync user (luôn) + group +
 * membership (nếu là group chat). Trả về `blocked` flag nếu user bị
 * admin chặn → caller có thể skip pipeline.
 */
export async function syncOnIncomingMessage(
  user: TgUserPayload,
  chat: TgChatPayload,
): Promise<{ blocked: boolean }> {
  const userResult = await syncTelegramUser(user);
  if (chat.type === "private") {
    return { blocked: userResult?.blocked ?? false };
  }
  const groupResult = await syncTelegramGroup(chat);
  if (userResult && groupResult) {
    void syncTelegramMembership(userResult.id, groupResult.id);
  }
  return { blocked: userResult?.blocked ?? false };
}
