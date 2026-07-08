import { AdminShell } from "@/components/admin/admin-shell";
import { requireRoles } from "@/lib/auth";
import { ADMIN_ROLES } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRoles(ADMIN_ROLES);
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
