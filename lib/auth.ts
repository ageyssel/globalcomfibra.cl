import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, UserProfile } from "@/lib/types";

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data } = await supabase.from("app_users").select("user_id,email,full_name,role,active").eq("user_id", userData.user.id).maybeSingle();
  if (!data) return null;
  return data as UserProfile;
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?motivo=sesion");
  return user;
}

export async function requireRoles(roles: AppRole[]) {
  const user = await requireAuthenticatedUser();
  const profile = await getCurrentProfile();
  if (!profile?.active || !roles.includes(profile.role)) redirect("/acceso-denegado");
  return { user, profile };
}
