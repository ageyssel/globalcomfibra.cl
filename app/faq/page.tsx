import type { Metadata } from "next";
import { PublicPageShell } from "@/components/public-page-shell";

export const metadata: Metadata = { title: "Preguntas frecuentes", description: "Respuestas sobre internet dedicado, velocidad simétrica, SLA, instalación y escalabilidad." };
const questions = [
  ["¿Cuál es la diferencia frente a un servicio empresarial masivo?", "Globalcom diseña cada solución según la ubicación, capacidad, criticidad y soporte requerido. La propuesta puede incluir enlace dedicado, SLA, rutas de respaldo y atención técnica directa."],
  ["¿La velocidad es simétrica?", "Los enlaces dedicados pueden configurarse con la misma capacidad de subida y bajada. La velocidad, contención y garantías aplicables quedan establecidas en la propuesta y el contrato de cada cliente."],
  ["¿Cómo funciona el SLA?", "El Acuerdo de Nivel de Servicio define disponibilidad, canales de atención, tiempos comprometidos, exclusiones y compensaciones. Siempre debe revisarse la versión firmada por ambas partes."],
  ["¿Cuánto tarda una instalación?", "El plazo depende de la factibilidad, obras requeridas, permisos, distancia a la red y coordinación con el cliente. La fecha comprometida se informa después de la evaluación técnica."],
  ["¿Puedo aumentar la capacidad más adelante?", "Sí, sujeto a capacidad técnica y condiciones comerciales. Antes de confirmar un aumento se valida equipamiento, ruta, puerto y capacidad disponible."],
  ["¿Dónde opera Globalcom?", "La cobertura comercial se concentra desde La Serena hasta Los Ángeles. Toda contratación está sujeta a factibilidad técnica en la dirección exacta de instalación."]
];
export default function FaqPage() {
  return <PublicPageShell eyebrow="Ayuda comercial" title="Preguntas frecuentes" intro="Información general para evaluar una solución de conectividad empresarial."><div className="grid gap-4">{questions.map(([q,a]) => <details key={q} className="surface group p-6"><summary className="cursor-pointer list-none pr-8 text-lg font-black">{q}</summary><p className="mt-4 max-w-4xl leading-8 text-slate-600">{a}</p></details>)}</div></PublicPageShell>;
}
