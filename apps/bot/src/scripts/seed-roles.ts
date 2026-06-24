/**
 * Seed 7 Role default (mirror enum cũ) + migrate users.role string → users.roleRef ObjectId.
 *
 * Idempotent — chạy lại không tạo trùng. Run sau khi deploy CMS schema Roles + Users.roleRef.
 *
 * Usage:
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/seed-roles.js
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

interface RoleSeed {
  name: string;
  description: string;
  isSystem: boolean;
  markets?: string[];
  permissions: Record<string, { read?: boolean; create?: boolean; update?: boolean; delete?: boolean }>;
  // Map từ legacy enum string sang role này
  legacyValue: string;
}

// Helper: permissions full CRUD
const full = { read: true, create: true, update: true, delete: true };
const ro = { read: true, create: false, update: false, delete: false };
const ru = { read: true, create: false, update: true, delete: false };
const ruc = { read: true, create: true, update: true, delete: false };

// 23 collection slugs hiện có
const ALL_COLLECTIONS = [
  "workers",
  "orders",
  "order-workers",
  "contracts",
  "supply-contracts",
  "partners",
  "form-invites",
  "employees",
  "assets",
  "offices",
  "official-documents",
  "calendars",
  "reminders",
  "media",
  "forms",
  "workflows",
  "workflow-stages",
  "users",
  "roles",
  "agents",
  "telegram-topics",
  "telegram-groups",
  "telegram-users",
  "telegram-membership",
  "counters",
];

function allFull(): Record<string, typeof full> {
  return Object.fromEntries(ALL_COLLECTIONS.map((c) => [c, full]));
}
function allRO(): Record<string, typeof ro> {
  return Object.fromEntries(ALL_COLLECTIONS.map((c) => [c, ro]));
}

const ROLES: RoleSeed[] = [
  {
    name: "Admin",
    description: "Toàn quyền hệ thống. Không bị giới hạn — kể cả permissions json trống thì vẫn full.",
    isSystem: true,
    markets: [],
    permissions: allFull(),
    legacyValue: "admin",
  },
  {
    name: "Quản lý điều hành",
    description: "Manager cross thị trường. Duyệt workflow, gán đơn, sửa hầu hết collection trừ Users/Roles/Agents.",
    isSystem: true,
    markets: [],
    permissions: {
      ...allFull(),
      users: ru,
      roles: ro,
      agents: ro,
      "telegram-topics": ro,
      "telegram-groups": ro,
    },
    legacyValue: "manager",
  },
  {
    name: "Tuyển dụng (W1)",
    description: "Nhân viên W1 — nhập ứng viên, tạo Worker, gửi form đăng ký.",
    isSystem: true,
    markets: [],
    permissions: {
      ...allRO(),
      workers: ruc,
      "form-invites": ruc,
      reminders: ruc,
      calendars: ruc,
      media: ruc,
    },
    legacyValue: "recruiter",
  },
  {
    name: "Giảng viên đào tạo (W3)",
    description: "Quản lớp đào tạo, điểm danh, thi nội bộ.",
    isSystem: true,
    markets: [],
    permissions: {
      ...allRO(),
      workers: ru,
      reminders: ruc,
      calendars: ruc,
      media: ruc,
    },
    legacyValue: "trainer",
  },
  {
    name: "Chuyên viên visa (W6)",
    description: "Xử COE / visa / hồ sơ ĐSQ.",
    isSystem: true,
    markets: [],
    permissions: {
      ...allRO(),
      workers: ru,
      contracts: ru,
      reminders: ruc,
      calendars: ruc,
      media: ruc,
    },
    legacyValue: "visa_specialist",
  },
  {
    name: "Kế toán",
    description: "Quản tiền cọc, phí dịch vụ, doanh thu. Sửa fields tài chính.",
    isSystem: true,
    markets: [],
    permissions: {
      ...allRO(),
      workers: ru,
      contracts: ru,
      reminders: ruc,
      calendars: ruc,
      media: ruc,
    },
    legacyValue: "accountant",
  },
  {
    name: "Y tế / Khám SK (W2)",
    description: "Cập nhật kết quả khám SK W2.",
    isSystem: true,
    markets: [],
    permissions: {
      ...allRO(),
      workers: ru,
      reminders: ruc,
      calendars: ruc,
      media: ruc,
    },
    legacyValue: "medical",
  },
];

interface RoleExisting {
  id: string;
  name: string;
  isSystem?: boolean;
}

interface UserDoc {
  id: string;
  email?: string;
  role?: string;
  roleRef?: string | { id: string };
}

async function upsertRoles(): Promise<Map<string, string>> {
  // legacyValue → roleId
  const map = new Map<string, string>();
  for (const r of ROLES) {
    const found = await payload.request<{ docs: RoleExisting[] }>(`/api/roles`, {
      query: { where: { name: { equals: r.name } }, limit: 1, depth: 0 },
    });
    const body = {
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      markets: r.markets ?? [],
      permissions: r.permissions,
    };
    if (found.docs.length > 0) {
      const id = found.docs[0].id;
      await payload.request(`/api/roles/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
      });
      logger.info("Seed", `  ↻ role "${r.name}" updated (#${id})`);
      map.set(r.legacyValue, id);
    } else {
      const created = await payload.request<{ doc: { id: string } }>(`/api/roles`, {
        method: "POST",
        body,
      });
      logger.info("Seed", `  ✓ role "${r.name}" created (#${created.doc.id})`);
      map.set(r.legacyValue, created.doc.id);
    }
  }
  return map;
}

async function migrateUsers(roleMap: Map<string, string>): Promise<void> {
  // Tải tất cả users
  const usersRes = await payload.request<{ docs: UserDoc[]; totalDocs: number }>(`/api/users`, {
    query: { limit: 1000, depth: 0 },
  });
  const users = usersRes.docs;
  logger.info("Seed", `▶ Migrating ${users.length} users...`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const u of users) {
    // Nếu user đã có roleRef → skip (idempotent)
    if (u.roleRef) {
      skipped += 1;
      continue;
    }
    const legacyRole = u.role;
    if (!legacyRole) {
      logger.warn("Seed", `  ⚠ user ${u.email ?? u.id} không có role cũ — gán Admin tạm`);
      const adminId = roleMap.get("admin");
      if (adminId) {
        await payload.request(`/api/users/${encodeURIComponent(u.id)}`, {
          method: "PATCH",
          body: { roleRef: adminId },
        });
        updated += 1;
      } else {
        missing += 1;
      }
      continue;
    }
    const roleId = roleMap.get(legacyRole);
    if (!roleId) {
      logger.warn("Seed", `  ⚠ user ${u.email ?? u.id} role="${legacyRole}" không match role nào`);
      missing += 1;
      continue;
    }
    await payload.request(`/api/users/${encodeURIComponent(u.id)}`, {
      method: "PATCH",
      body: { roleRef: roleId },
    });
    updated += 1;
  }

  logger.info("Seed", `║   users updated: ${updated}`);
  logger.info("Seed", `║   users skipped (had roleRef): ${skipped}`);
  logger.info("Seed", `║   users missing/unmatched: ${missing}`);
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Seed", `▶▶▶ Seed Roles + migrate users.role → users.roleRef`);

  try {
    const roleMap = await upsertRoles();
    logger.info("Seed", `\n▶ Roles ready (${roleMap.size} entries). Migrating users...\n`);
    await migrateUsers(roleMap);
    logger.info("Seed", `\n╔═══════════════════════════════════════╗`);
    logger.info("Seed", `║ DONE`);
    logger.info("Seed", `╚═══════════════════════════════════════╝`);
  } catch (err) {
    const reason = err instanceof PayloadError ? err.message : String(err);
    logger.error("Seed", `Failed: ${reason}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
