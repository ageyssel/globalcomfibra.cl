import { CustomerBillingManager } from "@/components/admin/customer-billing-manager";
import { requireRoles } from "@/lib/auth";
import type { AppRole } from "@/lib/types";
export const dynamic = "force-dynamic";
const roles: AppRole[] = ["superadmin","admin","finance","readonly"];
export default async function CustomerBillingPage() {
  await requireRoles(roles);
  return <CustomerBillingManager />;
}
