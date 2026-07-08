import Link from "next/link";
export default function AccessDenied() {
  return <main className="min-h-screen grid place-items-center p-6"><section className="surface max-w-xl p-10 text-center"><p className="eyebrow">Permisos</p><h1 className="text-4xl font-black mt-3">Acceso denegado</h1><p className="section-copy mt-4">Tu cuenta está activa, pero no tiene permisos para abrir este módulo.</p><Link href="/login" className="button-primary mt-7">Volver al acceso</Link></section></main>;
}
