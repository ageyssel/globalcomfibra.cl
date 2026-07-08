"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "@/components/icons";
import { useState } from "react";

const links = [
  { href: "/#mapa", label: "Red troncal" },
  { href: "/#soluciones", label: "Soluciones" },
  { href: "/#soporte", label: "Soporte SLA" },
  { href: "/faq", label: "Preguntas frecuentes" }
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
    <div className="container-shell flex h-20 items-center justify-between gap-5">
      <Link href="/" aria-label="Inicio Globalcom"><Image src="/img/logo.png" alt="Globalcom" width={250} height={100} className="h-14 w-auto object-contain" priority /></Link>
      <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">
        {links.map((link) => <Link key={link.href} className="text-sm font-bold text-slate-600 transition hover:text-blue-700" href={link.href}>{link.label}</Link>)}
      </nav>
      <div className="hidden items-center gap-3 lg:flex"><Link href="/#cotizar" className="button-secondary">Solicitar factibilidad</Link><Link href="/login" className="button-primary">Portal clientes</Link></div>
      <button className="grid size-11 place-items-center rounded-xl border border-slate-200 lg:hidden" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
    </div>
    {open && <nav className="container-shell grid gap-2 border-t border-slate-100 py-4 lg:hidden" aria-label="Navegación móvil">
      {links.map((link) => <Link key={link.href} className="rounded-xl px-3 py-3 font-bold text-slate-700 hover:bg-slate-50" href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
      <Link href="/#cotizar" className="button-secondary mt-2" onClick={() => setOpen(false)}>Solicitar factibilidad</Link>
      <Link href="/login" className="button-primary" onClick={() => setOpen(false)}>Portal clientes</Link>
    </nav>}
  </header>;
}
