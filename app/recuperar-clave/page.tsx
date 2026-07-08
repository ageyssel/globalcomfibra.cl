import type { Metadata } from "next";
import Link from "next/link";
import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };
export default function RecoveryPage() { return <main className="min-h-screen grid place-items-center p-5"><section className="surface w-full max-w-md p-8"><p className="eyebrow">Recuperación</p><h1 className="mt-3 text-3xl font-black">Restablece tu acceso</h1><p className="mt-3 text-sm leading-6 text-slate-600">Te enviaremos un enlace de uso temporal al correo registrado.</p><div className="mt-7"><PasswordRecoveryForm /></div><Link href="/login" className="mt-6 block text-center text-sm font-bold text-blue-700">Volver al acceso</Link></section></main>; }
