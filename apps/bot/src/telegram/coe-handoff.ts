/**
 * Hand-off khi COE (Certificate of Eligibility) về tay TLG.
 *
 * Trigger: Payload hook trackCoeReceived khi `Contracts.coeReceivedAt`
 * transition từ null → set.
 *
 * Hành động:
 *   1. Resolve worker + topic `jp_departure` (W7 — Xuất cảnh).
 *   2. Bắn message thông báo vào topic.
 *   3. Tạo 3 reminder timeline đặt vé:
 *      - T+1d 09:00: Nộp visa ĐSQ Nhật cho LĐ.
 *      - T+8d 09:00: Check visa có chưa → đặt vé bay.
 *      - T+18d 09:00: Confirm vé + báo người đón Nhật.
 */
import { payload } from "../payload/client.js";
import { logger } from "../utils/logger.js";

interface CoeReceivedArgs {
  contractId: string;
  contractCode?: string;
  workerId: string;
  orderId?: string;
  coeReceivedAt: string;
}

interface WorkerRow {
  id: string;
  workerCode?: string;
  fullName?: string;
  market?: string;
}
interface AgentRow {
  id: string;
  displayName?: string;
}
interface TopicRow {
  id: string;
  telegramGroup: string | { telegramChatId?: string };
  topicId: string;
}

const DEPARTURE_AGENT = "jp_departure";

function atNineLocal(baseIso: string, addDays: number): string {
  // Lấy ngày phần date của coeReceivedAt + addDays, set 09:00:00+07:00.
  const base = new Date(baseIso);
  base.setUTCDate(base.getUTCDate() + addDays);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}T09:00:00+07:00`;
}

async function findDepartureTopic(): Promise<{ chatId: string; threadId: string } | null> {
  const aRes = await payload.request<{ docs: AgentRow[] }>(`/api/agents`, {
    query: { where: { name: { equals: DEPARTURE_AGENT } }, limit: 1, depth: 0 },
  });
  if (aRes.docs.length === 0) return null;
  const tRes = await payload.request<{ docs: TopicRow[] }>(`/api/telegram-topics`, {
    query: { where: { agent: { equals: aRes.docs[0].id } }, limit: 1, depth: 1 },
  });
  if (tRes.docs.length === 0) return null;
  const t = tRes.docs[0];
  const chatId = typeof t.telegramGroup === "object" ? t.telegramGroup.telegramChatId : undefined;
  if (!chatId) return null;
  return { chatId, threadId: t.topicId };
}

async function sendMsg(chatId: string, threadId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const body = JSON.stringify({
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    message_thread_id: Number(threadId),
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return;
      const txt = await res.text().catch(() => "");
      logger.warn("CoeHandoff", `sendMsg HTTP ${res.status} (attempt ${attempt}): ${txt.slice(0, 200)}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return;
    } catch (e) {
      logger.warn("CoeHandoff", `sendMsg fetch error (attempt ${attempt}): ${e}`);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

async function createReminder(input: {
  title: string;
  description?: string;
  dueAt: string;
  chatId: string;
  workerId: string;
  orderId?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    dueAt: input.dueAt,
    recipientType: "chat",
    recipientChatId: input.chatId,
    status: "pending",
    relatedWorker: input.workerId,
  };
  if (input.orderId) body.relatedOrder = input.orderId;
  try {
    await payload.request("/api/reminders", { method: "POST", body });
  } catch (e) {
    logger.warn("CoeHandoff", `createReminder fail: ${e}`);
  }
}

export async function handleCoeReceived(args: CoeReceivedArgs): Promise<void> {
  // 1. Lookup worker
  let worker: WorkerRow | null = null;
  try {
    const w = await payload.request<WorkerRow>(`/api/workers/${encodeURIComponent(args.workerId)}`, {
      query: { depth: 0 },
    });
    worker = w;
  } catch (e) {
    logger.warn("CoeHandoff", `lookup worker ${args.workerId} fail: ${e}`);
  }

  // Chỉ chạy timeline cho thị trường Nhật.
  if (worker?.market && worker.market !== "jp") {
    logger.debug("CoeHandoff", `worker ${worker.workerCode} market=${worker.market} — skip`);
    return;
  }

  // 2. Topic jp_departure
  const target = await findDepartureTopic();
  if (!target) {
    logger.info("CoeHandoff", `agent ${DEPARTURE_AGENT} chưa map TelegramTopic — vẫn tạo reminder?`);
  }

  const fullName = worker?.fullName ?? "?";
  const workerCode = worker?.workerCode ?? args.workerId;
  const contractRef = args.contractCode ?? `#${args.contractId}`;

  // 3. Thông báo
  if (target) {
    const dateStr = args.coeReceivedAt.slice(0, 10);
    const msg =
      `🎫 **COE đã về cho LĐ ${fullName}** (${workerCode})\n\n` +
      `📄 HĐ: ${contractRef}\n` +
      `📅 COE nhận: ${dateStr}\n\n` +
      `Timeline đặt vé đã được lên lịch tự động:\n` +
      `• T+1: Nộp visa ĐSQ Nhật\n` +
      `• T+8: Check visa, đặt vé\n` +
      `• T+18: Confirm vé + người đón`;
    await sendMsg(target.chatId, target.threadId, msg);
  }

  // 4. 3 reminders
  if (target) {
    const titlePrefix = `[${workerCode}] ${fullName}`;
    await createReminder({
      title: `${titlePrefix}: Nộp visa ĐSQ Nhật`,
      description: `COE đã về ngày ${args.coeReceivedAt.slice(0, 10)}. Mang LĐ + COE + hồ sơ tới ĐSQ Nhật (Hà Nội/TP.HCM) nộp xin visa.`,
      dueAt: atNineLocal(args.coeReceivedAt, 1),
      chatId: target.chatId,
      workerId: args.workerId,
      orderId: args.orderId,
    });
    await createReminder({
      title: `${titlePrefix}: Check visa + đặt vé bay`,
      description: `Visa thường có sau 5-7 ngày làm việc. Nếu visa đã có → liên hệ đại lý đặt vé bay theo lịch đối tác.`,
      dueAt: atNineLocal(args.coeReceivedAt, 8),
      chatId: target.chatId,
      workerId: args.workerId,
      orderId: args.orderId,
    });
    await createReminder({
      title: `${titlePrefix}: Confirm vé + báo người đón`,
      description: `Confirm số hiệu chuyến bay vào Contract.flightNumber + Contract.deploymentDate. Liên hệ đối tác Nhật xác nhận người đón sân bay. Nhắc LĐ + phụ huynh.`,
      dueAt: atNineLocal(args.coeReceivedAt, 18),
      chatId: target.chatId,
      workerId: args.workerId,
      orderId: args.orderId,
    });
  }

  logger.info(
    "CoeHandoff",
    `${workerCode}: COE ${args.coeReceivedAt.slice(0, 10)} → 3 reminders + notify ${DEPARTURE_AGENT}`,
  );
}
