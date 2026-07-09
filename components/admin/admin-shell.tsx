"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, CircleDollarSign, FileText, Headphones, History, LayoutDashboard, LogOut, Menu, Send, WalletCards, X } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole } from "@/lib/types";

const items: Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] }> = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["superadmin","admin","finance","commercial","support","readonly"] },
  { href: "/admin/clientes", label: "Clientes", icon: Building2, roles: ["superadmin","admin","finance","commercial","support","readonly"] },
  { href: "/admin/facturacion-clientes", label: "Facturación clientes", icon: FileText, roles: ["superadmin","admin","finance","readonly"] },
  { href: "/admin/cuentas-por-pagar", label: "Cuentas por pagar", icon: WalletCards, roles: ["superadmin","admin","finance","readonly"] },
  { href: "/admin/comunicaciones", label: "Comunicaciones", icon: Send, roles: ["superadmin","admin","finance","commercial","support","readonly"] },
  { href: "/admin/soporte", label: "Soporte", icon: Headphones, roles: ["superadmin","admin","support","readonly"] },
  { href: "/admin/finanzas", label: "Finanzas proveedores", icon: CircleDollarSign, roles: ["superadmin","admin","finance"] },
  { href: "/admin/auditoria", label: "Auditoría", icon: History, roles: ["superadmin","admin"] }
];

export function AdminShell({ children, profile }: { children: React.ReactNode; profile: { full_name: string | null; email: string; role: AppRole } }) {
  const pathname = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const [loggingOut, setLoggingOut] = useState(false);
  async function logout() { setLoggingOut(true); await getSupabaseBrowserClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  const nav = items.filter((item) => item.roles.includes(profile.role));
  return <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
    <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r border-slate-800 bg-slate-950 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-full flex-col p-4"><div className="flex items-center justify-between gap-3 px-2 py-3"><Link href="/admin"><Image src="/img/logo.png" alt="Globalcom" width={210} height={80} className="h-14 w-auto rounded-lg bg-white object-contain p-1" /></Link><button className="grid size-10 place-items-center rounded-lg hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X /></button></div>
      <nav className="mt-7 grid gap-1" aria-label="Administración">{nav.map(({ href, label, icon: Icon }) => { const active = href === "/admin" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon size={19} />{label}</Link>; })}</nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3"><p className="truncate text-sm font-black">{profile.full_name || profile.email}</p><p className="mt-1 truncate text-xs text-slate-400">{profile.email}</p><span className="badge badge-blue mt-3">{profile.role}</span><button className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white" disabled={loggingOut} onClick={logout}><LogOut size={17} />{loggingOut ? "Saliendo…" : "Cerrar sesión"}</button></div></div>
    </aside>
    {open && <button aria-label="Cerrar menú" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setOpen(false)} />}
    <section className="min-w-0"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-7"><button className="grid size-10 place-items-center rounded-xl border border-slate-200 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu /></button><div><p className="text-xs font-black uppercase tracking-[.12em] text-blue-700">Globalcom Operaciones</p></div><Link className="text-sm font-bold text-slate-600 hover:text-blue-700" href="/" target="_blank">Ver sitio público</Link></header><main className="p-4 lg:p-7">{children}</main></section>
  </div>;
}
