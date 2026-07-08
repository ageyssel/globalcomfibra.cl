"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const initial = { name: "", company: "", email: "", phone: "", commune: "", service: "Internet dedicado", message: "", website: "" };

export function LeadForm() {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke("submit-lead", { body: { ...form, source: "sitio_web", page: window.location.pathname } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "No fue posible enviar la solicitud.");
      setForm(initial); setStatus("success"); setMessage("Recibimos tu solicitud. Un ejecutivo se pondrá en contacto contigo.");
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "No fue posible enviar la solicitud.");
    }
  }

  return <form onSubmit={submit} className="grid gap-4" noValidate>
    <div className="hidden" aria-hidden="true"><label>Sitio web<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label></div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="field"><label htmlFor="lead-name">Nombre</label><input id="lead-name" required minLength={2} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="field"><label htmlFor="lead-company">Empresa</label><input id="lead-company" required minLength={2} autoComplete="organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
      <div className="field"><label htmlFor="lead-email">Correo corporativo</label><input id="lead-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div className="field"><label htmlFor="lead-phone">Teléfono</label><input id="lead-phone" required autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div className="field"><label htmlFor="lead-commune">Comuna</label><input id="lead-commune" required value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })} /></div>
      <div className="field"><label htmlFor="lead-service">Servicio</label><select id="lead-service" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}><option>Internet dedicado</option><option>Transporte Layer 2</option><option>Fibra oscura</option><option>Enlace inalámbrico</option><option>Ingeniería y proyectos</option><option>Otro</option></select></div>
    </div>
    <div className="field"><label htmlFor="lead-message">Detalles del proyecto</label><textarea id="lead-message" rows={4} maxLength={1500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
    {message && <div role="status" className={`alert ${status === "success" ? "alert-success" : "alert-error"}`}>{message}</div>}
    <button type="submit" disabled={status === "sending"} className="button-primary md:w-fit">{status === "sending" ? "Enviando…" : "Solicitar factibilidad"}</button>
  </form>;
}
