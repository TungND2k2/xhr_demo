import type { CollectionAfterChangeHook } from "payload";

/**
 * Khi admin edit Agent + thêm/sửa items trong `telegramBindings`, hook
 * tự upsert TelegramGroup + TelegramTopic và set Topic.agent = self.
 *
 * Mục tiêu: admin chỉ làm 1 thao tác trong Agent — nhập chatId + topicId
 * — thay vì phải mở 3 collection riêng.
 *
 * Hook KHÔNG xoá binding cũ khi admin remove item khỏi array (avoid
 * accidentally unbind manual mappings). Admin tự vào telegram-topics
 * unbind nếu muốn.
 */
type BindingItem = {
  chatId?: string;
  topicId?: string;
  title?: string;
};

export const syncAgentTelegramBindings: CollectionAfterChangeHook = async ({
  doc,
  req,
}) => {
  const bindings: BindingItem[] = Array.isArray(doc?.telegramBindings)
    ? doc.telegramBindings
    : [];
  if (bindings.length === 0) return doc;

  for (const b of bindings) {
    const chatId = b?.chatId?.toString().trim();
    const topicId = b?.topicId?.toString().trim();
    if (!chatId || !topicId) continue;

    try {
      // 1. Upsert TelegramGroup by chatId.
      const groupRes = await req.payload.find({
        collection: "telegram-groups",
        where: { telegramChatId: { equals: chatId } },
        limit: 1,
        depth: 0,
      });
      let groupId: string;
      if (groupRes.docs.length > 0) {
        groupId = String(groupRes.docs[0].id);
      } else {
        const created = await req.payload.create({
          collection: "telegram-groups",
          data: {
            telegramChatId: chatId,
            title: b.title ?? `Group ${chatId}`,
            type: "supergroup",
            active: true,
          },
        });
        groupId = String(created.id);
      }

      // 2. Upsert TelegramTopic by (group, topicId).
      const topicRes = await req.payload.find({
        collection: "telegram-topics",
        where: {
          and: [
            { telegramGroup: { equals: groupId } },
            { topicId: { equals: topicId } },
          ],
        },
        limit: 1,
        depth: 0,
      });

      if (topicRes.docs.length > 0) {
        await req.payload.update({
          collection: "telegram-topics",
          id: String(topicRes.docs[0].id),
          data: {
            agent: doc.id,
            title: b.title ?? topicRes.docs[0].title,
            active: true,
          },
        });
      } else {
        await req.payload.create({
          collection: "telegram-topics",
          data: {
            telegramGroup: groupId,
            topicId,
            title: b.title ?? `Topic ${topicId}`,
            agent: doc.id,
            active: true,
          },
        });
      }
    } catch (err) {
      req.payload.logger.warn(
        `syncAgentTelegramBindings(${doc?.name ?? doc?.id}): binding (${chatId}, ${topicId}) failed — ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  return doc;
};
