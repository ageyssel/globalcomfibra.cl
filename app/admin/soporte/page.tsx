import { SupportManager } from "@/components/admin/support-manager";
import { getCurrentProfile } from "@/lib/auth";
import { SUPPORT_WRITE_ROLES } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export default async function SupportPage() { const profile = await getCurrentProfile(); return <SupportManager canEdit={Boolean(profile && SUPPORT_WRITE_ROLES.includes(profile.role))} />; }
