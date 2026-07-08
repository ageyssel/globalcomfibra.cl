"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/types";

const adminRoles: AppRole[] = ["superadmin", "admin", "finance", "commercial", "support", "readonly"];

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(search.get("motivo") === "sesion" ? "Tu sesión expiró. Ingresa nuevamente." : "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (loginError || !data.user) throw new Error("Correo o contraseña incorrectos.");
      const { data: profile, error: profileError } = await supabase.from("app_users").select("role,active").eq("user_id", data.user.id).maybeSingle();
      if (profileError || !profile?.active) {
        await supabase.auth.signOut();
        throw new Error("La cuenta no está habilitada. Contacta a soporte.");
      }
      router.replace(adminRoles.includes(profile.role as AppRole) ? "/admin" : "/portal");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible iniciar sesión.");
      setLoading(false);
    }
  }

  return <form className="grid gap-5" onSubmit={submit} noValidate>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="field"><label htmlFor="login-email">Correo corporativo</label><input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.cl" /></div>
    <div className="field"><div className="flex items-center justify-between"><label htmlFor="login-password">Contraseña</label><Link className="text-xs font-bold text-blue-700" href="/recuperar-clave">¿Olvidaste tu clave?</Link></div><div className="relative"><input id="login-password" className="!pr-12" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setShow((value) => !value)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
    <button className="button-primary" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="animate-spin" size={18} /> Validando…</> : <><LockKeyhole size={18} /> Iniciar sesión</>}</button>
  </form>;
}
