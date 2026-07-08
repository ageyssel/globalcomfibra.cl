"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen grid place-items-center p-6 bg-slate-50"><section className="surface max-w-xl p-10 text-center"><p className="eyebrow">Error interno</p><h1 className="text-4xl font-black mt-3">No pudimos completar la operación</h1><p className="section-copy mt-4">Tus datos no se han eliminado. Puedes reintentar o volver más tarde.</p><button className="button-primary mt-7" onClick={reset}>Reintentar</button></section></main>;
}
