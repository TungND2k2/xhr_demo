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

  // Domain-specific.
  advanceOrderStatus,
  orderProgressSummary,
  workerSummary,
];
