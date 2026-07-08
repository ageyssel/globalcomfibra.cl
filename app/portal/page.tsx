import { redirect } from "next/navigation";
import { requireAuthenticatedUser, getCurrentProfile } from "@/lib/auth";
import { ClientPortal } from "@/components/portal/client-portal";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await requireAuthenticatedUser();
  const profile = await getCurrentProfile();
  if (profile && profile.role !== "client") redirect("/admin");
  if (!user.email) redirect("/login?motivo=correo");
  return <ClientPortal email={user.email} />;
}
