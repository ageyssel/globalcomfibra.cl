import type { Metadata } from "next";
import { PasswordUpdateForm } from "@/components/auth/password-update-form";
export const metadata: Metadata = { title: "Actualizar contraseña", robots: { index: false, follow: false } };
export default function UpdatePasswordPage() { return <main className="min-h-screen grid place-items-center p-5"><section className="surface w-full max-w-md p-8"><p className="eyebrow">Seguridad</p><h1 className="mt-3 text-3xl font-black">Crea una nueva contraseña</h1><div className="mt-7"><PasswordUpdateForm /></div></section></main>; }
