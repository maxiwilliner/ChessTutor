import { siteMetadata } from "@/lib/i18n/metadata";

/** Versión en español: mismas vistas; el idioma sale de la ruta (`I18nProvider`). */
export const metadata = siteMetadata("es");

export default function SpanishLayout({ children }: { children: React.ReactNode }) {
  return children;
}
