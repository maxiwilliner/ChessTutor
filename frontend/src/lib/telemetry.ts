"use client";

/**
 * Informes de errores anónimos (Sentry). Solo se activa si existe `NEXT_PUBLIC_SENTRY_DSN`: sin ella no se
 * descarga el SDK ni se envía nada. Nunca se envían nombres de usuario, partidas ni datos personales.
 */
import { APP_MODE } from "./mode";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

type SentryModule = typeof import("@sentry/browser");
let sentry: SentryModule | null = null;
let starting: Promise<void> | null = null;
/** Errores ocurridos antes de que cargue el SDK. */
const queue: [unknown, Record<string, string>][] = [];
let currentLang = "";

/** Idioma de la interfaz como etiqueta de los informes. */
export function setTelemetryLang(lang: string) {
  currentLang = lang;
  sentry?.setTag("lang", lang);
}

/** Quita nombres de usuario: parámetros `username=` y rutas de la API de Chess.com (`/player/<nombre>`). */
export function scrubText(text: string): string {
  return text
    .replace(/([?&]username=)[^&#\s"']*/gi, "$1[usuario]")
    .replace(/(\/player\/)[A-Za-z0-9_-]+/g, "$1[usuario]")
    .replace(/(«)[^»]*(»)/g, "$1[usuario]$2");
}

/** Aplica `scrubText` a todas las cadenas de un objeto (eventos y migas de Sentry). */
export function scrubDeep<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map(scrubDeep) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubDeep(v);
    return out as T;
  }
  return value;
}

function deviceTags(): Record<string, string> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    mode: APP_MODE,
    cores: String(nav.hardwareConcurrency ?? "?"),
    memory_gb: String(nav.deviceMemory ?? "?"),
  };
}

export function initTelemetry() {
  if (!DSN || typeof window === "undefined" || starting) return;
  starting = import("@sentry/browser")
    .then((S) => {
      S.init({
        dsn: DSN,
        environment: APP_MODE,
        // Sin trazas de rendimiento ni replays: solo errores (cuota gratuita de 5.000/mes)
        tracesSampleRate: 0,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          stackFrameVariables: false,
        },
        beforeSend: (event) => scrubDeep(event),
        beforeBreadcrumb: (crumb) => scrubDeep(crumb),
      });
      S.setTags({ ...deviceTags(), ...(currentLang ? { lang: currentLang } : {}) });
      sentry = S;
      for (const [err, tags] of queue.splice(0)) S.captureException(err, { tags });
    })
    .catch(() => undefined);
}

/** Informa de un error controlado (p. ej. un análisis que falló), con etiquetas para agruparlo. */
export function reportError(err: unknown, tags: Record<string, string> = {}) {
  if (!DSN) return;
  if (sentry) sentry.captureException(err, { tags });
  else if (queue.length < 20) queue.push([err, tags]);
}
