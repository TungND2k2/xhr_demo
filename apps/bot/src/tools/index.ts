/**
 * Single registry of all tools the AI can call. Add new entities by
 * importing their CRUD bundle here; add custom logic by writing an
 * additional file and pushing into this array.
 */
import { workerTools } from "./workers.tools.js";
import { orderTools } from "./orders.tools.js";
import { orderWorkerTools } from "./order-workers.tools.js";
import { contractTools } from "./contracts.tools.js";
import { workflowStageTools } from "./workflow-stages.tools.js";
import { formTools } from "./forms.tools.js";
import { mediaTools } from "./media.tools.js";
import { reminderTools } from "./reminders.tools.js";
import { userTools } from "./users.tools.js";
import { telegramIdentityTools } from "./telegram-identity.tools.js";
import { exportTools } from "./export.tools.js";
import { calendarTools } from "./calendars.tools.js";
import { assetTools } from "./assets.tools.js";
import { emailTools } from "./email.tools.js";
import { partnerTools } from "./partners.tools.js";
import { supplyContractTools } from "./supply-contracts.tools.js";
import { vectorSearchTools } from "./vector-search.tools.js";
import { employeeTools } from "./employees.tools.js";
import { formInviteTools } from "./form-invites.tools.js";
import { officialDocumentTools } from "./official-documents.tools.js";
import { assetWorkflowTools } from "./assets.workflow.js";
import { officialDocumentWorkflowTools } from "./official-documents.workflow.js";

import { advanceOrderStatus } from "./orders.workflow.js";
import { orderProgressSummary } from "./orders.summary.js";
import { workerSummary } from "./workers.summary.js";

export const allTools = [
  // CRUD generic.
  ...workerTools,           // 5
  ...orderTools,            // 5
  ...orderWorkerTools,      // 5
  ...contractTools,         // 5
  ...workflowStageTools,    // 4: no delete

  // Form builder integration.
  ...formTools,

  // Media search by AI-generated description.
  ...mediaTools,            // 2: search_media, get_media_content

  // Reminders — lịch nhắc tự do (CEO/team).
  ...reminderTools,         // 5: create/list/update/snooze/dismiss

  // System users (read-only).
  ...userTools,             // 2: list_users, get_user

  // Telegram identity registry — map @username → telegramUserId, group info.
  ...telegramIdentityTools, // 3: lookup_telegram_user, list_telegram_groups, list_group_members

  // Export — AI sinh file CSV/MD/JSON/TXT, upload S3 + gửi Telegram.
  ...exportTools,           // 1: create_export_file

  // Calendar — quản lý lịch họp/hẹn/sự kiện.
  ...calendarTools,         // 5: list/get/create/update/delete calendars

  // Asset — quản lý tài sản công ty (laptop, xe, máy may...).
  ...assetTools,            // 5: list/get/create/update/delete assets

  // Asset workflow — bulk release khi nhân viên nghỉ việc, tra theo nhân viên.
  ...assetWorkflowTools,    // 2: bulk_release_assets, list_assets_by_employee

  // Partner — danh sách đối tác/xí nghiệp nước ngoài (đối tác Order).
  ...partnerTools,          // 5: list/get/create/update/delete partners

  // SupplyContract (HĐCU) — HĐ khung TLG ↔ Partner. Có tool AI extract
  // từ Media.extractedText.
  ...supplyContractTools,   // 6: 5 CRUD + extract_supply_contract

  // Vector search — semantic similarity, tra theo ngữ nghĩa (Qdrant).
  // Dùng thay list_*/get_* khi data lớn để tránh overflow context.
  ...vectorSearchTools,     // 1: semantic_search

  // Employee — nhân sự nội bộ TLG (KHÁC Users login + Workers XKLĐ).
  ...employeeTools,         // 5: list/get/create/update/delete employees

  // FormInvites — tạo link form đăng ký cho NLĐ qua Telegram.
  ...formInviteTools,       // 1: generate_form_link

  // OfficialDocuments — Công văn đến/đi/nội bộ TLG.
  ...officialDocumentTools, // 5: list/get/create/update/delete official-documents

  // OfficialDocuments workflow — xuất sổ VB đi/đến chuẩn HCNS.
  ...officialDocumentWorkflowTools, // 1: export_official_documents_report

  // Email — gửi email cho lãnh đạo (chị Hương + chị Hoa) qua SMTP.
  ...emailTools,            // 1: send_email

  // Domain-specific.
  advanceOrderStatus,
  orderProgressSummary,
  workerSummary,
];
