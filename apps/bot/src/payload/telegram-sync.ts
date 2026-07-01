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

interface AgentRow {
  id: string;
  name?: string;
  displayName?: string;
  docs?: string;
  /** 3 schema được support cùng lúc:
   *   1. Legacy: string[] phẳng — agent cũ trước multi-agent
   *   2. Phase 1 multi-agent: { group: string[] } — select hasMany
   *   3. Hiện tại (checkbox): { group: { toolName: boolean } } */
  enabledTools?:
    | string[]
    | Record<string, string[] | Record<string, boolean>>;
  active?: boolean;
}

/** Một số tool có dấu `-` trong tên runtime (vd "list_order-workers"),
 *  nhưng Payload field name không cho phép `-`. Admin tick với tên `_`,
 *  runtime cần convert ngược. */
const TOOL_NAME_ALIASES: Record<string, string> = {
  list_order_workers: "list_order-workers",
  get_order_workers: "get_order-workers",
  create_order_workers: "create_order-workers",
  update_order_workers: "update_order-workers",
  delete_order_workers: "delete_order-workers",
  list_workflow_stages: "list_workflow-stages",
  get_workflow_stages: "get_workflow-stages",
  create_workflow_stages: "create_workflow-stages",
  update_workflow_stages: "update_workflow-stages",
  list_supply_contracts: "list_supply-contracts",
  get_supply_contracts: "get_supply-contracts",
  create_supply_contracts: "create_supply-contracts",
  update_supply_contracts: "update_supply-contracts",
  delete_supply_contracts: "delete_supply-contracts",
  list_official_documents: "list_official-documents",
  get_official_documents: "get_official-documents",
  create_official_documents: "create_official-documents",
  update_official_documents: "update_official-documents",
  delete_official_documents: "delete_official-documents",
};

function resolveToolName(name: string): string {
  return TOOL_NAME_ALIASES[name] ?? name;
}

/** Flatten enabledTools sang string[] tools enabled, hỗ trợ cả 3 schema. */
function flattenEnabledTools(
  raw: AgentRow["enabledTools"],
): string[] | undefined {
  if (!raw) return undefined;

  // Schema 1: legacy flat array
  if (Array.isArray(raw)) return raw.map(resolveToolName);

  const out: string[] = [];
  for (const groupValue of Object.values(raw)) {
    if (Array.isArray(groupValue)) {
      // Schema 2: select hasMany — array of tool names
      for (const name of groupValue) out.push(resolveToolName(name));
    } else if (groupValue && typeof groupValue === "object") {
      // Schema 3: checkbox group — { toolName: boolean }
      for (const [name, enabled] of Object.entries(groupValue)) {
        if (enabled === true) out.push(resolveToolName(name));
      }
    }
  }

  return out.length > 0 ? out : undefined;
}

interface TelegramTopicRow {
  id: string;
  telegramGroup: string | { id: string };
  topicId: string;
  title?: string;
  agent?: string | AgentRow;
  messageCount?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface ResolvedAgent {
  id: string;
  name: string;
  displayName?: string;
  docs?: string;
  enabledTools?: string[];
}

export interface ResolvedTopic {
  id: string;
  agent: ResolvedAgent | null;
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
 * Upsert TelegramTopic. Cần ID nội bộ của TelegramGroup + topicId từ
 * `message_thread_id`. Title lấy từ `forum_topic_created.name` (event
 * create) hoặc giữ giá trị cũ nếu chỉ là tin thường trong topic.
 *
 * Trả `{ id, agentId, agentDocs }` để caller dùng ngay cho pipeline —
 * tránh round-trip thêm.
 */
export async function syncTelegramTopic(
  telegramGroupDocId: string,
  topicId: number,
  titleHint?: string,
): Promise<ResolvedTopic | null> {
  const topicIdStr = String(topicId);
  try {
    const find = await payload.request<FindResp<TelegramTopicRow>>(
      `/api/telegram-topics`,
      {
        query: {
          where: {
            and: [
              { telegramGroup: { equals: telegramGroupDocId } },
              { topicId: { equals: topicIdStr } },
            ],
          },
          limit: 1,
          depth: 1, // resolve agent relationship để lấy docs
        },
      },
    );
    const nowIso = new Date().toISOString();

    if (find.docs.length > 0) {
      const existing = find.docs[0];
      const updateBody: Record<string, unknown> = {
        lastSeenAt: nowIso,
        messageCount: (existing.messageCount ?? 0) + 1,
      };
      // Cập nhật title nếu Telegram gửi event create topic — chỉ overwrite
      // khi title hiện tại là placeholder mặc định.
      if (titleHint && (!existing.title || existing.title === topicIdStr)) {
        updateBody.title = titleHint;
      }
      void payload
        .request(`/api/telegram-topics/${existing.id}`, {
          method: "PATCH",
          body: updateBody,
        })
        .catch((err) => logger.debug("TgSync", `PATCH topic ${existing.id} failed: ${err}`));

      const agentField = existing.agent;
      const agentObj =
        typeof agentField === "object" && agentField !== null ? agentField : null;
      // Chỉ trả agent khi nó được populate đầy đủ (depth:1) và đang active
      const resolvedAgent: ResolvedAgent | null =
        agentObj && agentObj.id && agentObj.active !== false
          ? {
              id: agentObj.id,
              name: agentObj.name ?? agentObj.id,
              displayName: agentObj.displayName,
              docs: agentObj.docs,
              enabledTools: flattenEnabledTools(agentObj.enabledTools),
            }
          : null;
      return { id: existing.id, agent: resolvedAgent };
    }

    // Topic mới — tạo record, agent để trống cho admin map sau
    try {
      const created = await payload.request<{ doc: TelegramTopicRow }>(
        `/api/telegram-topics`,
        {
          method: "POST",
          body: {
            telegramGroup: telegramGroupDocId,
            topicId: topicIdStr,
            title: titleHint ?? `Topic ${topicIdStr}`,
            active: true,
            firstSeenAt: nowIso,
            lastSeenAt: nowIso,
            messageCount: 1,
          },
        },
      );
      logger.info(
        "TgSync",
        `+ topic group#${telegramGroupDocId}/${topicIdStr} "${titleHint ?? "?"}"`,
      );
      return { id: created.doc.id, agent: null };
    } catch (err) {
      logger.debug("TgSync", `POST topic failed (likely race): ${err}`);
      const retry = await payload.request<FindResp<TelegramTopicRow>>(
        `/api/telegram-topics`,
        {
          query: {
            where: {
              and: [
                { telegramGroup: { equals: telegramGroupDocId } },
                { topicId: { equals: topicIdStr } },
              ],
            },
            limit: 1,
            depth: 1,
          },
        },
      );
      if (retry.docs.length > 0) {
        const existing = retry.docs[0];
        const agentField = existing.agent;
        const agentObj =
          typeof agentField === "object" && agentField !== null ? agentField : null;
        const resolvedAgent: ResolvedAgent | null =
          agentObj && agentObj.id && agentObj.active !== false
            ? {
                id: agentObj.id,
                name: agentObj.name ?? agentObj.id,
                displayName: agentObj.displayName,
                docs: agentObj.docs,
                enabledTools: flattenEnabledTools(agentObj.enabledTools),
              }
            : null;
        return { id: existing.id, agent: resolvedAgent };
      }
      return null;
    }
  } catch (err) {
    logger.warn(
      "TgSync",
      `syncTelegramTopic group#${telegramGroupDocId}/${topicIdStr} failed: ${err instanceof PayloadError ? err.message : err}`,
    );
    return null;
  }
}

/**
 * Read-only lookup — không upsert, chỉ tra cứu agent đã gán cho (chatId,
 * topicId). Dùng trong processMessage để biết route message tới agent
 * nào. Nếu topic chưa được sync hoặc chưa được map agent → trả null
 * (caller fallback default agent).
 */
export async function lookupAgentForMessage(
  chatId: number,
  topicId?: number,
): Promise<ResolvedAgent | null> {
  if (!topicId) return null;
  try {
    // 1. Find group by chatId
    const groupRes = await payload.request<FindResp<TelegramGroupRow>>(
      `/api/telegram-groups`,
      {
        query: {
          where: { telegramChatId: { equals: String(chatId) } },
          limit: 1,
          depth: 0,
        },
      },
    );
    if (groupRes.docs.length === 0) return null;
    const groupDocId = groupRes.docs[0].id;

    // 2. Find topic by (group, topicId), populate agent
    const topicRes = await payload.request<FindResp<TelegramTopicRow>>(
      `/api/telegram-topics`,
      {
        query: {
          where: {
            and: [
              { telegramGroup: { equals: groupDocId } },
              { topicId: { equals: String(topicId) } },
            ],
          },
          limit: 1,
          depth: 1,
        },
      },
    );
    if (topicRes.docs.length === 0) return null;

    const agentField = topicRes.docs[0].agent;
    if (typeof agentField !== "object" || agentField === null) return null;
    if (agentField.active === false) return null;
    return {
      id: agentField.id,
      name: agentField.name ?? agentField.id,
      displayName: agentField.displayName,
      docs: agentField.docs,
      enabledTools: flattenEnabledTools(agentField.enabledTools),
    };
  } catch (err) {
    logger.debug("TgSync", `lookupAgentForMessage failed: ${err}`);
    return null;
  }
}

/**
 * Convenience — gọi 1 lần cho 1 message: sync user (luôn) + group +
 * membership + topic (nếu có message_thread_id). Trả về `blocked` flag +
 * `topic` info (agent assigned) để caller dùng cho pipeline routing.
 */
export async function syncOnIncomingMessage(
  user: TgUserPayload,
  chat: TgChatPayload,
  message?: {
    message_thread_id?: number;
    forum_topic_created?: { name: string };
  },
): Promise<{
  blocked: boolean;
  topic: ResolvedTopic | null;
}> {
  const userResult = await syncTelegramUser(user);
  if (chat.type === "private") {
    return { blocked: userResult?.blocked ?? false, topic: null };
  }
  const groupResult = await syncTelegramGroup(chat);
  if (userResult && groupResult) {
    void syncTelegramMembership(userResult.id, groupResult.id);
  }

  // Topic sync — chỉ khi có thread_id (Forum mode)
  let topicResult: Awaited<ReturnType<typeof syncTelegramTopic>> = null;
  if (groupResult && message?.message_thread_id) {
    topicResult = await syncTelegramTopic(
      groupResult.id,
      message.message_thread_id,
      message.forum_topic_created?.name,
    );
  }

  return {
    blocked: userResult?.blocked ?? false,
    topic: topicResult,
  };
}
