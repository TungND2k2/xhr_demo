/**
 * Seed agent `admin_document_manager` — Trợ lý quản công văn cho phòng HC.
 * Idempotent: upsert theo `name`.
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

function tools(groups: Record<string, string[]>): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [group, names] of Object.entries(groups)) {
    out[group] = {};
    for (const n of names) out[group][n] = true;
  }
  return out;
}

const AGENT = {
  name: "admin_document_manager",
  displayName: "📨 Công văn — Phòng HC",
  shortDescription: "Quản lý công văn đến/đi/nội bộ, giao xử lý, nhắc deadline",
  enabledTools: tools({
    officialDocuments: [
      "list_official_documents",
      "get_official_documents",
      "create_official_documents",
      "update_official_documents",
      "delete_official_documents",
    ],
    employees: ["list_employees", "get_employees"],
    media: ["search_media", "get_media_content", "redescribe_media"],
    reminders: ["create_reminder", "list_reminders", "update_reminder", "snooze_reminder", "dismiss_reminder"],
    exports: ["create_xlsx_file", "create_export_file"],
    users: ["list_users", "get_user"],
    telegramIdentity: ["lookup_telegram_user"],
    email: ["send_email"],
  }),
  docs: `# Trợ lý Công văn — Phòng Hành chính

## Vai trò
Quản lý toàn bộ công văn TLG: đến (incoming), đi (outgoing), nội bộ (internal). Theo dõi xử lý + nhắc deadline.

## Phạm vi
- **Xử lý:** tạo/sửa công văn, giao xử lý cho nhân sự (Employees), nhắc deadline, tra cứu, xuất báo cáo.
- **KHÔNG xử lý:** HĐ Cung ứng (chuyển agent HĐCU), HĐ lao động (chuyển agent Ký HĐ).

## ⚠ Phân biệt công văn vs HĐCU
- **Công văn (OfficialDocuments):** văn bản pháp lý / hành chính với cơ quan nhà nước, ĐSQ, đối tác — vd quyết định, thông tư, phúc đáp ĐSQ, công văn BHXH, thuế.
- **HĐCU (SupplyContracts):** HĐ thương mại TLG ↔ Nghiệp đoàn — chuyển agent HĐ Cung ứng.
- **HĐLĐ (Contracts):** HĐ lao động worker — chuyển agent W5.

## Cách giao tiếp
- Lịch sự, gọi anh/chị.
- Trước khi \`create_official_documents\` → xác nhận đủ: mã CV, hướng (đến/đi/nội bộ), tiêu đề, ngày ban hành, cơ quan, người ký.
- Trước khi delete → xác nhận rõ.

## Use case

### 1. Đăng ký công văn ĐẾN
"Vừa nhận công văn từ Cục QLLĐNN số 1234/CV-CXKL ngày 15/05/2026 về việc xét hồ sơ Nguyễn Văn A":
1. \`create_official_documents({ documentCode:"CV-DEN-2026-XXX", direction:"incoming", officialNumber:"1234/CV-CXKL", issuedDate:"2026-05-15", issuingAuthority:"Cục QLLĐNN", title:"V/v xét hồ sơ Nguyễn Văn A", documentType:"official_letter", status:"received" })\`.
2. Hỏi user: ai sẽ xử lý? → \`update_official_documents({ assignedTo:<empId>, deadline:<date> })\`.
3. Tự tạo reminder cho người được giao.

### 2. Tạo công văn ĐI
"Soạn công văn gửi ĐSQ Nhật xin xác nhận COE cho LĐ Nguyễn Văn A":
1. \`create_official_documents({ documentCode:"CV-DI-2026-XXX", direction:"outgoing", title:"V/v xác nhận COE Nguyễn Văn A", recipient:"ĐSQ Nhật Bản tại VN", issuedDate:<today>, status:"draft", documentType:"official_letter" })\`.
2. Hỏi user upload file scan → set \`scanFile\`.
3. Khi gửi đi → status="sent".

### 3. Tra cứu
- "Công văn về BHXH gần đây" → \`list_official_documents({ q:"BHXH" })\`
- "Công văn đến tháng 5" → \`list_official_documents({ direction:"incoming", limit:50 })\` (filter ngày trên kết quả)
- "Công văn nào quá hạn" → \`list_official_documents({ status:"processing" })\` → check deadline trong kết quả

### 4. Phúc đáp
Sau khi nhận CV đến, tạo CV đi để phúc đáp:
- Tạo CV đi mới
- \`update_official_documents({ id:<incoming_id>, responseDocument:<outgoing_id> })\` link 2 chiều.

### 5. Xuất báo cáo
"Báo cáo công văn tháng" → \`list_official_documents({ limit:200 })\` → format theo direction/status → \`create_xlsx_file\`.

## Quy tắc bắt buộc
- \`documentCode\` UNIQUE — đề xuất pattern \`CV-{DEN|DI|NB}-YYYY-NNN\`.
- LUÔN upload file scan vào \`scanFile\` (Media collection) — sau này tra cứu / search được.
- KHÔNG xoá công văn đã có status >= "processing" mà không xác nhận với manager.
- Khi giao xử lý (\`assignedTo\`) → LUÔN \`create_reminder\` 1 ngày trước deadline cho người được giao.
- LUÔN ghi \`summary\` (tóm tắt 4-8 câu) ngay khi tạo — search dễ hơn.

## Hand-off
- Khi nhận công văn liên quan worker/order/đối tác → set \`relatedRecords\` để link 2 chiều với Worker/Order/Partner.
- Khi liên quan W6 visa / COE → notify topic Visa (jp_visa).

## Ví dụ hội thoại
👤 "Em vừa nhận CV từ Sở LĐ HN 567/SLD ngày 20/05 về kiểm tra cơ sở đào tạo, hạn báo cáo 30/05, giao chị Hoa xử lý."
🤖 → \`create_official_documents({...})\` + \`update assignedTo:<idHoa> deadline:2026-05-30\` + \`create_reminder({recipientType:"telegram_user", recipientTelegramUserId:<idHoa>, dueAt:"2026-05-29T09:00:00+07:00", title:"Báo cáo CV 567/SLD"})\` → reply "Đã đăng ký CV #CV-DEN-2026-XXX, giao chị Hoa, nhắc trước 1 ngày."
`,
};

async function main(): Promise<void> {
  loadConfig();
  logger.info("Seed", `▶▶▶ Upsert agent: ${AGENT.name}`);

  try {
    const existing = await payload.request<{ docs: Array<{ id: string }> }>(
      `/api/agents`,
      { query: { where: { name: { equals: AGENT.name } }, limit: 1, depth: 0 } },
    );

    const body = {
      name: AGENT.name,
      displayName: AGENT.displayName,
      active: true,
      shortDescription: AGENT.shortDescription,
      enabledTools: AGENT.enabledTools,
      docs: AGENT.docs,
    };

    if (existing.docs.length > 0) {
      const id = existing.docs[0].id;
      await payload.request(`/api/agents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
      });
      logger.info("Seed", `↻ updated (#${id})`);
    } else {
      const r = await payload.request<{ doc: { id: string } }>(`/api/agents`, {
        method: "POST",
        body,
      });
      logger.info("Seed", `✓ created (#${r.doc.id})`);
    }
  } catch (err) {
    const reason = err instanceof PayloadError ? err.message : String(err);
    logger.error("Seed", `Failed: ${reason}`);
    process.exit(1);
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
