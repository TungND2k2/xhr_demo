/**
 * Hand-off worker status change — khi Worker đổi status, Payload hook gọi
 * bot → bot tìm topic của BƯỚC KẾ TIẾP + bắn vào đó 1 message mô tả việc
 * cần làm cho nhân viên phòng đó.
 *
 * Template được viết theo "human action", không phải log kỹ thuật.
 */
import { payload } from "../payload/client.js";
import { logger } from "../utils/logger.js";

interface StatusChangeArgs {
  workerId: string;
  workerCode?: string;
  fullName?: string;
  market?: string;
  previousStatus: string;
  newStatus: string;
}

/** newStatus → tên agent của bước kế tiếp. */
const STATUS_TO_NEXT_AGENT: Record<string, string> = {
  agreed: "jp_health_check",
  health_check: "jp_training",
  deposit_paid: "jp_training",
  training: "jp_partner_interview",
  exam: "jp_partner_interview",
  passed: "jp_contract",
  contracted: "jp_visa",
  visa_prep: "jp_departure",
  deployed: "jp_post_arrival",
};

interface Template {
  emoji: string;
  title: string;
  context: string;
  actions: string[];
  warning?: string;
}

/** newStatus → message template cho bước kế tiếp. */
const TEMPLATES: Record<string, Template> = {
  agreed: {
    emoji: "✋",
    title: "LĐ vừa đồng ý đi XKLĐ Nhật",
    context: "LĐ đã đồng ý tham gia chương trình. Chuyển sang khâu khám sức khoẻ.",
    actions: [
      "Gọi LĐ xác nhận thông tin liên hệ",
      "Đặt lịch khám tại BV đối tác (Hồng Ngọc / Medlatec / Hà Đông…)",
      "Trước ngày khám 1 hôm: nhắc LĐ + thu xếp xe đưa đón",
    ],
    warning:
      "BÁO TRƯỚC cho LĐ: sau khi pass khám SK sẽ phải nộp cọc 20-30tr VND để vào lớp đào tạo.",
  },
  health_check: {
    emoji: "🏥",
    title: "LĐ đã pass khám sức khoẻ",
    context:
      "LĐ đủ điều kiện sức khoẻ. Cần thu cọc TRƯỚC khi xếp lớp đào tạo.",
    actions: [
      "Phối hợp kế toán THU CỌC (20-30tr) — ghi rõ ngày, số tiền vào Worker.depositAmount + depositDate",
      "Sau khi nhận cọc → set status = `deposit_paid`",
      "Xếp lớp tiếng Nhật + nghề; tạo `trainingGroup`, `trainingStartDate`",
    ],
    warning: "KHÔNG cho vào lớp nếu `depositAmount` còn rỗng.",
  },
  deposit_paid: {
    emoji: "💰",
    title: "LĐ đã nộp cọc — sẵn sàng vào lớp",
    context:
      "Cọc đã thu đủ. Chính thức bắt đầu đào tạo.",
    actions: [
      "Set `trainingGroup`, `trainingStartDate`, `trainingEndDate`",
      "Thêm LĐ vào lớp tương ứng + thông báo lịch học",
      "Update status = `training` khi LĐ chính thức vào lớp",
    ],
  },
  training: {
    emoji: "📚",
    title: "LĐ đã hoàn tất đào tạo nội bộ",
    context:
      "Sẵn sàng để đối tác Nhật phỏng vấn chọn người.",
    actions: [
      "Gửi profile + CV của LĐ cho đối tác Nhật **trước PV 24h** qua email",
      "Đặt lịch PV (online Zoom / offline tại văn phòng đối tác)",
      "Nhắc LĐ trang phục + nội dung PV",
    ],
  },
  exam: {
    emoji: "🎯",
    title: "LĐ đã làm bài thi nội bộ",
    context: "Chuẩn bị bước phỏng vấn đối tác.",
    actions: [
      "Tổng hợp điểm thi → cập nhật `examResult` + `examScore`",
      "Nếu pass → gửi profile cho đối tác đặt lịch PV",
    ],
  },
  passed: {
    emoji: "✅",
    title: "LĐ đã pass phỏng vấn đối tác — chuẩn bị ký HĐ",
    context:
      "Đối tác đã chốt nhận LĐ này. Sang khâu ký hợp đồng + tạo Order chính thức.",
    actions: [
      "Tra Order tương ứng (đối tác + position) — nếu chưa có → tạo Order draft",
      "**Check HĐCU có `cucApprovalStatus = approved` không** — nếu chưa → STOP, ping Anh Long",
      "Soạn HĐLĐ → mời LĐ ký + upload scan vào `Contract.contractFile`",
      "Set Worker status = `contracted`",
    ],
    warning:
      "Order chỉ được advance từ `draft` → `active` sau khi HĐCU đã được Cục QLLĐNN chấp thuận.",
  },
  contracted: {
    emoji: "📜",
    title: "LĐ đã ký HĐLĐ — mở hồ sơ visa",
    context:
      "HĐLĐ ký xong. Chờ đối tác Nhật xin COE rồi nộp ĐSQ.",
    actions: [
      "Tạo reminder 30/60/90 ngày theo dõi COE từ đối tác",
      "**Khi nhận COE** → upload vào `Contract.coeFile` + set `Contract.coeReceivedAt = ngày nhận`",
      "→ Hệ thống tự bắn 3 reminder timeline đặt vé sang W7",
    ],
    warning:
      "Set `coeReceivedAt` NGAY trong ngày COE về — đừng để chậm, hook auto-tạo lịch dựa vào ngày này.",
  },
  visa_prep: {
    emoji: "🛂",
    title: "Visa đã có — sẵn sàng đặt vé",
    context: "LĐ đã có visa Nhật. Lên lịch xuất cảnh.",
    actions: [
      "Gom thành đoàn theo employer + ngày bay",
      "Đặt vé → set `Contract.flightNumber`, `Contract.deploymentDate`, upload `flightTicketFile`",
      "Confirm người đón sân bay với đối tác Nhật",
      "Nhắc LĐ + phụ huynh ngày giờ tập trung sân bay",
    ],
  },
  deployed: {
    emoji: "✈️",
    title: "LĐ đã bay sang Nhật",
    context:
      "LĐ chính thức ở Nhật. Theo dõi định kỳ trong suốt thời gian HĐ.",
    actions: [
      "Tạo reminder check-in 30/90/180/365 ngày",
      "Cập nhật lương / sự cố / kỷ luật vào `Worker.notes`",
      "Báo khẩn nếu LĐ mất liên lạc > 7 ngày",
      "Gần hết HĐ (3 tháng cuối) → liên hệ gia hạn hoặc lo về nước",
    ],
  },
};

interface WorkerDetail {
  id: string;
  workerCode?: string;
  fullName?: string;
  phone?: string;
  dob?: string;
  hometown?: string;
  recruitedBy?: any;
  agreedAt?: string;
  market?: string;
}

interface AgentRow {
  id: string;
  name: string;
  displayName?: string;
}
interface TopicRow {
  id: string;
  telegramGroup: string | { telegramChatId?: string };
  topicId: string;
  agent: string | AgentRow;
}

async function findTopicForAgent(
  agentName: string,
): Promise<{ chatId: string; threadId: string; displayName?: string } | null> {
  const aRes = await payload.request<{ docs: AgentRow[] }>(`/api/agents`, {
    query: { where: { name: { equals: agentName } }, limit: 1, depth: 0 },
  });
  if (aRes.docs.length === 0) return null;
  const agent = aRes.docs[0];

  const tRes = await payload.request<{ docs: TopicRow[] }>(`/api/telegram-topics`, {
    query: { where: { agent: { equals: agent.id } }, limit: 1, depth: 1 },
  });
  if (tRes.docs.length === 0) return null;
  const t = tRes.docs[0];
  const chatId =
    typeof t.telegramGroup === "object" ? t.telegramGroup.telegramChatId : undefined;
  if (!chatId) return null;
  return { chatId, threadId: t.topicId, displayName: agent.displayName };
}

async function fetchWorker(workerId: string): Promise<WorkerDetail | null> {
  try {
    const w = await payload.request<WorkerDetail>(`/api/workers/${encodeURIComponent(workerId)}`, {
      query: { depth: 0 },
    });
    return w;
  } catch {
    return null;
  }
}

function ageFromDob(dob?: string): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return `${age} tuổi`;
}

function buildMessage(
  tpl: Template,
  worker: WorkerDetail | null,
  args: StatusChangeArgs,
  targetDisplayName: string | undefined,
): string {
  // Portal link — nhân viên click mở chi tiết LĐ trên portal (UI thân thiện),
  // không phải /admin (kỹ thuật).
  const portalUrl = process.env.PORTAL_URL ?? "https://x-hr.portal.x-or.cloud";
  const portalLink = `${portalUrl}/workers/${args.workerId}`;
  const name = worker?.fullName ?? args.fullName ?? "?";
  const code = worker?.workerCode ?? args.workerCode ?? args.workerId;
  const phone = worker?.phone ?? "—";
  const age = ageFromDob(worker?.dob);
  const hometown = worker?.hometown ?? "—";

  const lines: string[] = [];
  lines.push(`${tpl.emoji} <b>${tpl.title}</b>`);
  lines.push("");
  lines.push(`👤 <b>${name}</b> (${code})`);
  const meta: string[] = [];
  if (age) meta.push(age);
  if (phone !== "—") meta.push(`📞 ${phone}`);
  if (hometown !== "—") meta.push(`🏠 ${hometown}`);
  if (meta.length) lines.push(`   ${meta.join(" · ")}`);
  lines.push("");
  lines.push(tpl.context);
  lines.push("");
  lines.push(`<b>Việc cần làm tại ${targetDisplayName ?? "phòng này"}:</b>`);
  for (let i = 0; i < tpl.actions.length; i++) {
    lines.push(`  ${i + 1}. ${tpl.actions[i]}`);
  }
  if (tpl.warning) {
    lines.push("");
    lines.push(`⚠ ${tpl.warning}`);
  }
  lines.push("");
  lines.push(`🔗 Hồ sơ LĐ: ${portalLink}`);

  return lines.join("\n");
}

export async function handleWorkerStatusChanged(args: StatusChangeArgs): Promise<void> {
  const nextAgent = STATUS_TO_NEXT_AGENT[args.newStatus];
  if (!nextAgent) {
    logger.debug("Handoff", `no handoff rule for status=${args.newStatus}`);
    return;
  }
  // TODO: hỗ trợ thị trường khác Nhật (kr/tw/de).
  if (args.market && args.market !== "jp") {
    logger.debug("Handoff", `worker ${args.workerCode} market=${args.market} — chưa support`);
    return;
  }
  const tpl = TEMPLATES[args.newStatus];
  if (!tpl) {
    logger.debug("Handoff", `no template for status=${args.newStatus}`);
    return;
  }
  const target = await findTopicForAgent(nextAgent);
  if (!target) {
    logger.info("Handoff", `agent ${nextAgent} chưa map TelegramTopic — skip`);
    return;
  }

  const worker = await fetchWorker(args.workerId);
  // worker.fullName + phone là source of truth — args chỉ là fallback.
  const finalArgs: StatusChangeArgs = {
    ...args,
    fullName: worker?.fullName ?? args.fullName,
    workerCode: worker?.workerCode ?? args.workerCode,
    market: worker?.market ?? args.market,
  };

  // Sử dụng HTML thẳng (không qua escape lần 2 trong sendMsg vì buildMessage
  // đã build HTML).
  const html = buildMessage(tpl, worker, finalArgs, target.displayName);
  await sendHtml(target.chatId, target.threadId, html);
  logger.info("Handoff", `${finalArgs.workerCode}: ${args.previousStatus}→${args.newStatus} → ${nextAgent}`);

  // BONUS: khi LĐ vừa đồng ý → tạo reminder PRE-WARN cho W3 (kế toán cọc)
  // 5 ngày sau (LĐ thường mất 3-5 ngày khám SK xong). Để kế toán chuẩn bị
  // biên lai, không bị bất ngờ.
  if (args.newStatus === "agreed") {
    await createDepositPreWarn(finalArgs);
  }
}

async function createDepositPreWarn(args: StatusChangeArgs): Promise<void> {
  const w3 = await findTopicForAgent("jp_training");
  if (!w3) return;
  const due = new Date(Date.now() + 5 * 86_400_000);
  due.setUTCHours(2, 0, 0, 0); // 09:00 +07:00
  try {
    await payload.request("/api/reminders", {
      method: "POST",
      body: {
        title: `[${args.workerCode}] ${args.fullName}: Chuẩn bị thu cọc`,
        description:
          `LĐ vừa đồng ý đi XKLĐ Nhật. Sau khi pass khám SK (W2) sẽ chuyển qua W3 thu cọc 20-30tr. ` +
          `Anh/chị kế toán chuẩn bị biên lai trước cho gọn.`,
        dueAt: due.toISOString(),
        recipientType: "chat",
        recipientChatId: w3.chatId,
        status: "pending",
        relatedWorker: args.workerId,
      },
    });
    logger.info("Handoff", `${args.workerCode}: deposit pre-warn reminder created for W3`);
  } catch (e) {
    logger.warn("Handoff", `pre-warn reminder fail: ${e}`);
  }
}

async function sendHtml(chatId: string, threadId: string, html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const body = JSON.stringify({
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    message_thread_id: Number(threadId),
    link_preview_options: { is_disabled: true },
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
      const text = await res.text().catch(() => "");
      logger.warn("Handoff", `sendHtml HTTP ${res.status} (attempt ${attempt}): ${text.slice(0, 200)}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return; // non-retryable
    } catch (e) {
      logger.warn("Handoff", `sendHtml fetch error (attempt ${attempt}): ${e}`);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}
