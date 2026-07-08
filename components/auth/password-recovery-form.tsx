"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${origin}/actualizar-clave` });
      if (sendError) throw sendError;
      setMessage("Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.");
    } catch { setError("No fue posible procesar la solicitud. Intenta nuevamente."); }
    finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="grid gap-5">{message && <div className="alert alert-success">{message}</div>}{error && <div className="alert alert-error">{error}</div>}<div className="field"><label htmlFor="recovery-email">Correo corporativo</label><input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div><button className="button-primary" disabled={loading}>{loading ? "Enviando…" : "Enviar enlace seguro"}</button></form>;
}
