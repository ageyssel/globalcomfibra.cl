import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://globalcomfibra.cl";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Globalcom | Internet dedicado para empresas", template: "%s | Globalcom" },
  description: "Internet dedicado, transporte de datos, fibra oscura y conectividad empresarial con soporte técnico directo desde La Serena hasta Los Ángeles.",
  applicationName: "Globalcom",
  alternates: { canonical: "/" },
  icons: { icon: "/img/favicon.ico", apple: "/img/favicon.png" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: siteUrl,
    siteName: "Globalcom Telecomunicaciones",
    title: "Globalcom | Conectividad dedicada para empresas",
    description: "Fibra óptica dedicada, baja latencia, SLA y soporte humano para empresas."
  },
  twitter: { card: "summary", title: "Globalcom", description: "Conectividad dedicada para empresas." },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111827" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
