import { ClientsManager } from "@/components/admin/clients-manager";
import { getCurrentProfile } from "@/lib/auth";
import { CLIENT_WRITE_ROLES } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export default async function ClientsPage() { const profile = await getCurrentProfile(); return <ClientsManager canEdit={Boolean(profile && CLIENT_WRITE_ROLES.includes(profile.role))} />; }
