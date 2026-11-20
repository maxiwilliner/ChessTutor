/** Metadatos (título, descripción, Open Graph, hreflang) por idioma. Solo para archivos de ruta (servidor). */
import type { Metadata } from "next";
import { MESSAGES } from "./messages";
import { localizePath, type Lang } from "./paths";

const OG_LOCALE: Record<Lang, string> = { en: "en_US", es: "es_ES" };

/** Enlaces hreflang de una ruta (sin prefijo de idioma). */
const alternates = (path: string, lang: Lang): Metadata["alternates"] => ({
  canonical: localizePath(path, lang),
  languages: { en: localizePath(path, "en"), es: localizePath(path, "es"), "x-default": localizePath(path, "en") },
});

/** Metadatos de todo el sitio en un idioma (layout raíz para inglés, `app/es/layout.tsx` para español). */
export function siteMetadata(lang: Lang): Metadata {
  const m = MESSAGES[lang].meta;
  const other: Lang = lang === "en" ? "es" : "en";
  return {
    // `absolute`: en /es la plantilla del layout raíz no debe volver a añadir "· ChessTutor"
    title: { absolute: m.title, template: "%s · ChessTutor" },
    description: m.tagline,
    applicationName: "ChessTutor",
    alternates: alternates("/", lang),
    openGraph: {
      type: "website",
      locale: OG_LOCALE[lang],
      alternateLocale: [OG_LOCALE[other]],
      siteName: "ChessTutor",
      title: m.shareTitle,
      description: m.tagline,
      url: localizePath("/", lang),
    },
    twitter: { card: "summary_large_image", title: m.shareTitle, description: m.tagline },
  };
}

type Page = "dashboard" | "trainer" | "privacy";

/**
 * Metadatos de una página concreta en un idioma. Sin `openGraph` propio: hereda la tarjeta del sitio de su idioma
 * (con su imagen), que es lo que interesa al compartir un enlace al diagnóstico o al entrenador.
 */
export function pageMetadata(lang: Lang, page: Page): Metadata {
  const m = MESSAGES[lang].meta;
  return {
    title: m[`${page}Title`],
    description: m[`${page}Description`],
    alternates: alternates(`/${page}`, lang),
  };
}
