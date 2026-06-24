import type { Access } from "payload";

/**
 * Phân quyền dùng chung — đọc từ `user.roleRef` (relationship → Roles).
 *
 * Quy ước:
 *  - User có `roleRef.name === "Admin"` → full quyền (bypass mọi check).
 *  - User chưa migrate (roleRef rỗng) → fallback theo legacy enum `user.role`:
 *      "admin" = full. Còn lại theo whitelist truyền vào (giữ hành vi cũ).
 *  - User có `roleRef.permissions[<collection>][<action>] === true` → cho phép.
 *  - Có `roleRef.markets` non-empty → return query filter `{market: {in: markets}}` cho `read`.
 *
 * Lưu ý hydration: User được load với depth ≥ 1 thì roleRef là object. Nếu
 * chỉ là string (depth=0) — fallback an toàn về legacy enum.
 */
type Action = "read" | "create" | "update" | "delete";

interface RoleDoc {
  name?: string;
  isSystem?: boolean;
  markets?: string[];
  permissions?: Record<string, Partial<Record<Action, boolean>>>;
}

interface UserLite {
  role?: string;
  roleRef?: string | RoleDoc | null;
}

function resolveRole(user: UserLite | null | undefined): RoleDoc | null {
  if (!user) return null;
  if (user.roleRef && typeof user.roleRef === "object") return user.roleRef as RoleDoc;
  return null;
}

export function isAdminUser(user: UserLite | null | undefined): boolean {
  if (!user) return false;
  const r = resolveRole(user);
  if (r?.name === "Admin") return true;
  // Legacy fallback — user chưa migrate
  if (user.role === "admin" && !user.roleRef) return true;
  return false;
}

/**
 * Check quyền cơ bản (boolean). Trả về true/false.
 * Không return query filter ở đây — dùng `accessRead()` riêng cho read scope.
 */
export function hasPermission(
  user: UserLite | null | undefined,
  collection: string,
  action: Action,
  legacyAllowedRoles: string[] = ["admin"],
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const role = resolveRole(user);
  if (role?.permissions?.[collection]?.[action] === true) return true;

  // Fallback legacy enum nếu user chưa migrate sang roleRef
  if (!user.roleRef && user.role && legacyAllowedRoles.includes(user.role)) return true;

  return false;
}

/** Build access function cho read action (boolean only, không scope). */
export function accessRead(collection: string, legacy: string[] = ["admin", "manager", "recruiter", "trainer", "visa_specialist", "accountant", "medical"]): Access {
  return ({ req: { user } }) => {
    if (!user) return false;
    return hasPermission(user as UserLite, collection, "read", legacy);
  };
}

/**
 * Read access có market scope. Dùng cho Workers / Orders / Contracts /
 * SupplyContracts (có field `market`). Trả về query filter `{market: {in: [...]}}`
 * nếu role có markets non-empty.
 */
export function accessReadScoped(
  collection: string,
  legacy: string[] = ["admin", "manager", "recruiter", "trainer", "visa_specialist", "accountant", "medical"],
): Access {
  return ({ req: { user } }) => {
    if (!user) return false;
    const u = user as UserLite;
    if (isAdminUser(u)) return true;

    const role = resolveRole(u);
    const hasRead = role?.permissions?.[collection]?.read === true;
    const legacyOK = !u.roleRef && legacy.includes(u.role ?? "");
    if (!hasRead && !legacyOK) return false;

    // Scope market
    if (role?.markets && role.markets.length > 0) {
      return { market: { in: role.markets } };
    }
    return true;
  };
}

/** Build access cho create/update/delete (boolean only). */
export function accessWrite(
  collection: string,
  action: "create" | "update" | "delete",
  legacy: string[] = ["admin"],
): Access {
  return ({ req: { user } }) => {
    return hasPermission(user as UserLite, collection, action, legacy);
  };
}

export const accessCreate = (collection: string, legacy?: string[]) =>
  accessWrite(collection, "create", legacy);
export const accessUpdate = (collection: string, legacy?: string[]) =>
  accessWrite(collection, "update", legacy);
export const accessDelete = (collection: string, legacy?: string[]) =>
  accessWrite(collection, "delete", legacy);
