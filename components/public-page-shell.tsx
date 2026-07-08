import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export function PublicPageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children: React.ReactNode }) {
  return <><PublicHeader /><main><section className="bg-slate-950 py-20 text-white"><div className="container-shell"><p className="eyebrow !text-blue-300">{eyebrow}</p><h1 className="mt-4 max-w-4xl text-5xl font-black tracking-[-.05em] md:text-6xl">{title}</h1>{intro && <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{intro}</p>}</div></section><section className="py-16"><div className="container-shell">{children}</div></section></main><PublicFooter /></>;
}
