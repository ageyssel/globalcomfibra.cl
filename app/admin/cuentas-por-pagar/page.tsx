import { SupplierAccountsManager } from "@/components/admin/supplier-accounts-manager";
import { requireRoles } from "@/lib/auth";
import type { AppRole } from "@/lib/types";
export const dynamic = "force-dynamic";
const roles: AppRole[] = ["superadmin","admin","finance","readonly"];
export default async function SupplierAccountsPage() {
  await requireRoles(roles);
  return <SupplierAccountsManager />;
}
