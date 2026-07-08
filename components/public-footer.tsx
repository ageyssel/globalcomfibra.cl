import Image from "next/image";
import Link from "next/link";
import { FileText, Headphones, LockKeyhole, Send } from "@/components/icons";

export function PublicFooter() {
  return <footer className="bg-[#161b28] px-6 pb-8 pt-16 text-slate-300">
    <div className="mx-auto max-w-5xl text-center">
      <div className="mb-6 flex items-center justify-center">
        <Image src="/img/logo.png" alt="Globalcom" width={280} height={112} className="h-24 w-auto object-contain brightness-0 invert opacity-90 md:h-28" />
      </div>

      <p className="mx-auto mb-8 max-w-2xl text-[15px] leading-7 text-slate-400">
        Construido con altos estándares de seguridad y tecnología de fibra óptica.<br className="hidden md:block" /> Protegemos la información y la conectividad de tu empresa.
      </p>

      <div className="mb-8 flex flex-col items-center justify-center gap-4 text-sm sm:flex-row sm:gap-8">
        <a href="mailto:contacto@globalcomfibra.cl" className="flex items-center transition hover:text-white"><Send className="mr-2 size-5" />contacto@globalcomfibra.cl</a>
        <a href="mailto:soporte@globalcomfibra.cl" className="flex items-center transition hover:text-white"><Headphones className="mr-2 size-5" />Soporte Técnico</a>
      </div>

      <hr className="mb-8 border-slate-700/60" />

      <p className="mb-6 text-sm font-semibold text-slate-300">Globalcom Telecomunicaciones | Santiago, Chile</p>

      <div className="mb-8 flex flex-col justify-center gap-4 sm:flex-row">
        <Link href="/terminos" className="inline-flex items-center justify-center rounded-full border border-slate-600 px-6 py-2.5 text-sm text-slate-300 transition hover:border-slate-400 hover:bg-slate-800"><FileText className="mr-2 size-4" />Ver Términos y Condiciones</Link>
        <Link href="/privacidad" className="inline-flex items-center justify-center rounded-full border border-slate-600 px-6 py-2.5 text-sm text-slate-300 transition hover:border-slate-400 hover:bg-slate-800"><LockKeyhole className="mr-2 size-4" />Ver Política de Privacidad</Link>
      </div>

      <p className="text-xs text-slate-500">© {new Date().getFullYear()} Globalcom Telecomunicaciones. Todos los derechos reservados. Desarrollado por FocusFrame Media SpA.</p>
    </div>
  </footer>;
}
