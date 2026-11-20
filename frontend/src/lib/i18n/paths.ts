/**
 * Idiomas y rutas: inglés en `/…` (por defecto) y español en `/es/…`.
 * Sin dependencias de React: lo usan el proveedor, los enlaces y el script de arranque.
 */
export type Lang = "en" | "es";

export const LANGS: Lang[] = ["en", "es"];
export const DEFAULT_LANG: Lang = "en";
/** Elección explícita del usuario con el botón EN/ES. */
export const LANG_STORAGE_KEY = "chesstutor_lang";
export const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-ES" };

const ES_PREFIX = /^\/es(?=$|[/?#])/;

export const langFromPath = (pathname: string): Lang => (ES_PREFIX.test(pathname) ? "es" : "en");

/** Quita el prefijo de idioma: "/es/dashboard?u=x" → "/dashboard?u=x", "/es" → "/". */
export function stripLang(path: string): string {
  if (!ES_PREFIX.test(path)) return path;
  const rest = path.replace(ES_PREFIX, "");
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/** Ruta interna (sin prefijo) en el idioma pedido: ("/?u=x", "es") → "/es?u=x". Las URL externas no se tocan. */
export function localizePath(path: string, lang: Lang): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const clean = stripLang(path);
  if (lang === "en") return clean;
  return clean === "/" || /^\/[?#]/.test(clean) ? `/es${clean.slice(1)}` : `/es${clean}`;
}

/** La misma página en el otro idioma, conservando query y hash. */
export const switchLangPath = (current: string, to: Lang) => localizePath(stripLang(current), to);

/**
 * Script en línea del <head>: se ejecuta antes de pintar.
 * - En /es/* marca `lang="es"`.
 * - En una ruta inglesa, salta a la española si el usuario la eligió o, sin elección guardada, si el navegador
 *   está en español. Los buscadores navegan en inglés y no se redirigen.
 */
export const LANG_BOOT_SCRIPT = `(function(){try{
var l=location,p=l.pathname;
if(/^\\/es(?=$|\\/)/.test(p)){document.documentElement.lang="es";return;}
var s=null;try{s=localStorage.getItem("${LANG_STORAGE_KEY}");}catch(e){}
var n=(navigator.languages&&navigator.languages[0])||navigator.language||"";
if(s==="es"||(s!=="en"&&/^es\\b/i.test(n))){l.replace("/es"+(p==="/"?"":p)+l.search+l.hash);}
}catch(e){}})();`;
