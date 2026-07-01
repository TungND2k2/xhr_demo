/**
 * One-shot: gán agent vào 10 TelegramTopic của group "Thịnh Long - Phòng Japan".
 *
 * Idempotent: chạy lại không phá; chỉ patch nếu agent hiện tại khác mong muốn.
 *
 * Usage:
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/seed-jp-topic-mapping.js
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

const JP_CHAT_ID = "-1003764593275";

/** topicId (string) → agent.name */
const MAPPING: Record<string, string> = {
  "21": "jp_recruitment",
  "22": "jp_health_check",
  "23": "jp_training",
  "24": "jp_partner_interview",
  "25": "jp_contract",
  "26": "jp_visa",
  "27": "jp_departure",
  "28": "jp_post_arrival",
  "29": "jp_order_manager",
  "30": "jp_dept_head",
};

interface GroupRow {
  id: string;
  telegramChatId?: string;
}
interface AgentRow {
  id: string;
  name: string;
}
interface TopicRow {
  id: string;
  topicId: string;
  agent?: string | AgentRow | null;
}

async function findGroupId(): Promise<string | null> {
  const r = await payload.request<{ docs: GroupRow[] }>(`/api/telegram-groups`, {
    query: { where: { telegramChatId: { equals: JP_CHAT_ID } }, limit: 1, depth: 0 },
  });
  return r.docs[0]?.id ?? null;
}

async function findAgentId(name: string): Promise<string | null> {
  const r = await payload.request<{ docs: AgentRow[] }>(`/api/agents`, {
    query: { where: { name: { equals: name } }, limit: 1, depth: 0 },
  });
  return r.docs[0]?.id ?? null;
}

async function findTopic(groupId: string, topicId: string): Promise<TopicRow | null> {
  const r = await payload.request<{ docs: TopicRow[] }>(`/api/telegram-topics`, {
    query: {
      where: {
        and: [
          { telegramGroup: { equals: groupId } },
          { topicId: { equals: topicId } },
        ],
      },
      limit: 1,
      depth: 0,
    },
  });
  return r.docs[0] ?? null;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Seed", `▶▶▶ Map 10 JP topic → agent (chatId=${JP_CHAT_ID})`);

  const groupId = await findGroupId();
  if (!groupId) {
    logger.error("Seed", `! TelegramGroup chatId=${JP_CHAT_ID} không tồn tại trong DB`);
    process.exit(1);
  }
  logger.info("Seed", `  group#${groupId}`);

  const stats = { ok: 0, patched: 0, missing_topic: 0, missing_agent: 0, failed: 0 };

  for (const [topicId, agentName] of Object.entries(MAPPING)) {
    try {
      const [topic, agentId] = await Promise.all([
        findTopic(groupId, topicId),
        findAgentId(agentName),
      ]);

      if (!agentId) {
        logger.warn("Seed", `  ✗ topic ${topicId}: agent "${agentName}" không tồn tại`);
        stats.missing_agent += 1;
        continue;
      }
      if (!topic) {
        logger.warn("Seed", `  ✗ topic ${topicId}: chưa có record TelegramTopic`);
        stats.missing_topic += 1;
        continue;
      }

      const currentAgentId =
        typeof topic.agent === "object" ? topic.agent?.id : topic.agent;

      if (String(currentAgentId) === String(agentId)) {
        logger.info("Seed", `  · topic ${topicId} → ${agentName} (already)`);
        stats.ok += 1;
        continue;
      }

      await payload.request(`/api/telegram-topics/${encodeURIComponent(topic.id)}`, {
        method: "PATCH",
        body: { agent: agentId },
      });
      logger.info("Seed", `  ↻ topic ${topicId} → ${agentName} (patched)`);
      stats.patched += 1;
    } catch (e) {
      const reason = e instanceof PayloadError ? e.message : String(e);
      logger.error("Seed", `  ✗ topic ${topicId} → ${agentName} failed: ${reason}`);
      stats.failed += 1;
    }
  }

  logger.info("Seed", "");
  logger.info("Seed", "╔═══════════════════════════════════════╗");
  logger.info("Seed", "║ DONE");
  logger.info("Seed", `║   already mapped: ${stats.ok}`);
  logger.info("Seed", `║   patched:        ${stats.patched}`);
  logger.info("Seed", `║   missing topic:  ${stats.missing_topic}`);
  logger.info("Seed", `║   missing agent:  ${stats.missing_agent}`);
  logger.info("Seed", `║   failed:         ${stats.failed}`);
  logger.info("Seed", "╚═══════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
