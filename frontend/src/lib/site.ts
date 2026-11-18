/**
 * Configuración pública del sitio (variables NEXT_PUBLIC_*, se fijan en el build; ver Cloudflare Pages > Settings > Variables).
 * Todas son opcionales: si faltan, la función correspondiente no se muestra.
 */

/** URL pública (para enlaces absolutos de Open Graph). Ej.: https://chesstutor.pages.dev */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Formulario de opinión (p. ej. Tally). */
export const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL || "";

/** Token de Cloudflare Web Analytics (sin cookies). No hace falta si se activa desde el panel de Cloudflare Pages. */
export const CF_ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN || "";
