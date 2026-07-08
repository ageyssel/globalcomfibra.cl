import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, Building2, Cable, CheckCircle2, Clock3, Gauge, Headphones, Network, RadioTower, Server, ShieldCheck, Wifi } from "@/components/icons";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { LeadForm } from "@/components/lead-form";

export const metadata: Metadata = { title: "Internet dedicado y fibra óptica para empresas", alternates: { canonical: "/" } };

const services = [
  { icon: Wifi, title: "Internet dedicado", text: "Enlaces simétricos para operaciones críticas, sin sobreventa y con crecimiento programable." },
  { icon: Network, title: "Transporte Layer 2", text: "Interconexión segura de oficinas, plantas y data centers mediante redes privadas de alta capacidad." },
  { icon: Cable, title: "Fibra oscura", text: "Infraestructura dedicada para organizaciones que necesitan control, capacidad y escalabilidad." },
  { icon: RadioTower, title: "Enlaces inalámbricos", text: "Microondas dedicadas en Región Metropolitana y Valparaíso para respaldo o acceso principal." },
  { icon: Server, title: "Data centers", text: "Conectividad estratégica y presencia en data centers para continuidad y baja latencia." },
  { icon: Building2, title: "Ingeniería y proyectos", text: "Diseño, construcción, expansión y mantenimiento de redes aéreas y subterráneas." }
];

export default function HomePage() {
  const organizationSchema = { "@context": "https://schema.org", "@type": "Organization", name: "Servicio de Telecomunicaciones Globalcom Ltda.", url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://globalcomfibra.cl", email: "contacto@globalcomfibra.cl", areaServed: "Chile" };
  return <>
    <PublicHeader />
    <main>
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,#2563eb_0,transparent_36%),radial-gradient(circle_at_80%_70%,#f97316_0,transparent_30%)]" />
        <div className="container-shell relative grid min-h-[670px] items-center gap-12 py-20 lg:grid-cols-[1.15fr_.85fr]">
          <div><p className="eyebrow !text-blue-300">Conectividad empresarial desde La Serena hasta Los Ángeles</p><h1 className="mt-5 max-w-4xl text-5xl font-black leading-[.98] tracking-[-.055em] md:text-7xl">La conexión crítica de tu empresa no puede depender de una red masiva.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">Internet dedicado, transporte de datos, fibra oscura y soporte técnico cercano.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="#cotizar" className="button-primary">Evaluar factibilidad <ArrowRight size={18} /></Link><Link href="/login" className="button-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/15">Ingresar al portal</Link></div></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {[{ icon: Cable, value: "+5.000 km", label: "de red de fibra óptica" }, { icon: Gauge, value: "Simétrica", label: "subida y bajada" }, { icon: Clock3, value: "24/7", label: "escalamiento operacional" }, { icon: ShieldCheck, value: "SLA", label: "compromiso contractual" }].map(({ icon: Icon, value, label }) => <div key={value} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"><Icon className="text-blue-300" /><strong className="mt-7 block text-3xl font-black">{value}</strong><span className="mt-1 block text-sm text-slate-400">{label}</span></div>)}
          </div>
        </div>
      </section>

      <section id="mapa" className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-800 py-24 text-white">
        <div className="container-shell">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="eyebrow !text-blue-300">La Serena – Los Ángeles</p>
            <h2 className="section-title mt-4 text-white">Red Troncal Fibra Óptica</h2>
            <p className="mt-6 text-lg leading-8 text-slate-300">Infraestructura de conectividad que une ciudades y polos productivos mediante fibra óptica de alta capacidad y baja latencia.</p>
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="relative flex h-[800px] justify-center overflow-hidden rounded-[3rem] border border-slate-700 bg-slate-950 p-7 shadow-2xl sm:p-9 lg:col-span-5">
              <div aria-hidden="true" className="absolute bottom-10 left-1/2 top-10 w-1.5 -translate-x-1/2 rounded-full bg-red-600 shadow-[0_0_18px_rgba(220,38,38,0.95)]" />
              <ol className="relative z-10 flex h-full w-full flex-col justify-between py-1">
                {[
                  ["La Serena", "Región de Coquimbo"],
                  ["Coquimbo", "Región de Coquimbo"],
                  ["Ovalle", "Región de Coquimbo"],
                  ["Los Vilos", "Región de Coquimbo"],
                  ["La Ligua", "Región de Valparaíso"],
                  ["Valparaíso / Viña del Mar", "Región de Valparaíso"],
                  ["Santiago", "Región Metropolitana"],
                  ["Rancagua", "Región de O’Higgins"],
                  ["San Fernando", "Región de O’Higgins"],
                  ["Curicó", "Región del Maule"],
                  ["Talca", "Región del Maule"],
                  ["Chillán", "Región de Ñuble"],
                  ["Los Ángeles", "Región del Biobío"]
                ].map(([city, region], index) => (
                  <li key={city} className="group relative grid min-h-11 grid-cols-[1fr_2.5rem_1fr] items-center">
                    <div className={`pr-3 text-right sm:pr-6 ${index % 2 === 0 ? "opacity-100" : "opacity-0"}`}>
                      <strong className="block text-[10px] font-black uppercase tracking-[.13em] text-white sm:text-xs">{city}</strong>
                      <span className="mt-1 block text-[8px] uppercase tracking-wide text-blue-300 sm:text-[9px]">{region}</span>
                    </div>
                    <div className="relative mx-auto grid size-7 place-items-center" aria-hidden="true">
                      <span className="absolute size-5 rounded-full bg-blue-500/45 transition group-hover:animate-ping" />
                      <span className="relative size-3 rounded-full bg-white shadow-[0_0_11px_rgba(59,130,246,1)]" />
                    </div>
                    <div className={`pl-3 text-left sm:pl-6 ${index % 2 === 1 ? "opacity-100" : "opacity-0"}`}>
                      <strong className="block text-[10px] font-black uppercase tracking-[.13em] text-white sm:text-xs">{city}</strong>
                      <span className="mt-1 block text-[8px] uppercase tracking-wide text-blue-300 sm:text-[9px]">{region}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
              {[
                { icon: Gauge, title: "Alta capacidad", text: "Transmisión de datos estable y escalable para operaciones exigentes." },
                { icon: Activity, title: "Baja latencia", text: "Rutas optimizadas para aplicaciones, voz, nube y procesos críticos." },
                { icon: Network, title: "Cobertura estratégica", text: "Conectamos ciudades y polos industriales desde Coquimbo hasta Biobío." },
                { icon: ShieldCheck, title: "Infraestructura confiable", text: "Una red robusta, preparada para continuidad operacional y crecimiento." }
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-3xl border border-slate-700 bg-slate-800/80 p-7 shadow-lg transition hover:border-blue-500">
                  <div className="grid size-12 place-items-center rounded-xl border border-blue-500/30 bg-blue-950/70 text-blue-300"><Icon /></div>
                  <h3 className="mt-6 text-sm font-black uppercase tracking-[.12em] text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="soluciones" className="py-24"><div className="container-shell"><div className="max-w-3xl"><p className="eyebrow">Soluciones</p><h2 className="section-title mt-4">Conectamos más que redes.</h2><p className="section-copy mt-6">Integramos conectividad, infraestructura y soporte para que cada servicio tenga un responsable y un objetivo operacional claro.</p></div><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map(({ icon: Icon, title, text }) => <article key={title} className="surface p-7"><div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon /></div><h3 className="mt-6 text-xl font-black">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></div></section>

      <section id="soporte" className="bg-slate-950 py-24 text-white"><div className="container-shell grid gap-12 lg:grid-cols-2"><div><p className="eyebrow !text-blue-300">Soporte y SLA</p><h2 className="section-title mt-4">Atención técnica directa, con trazabilidad desde el primer contacto.</h2><p className="mt-6 text-lg leading-8 text-slate-300">El portal de clientes centraliza tickets, seguimiento, adjuntos, facturas y datos del servicio. Los casos críticos quedan identificados y asociados al cliente correcto.</p><div className="mt-8 grid gap-3">{["Recepción y validación del incidente", "Diagnóstico remoto y clasificación de prioridad", "Derivación técnica o visita a terreno", "Registro de respuesta, solución y cierre"].map((item) => <div key={item} className="flex items-start gap-3"><CheckCircle2 className="mt-1 shrink-0 text-emerald-400" size={20} /><span className="text-slate-200">{item}</span></div>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-white/5 p-7"><Headphones className="text-blue-300" /><strong className="mt-8 block text-3xl font-black">Atención humana</strong><p className="mt-3 leading-7 text-slate-400">Sin bots como barrera para incidentes operacionales.</p></div><div className="rounded-3xl border border-white/10 bg-white/5 p-7"><Clock3 className="text-orange-300" /><strong className="mt-8 block text-3xl font-black">Seguimiento</strong><p className="mt-3 leading-7 text-slate-400">Cada respuesta y cambio de estado queda registrado.</p></div></div></div></section>

      <section id="cotizar" className="bg-white py-24"><div className="container-shell grid gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><p className="eyebrow">Factibilidad comercial</p><h2 className="section-title mt-4">Cuéntanos dónde necesitas conectividad.</h2><p className="section-copy mt-6">Revisaremos ubicación, capacidad requerida, criticidad, redundancia y plazo. La solicitud quedará registrada para seguimiento comercial.</p><div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-blue-900">La factibilidad final depende de revisión técnica. Este formulario no genera una contratación automática.</div></div><div className="surface p-7 md:p-9"><LeadForm /></div></div></section>
    </main>
    <PublicFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
  </>;
}
