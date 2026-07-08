import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public-page-shell";

export const metadata: Metadata = { title: "Política de privacidad", robots: { index: true, follow: true } };
export default function PrivacyPage() {
  return <PublicPageShell eyebrow="Información legal" title="Política de privacidad" intro="Protección de datos personales — versión abril de 2026"><article className="surface mx-auto max-w-4xl space-y-8 p-7 leading-8 text-slate-700 md:p-10">
    <section><h2 className="text-2xl font-black">1. Identificación del responsable</h2><p className="mt-3">En cumplimiento con la Ley N° 19.628 sobre Protección de la Vida Privada y demás normativa aplicable en Chile, Servicio de Telecomunicaciones Globalcom Ltda., RUT 77.812.215-4, con domicilio en Av. Nueva Providencia 1363, oficina 1404, Providencia, Santiago, pone a disposición esta política.</p></section>
    <section><h2 className="text-2xl font-black">2. Ámbito de aplicación</h2><p className="mt-3">Se aplica a clientes, usuarios del sitio web y personas que interactúan con Globalcom mediante correo electrónico, formularios, soporte o plataformas de mensajería.</p></section>
    <section><h2 className="text-2xl font-black">3. Finalidades del tratamiento</h2><ul className="mt-3 list-disc space-y-2 pl-6"><li>Gestionar la relación contractual y la prestación de servicios.</li><li>Atender soporte técnico, incidencias y mantenciones.</li><li>Enviar comunicaciones operativas, comerciales o administrativas relacionadas con una solicitud o contrato.</li><li>Proteger la seguridad de la red y prevenir usos indebidos.</li></ul></section>
    <section><h2 className="text-2xl font-black">4. Comunicación a terceros</h2><p className="mt-3">Globalcom no vende datos personales. Puede comunicarlos a proveedores que actúen como encargados del tratamiento o a autoridades competentes cuando exista obligación legal.</p></section>
    <section><h2 className="text-2xl font-black">5. Derechos de los titulares</h2><p className="mt-3">Las solicitudes de acceso, rectificación, cancelación, oposición o bloqueo pueden dirigirse a <a className="font-bold text-blue-700" href="mailto:contacto@globalcomfibra.cl">contacto@globalcomfibra.cl</a>.</p></section>
    <section><h2 className="text-2xl font-black">6. Seguridad y conservación</h2><p className="mt-3">Globalcom aplica controles técnicos y organizativos para limitar el acceso, prevenir pérdida o alteración y conservar los datos durante el tiempo necesario para las finalidades informadas y obligaciones legales.</p></section>
    <section><h2 className="text-2xl font-black">7. Legislación aplicable</h2><p className="mt-3">Esta política se rige por la legislación chilena. Las controversias se someterán a los tribunales competentes de Santiago de Chile.</p></section>
  </article></PublicPageShell>;
}
