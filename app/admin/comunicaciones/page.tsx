import { CommunicationsManager } from "@/components/admin/communications-manager";
import { requireRoles } from "@/lib/auth";
import type { AppRole } from "@/lib/types";
export const dynamic = "force-dynamic";
const roles: AppRole[] = ["superadmin","admin","finance","commercial","support","readonly"];
export default async function CommunicationsPage() {
  await requireRoles(roles);
  return <CommunicationsManager />;
}
