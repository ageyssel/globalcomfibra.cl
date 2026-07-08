import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public-page-shell";

export const metadata: Metadata = { title: "Términos y condiciones" };
export default function TermsPage() {
  return <PublicPageShell eyebrow="Información contractual" title="Términos y condiciones" intro="Uso de servicios de telecomunicaciones — versión abril de 2026"><article className="surface mx-auto max-w-4xl space-y-8 p-7 leading-8 text-slate-700 md:p-10">
    <section><h2 className="text-2xl font-black">1. Objeto y aceptación</h2><p className="mt-3">Estos términos regulan la relación entre Servicio de Telecomunicaciones Globalcom Ltda. y sus clientes respecto de los servicios contratados. El contrato particular y el SLA firmado prevalecen cuando regulen una materia de forma específica.</p></section>
    <section><h2 className="text-2xl font-black">2. Servicios</h2><ul className="mt-3 list-disc space-y-2 pl-6"><li>Internet dedicado y transporte de datos.</li><li>Direcciones IP públicas, cuando corresponda.</li><li>Arriendo o provisión de equipos.</li><li>Soporte técnico y mantención conforme al SLA.</li></ul></section>
    <section><h2 className="text-2xl font-black">3. Contratación y vigencia</h2><p className="mt-3">La vigencia, renovación, permanencia y condiciones de término son las establecidas en el contrato suscrito con cada cliente.</p></section>
    <section><h2 className="text-2xl font-black">4. Precio y pago</h2><p className="mt-3">Los precios, impuestos, reajustes, plazo de pago y consecuencias del incumplimiento se detallan en el contrato y las facturas correspondientes.</p></section>
    <section><h2 className="text-2xl font-black">5. Obligaciones de Globalcom</h2><ul className="mt-3 list-disc space-y-2 pl-6"><li>Prestar el servicio conforme a las características acordadas.</li><li>Mantener canales de soporte definidos.</li><li>Gestionar incidencias y compensaciones según el SLA aplicable.</li></ul></section>
    <section><h2 className="text-2xl font-black">6. Uso permitido</h2><p className="mt-3">El cliente debe utilizar el servicio para fines lícitos y no realizar actividades que vulneren derechos, afecten la seguridad de terceros, generen spam o impliquen acceso no autorizado.</p></section>
    <section><h2 className="text-2xl font-black">7. SLA</h2><p className="mt-3">La disponibilidad, tiempos, exclusiones, procedimientos y compensaciones corresponden al SLA firmado. Las solicitudes deben realizarse por los canales y dentro de los plazos allí establecidos.</p></section>
    <section><h2 className="text-2xl font-black">8. Término anticipado</h2><p className="mt-3">Las causales y efectos del término anticipado son los establecidos en el contrato y la legislación aplicable.</p></section>
    <section><h2 className="text-2xl font-black">9. Jurisdicción</h2><p className="mt-3">Las partes fijan domicilio en Santiago de Chile y se someten a sus tribunales ordinarios, salvo acuerdo válido en contrario.</p></section>
  </article></PublicPageShell>;
}
