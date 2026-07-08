import type { AppRole } from "@/lib/types";

export const ADMIN_ROLES: AppRole[] = ["superadmin", "admin", "finance", "commercial", "support", "readonly"];
export const FINANCE_ROLES: AppRole[] = ["superadmin", "admin", "finance"];
export const CLIENT_WRITE_ROLES: AppRole[] = ["superadmin", "admin", "commercial"];
export const SUPPORT_WRITE_ROLES: AppRole[] = ["superadmin", "admin", "support"];

export function canWrite(role: AppRole, allowed: AppRole[]) {
  return role !== "readonly" && allowed.includes(role);
}
