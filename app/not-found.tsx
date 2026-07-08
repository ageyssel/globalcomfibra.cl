import Link from "next/link";

export default function NotFound() {
  return <main className="min-h-screen grid place-items-center p-6 bg-slate-50"><section className="surface max-w-xl p-10 text-center"><p className="eyebrow">Error 404</p><h1 className="text-4xl font-black mt-3">Página no encontrada</h1><p className="section-copy mt-4">La dirección ingresada no existe o fue movida.</p><Link className="button-primary mt-7" href="/">Volver al inicio</Link></section></main>;
}
