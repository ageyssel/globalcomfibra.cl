"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function PasswordUpdateForm() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (password.length < 10) return setError("La contraseña debe tener al menos 10 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    const supabase = getSupabaseBrowserClient(); const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError("El enlace expiró o no fue posible actualizar la contraseña."); setLoading(false); return; }
    await supabase.auth.signOut(); router.replace("/login?actualizada=1");
  }
  return <form onSubmit={submit} className="grid gap-5">{error && <div className="alert alert-error">{error}</div>}<div className="field"><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" type="password" minLength={10} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><small>Usa al menos 10 caracteres y evita reutilizar claves.</small></div><div className="field"><label htmlFor="confirm-password">Confirmar contraseña</label><input id="confirm-password" type="password" minLength={10} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div><button className="button-primary" disabled={loading}>{loading ? "Actualizando…" : "Guardar nueva contraseña"}</button></form>;
}
