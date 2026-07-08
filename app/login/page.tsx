import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Acceso al portal", robots: { index: false, follow: false } };
export default function LoginPage() {
  return <main className="min-h-screen grid place-items-center bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_36%),radial-gradient(circle_at_bottom_left,#ffedd5,transparent_32%)] p-5"><section className="w-full max-w-md"><Link href="/" className="mb-7 block text-center"><Image src="/img/logo.png" alt="Globalcom" width={280} height={110} className="mx-auto h-24 w-auto object-contain" priority /></Link><div className="surface p-7 md:p-9"><p className="eyebrow">Acceso seguro</p><h1 className="mt-3 text-3xl font-black tracking-[-.04em]">Portal Globalcom</h1><p className="mt-2 text-sm leading-6 text-slate-500">Clientes y equipo interno ingresan desde el mismo acceso. Los permisos se aplican según el rol asignado.</p><div className="mt-7"><Suspense><LoginForm /></Suspense></div></div><p className="mt-5 text-center text-xs text-slate-500">¿Necesitas ayuda? <a className="font-bold text-blue-700" href="mailto:soporte@globalcomfibra.cl">soporte@globalcomfibra.cl</a></p></section></main>;
}
