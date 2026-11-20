"use client";

/**
 * Idioma de la interfaz. Sale de la ruta (`/es/…` = español), así que el HTML estático de cada ruta ya viene en
 * su idioma y no hay destellos. Uso: `const { m, fmt, path, lang } = useI18n()`.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MESSAGES, type Messages } from "./messages";
import { makeFormatters, type Formatters } from "./format";
import { langFromPath, localizePath, type Lang } from "./paths";
import { errorCode, type ErrorParams } from "@/lib/errors";
import { setTelemetryLang } from "@/lib/telemetry";

export interface I18n {
  lang: Lang;
  m: Messages;
  fmt: Formatters;
  /** Ruta interna en el idioma actual: path("/trainer?u=x") → "/es/trainer?u=x" en español. */
  path: (p: string) => string;
}

const build = (lang: Lang): I18n => ({
  lang,
  m: MESSAGES[lang],
  fmt: makeFormatters(lang),
  path: (p) => localizePath(p, lang),
});

const BY_LANG: Record<Lang, I18n> = { en: build("en"), es: build("es") };
const I18nContext = createContext<I18n>(BY_LANG.en);

/** Marca con el idioma con el que se generó el HTML estático. */
const SSR_MARK_ID = "ct-ssr-lang";

/** Idioma del HTML ya pintado (solo en el navegador, durante la hidratación). */
function readSsrLang(): Lang | null {
  if (typeof document === "undefined") return null;
  const v = document.getElementById(SSR_MARK_ID)?.getAttribute("data-lang");
  return v === "en" || v === "es" ? v : null;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathLang = langFromPath(usePathname() ?? "/");
  // Al hidratar se usa el idioma del HTML estático: la 404 se genera una sola vez (en inglés) y se sirve también en
  // /es/…; tras hidratar, el idioma sigue a la ruta. En el resto de páginas los dos coinciden.
  const [ssrLang, setSsrLang] = useState<Lang | null>(readSsrLang);
  const lang = ssrLang ?? pathLang;
  useEffect(() => setSsrLang(null), []);
  useEffect(() => {
    document.documentElement.lang = lang;
    setTelemetryLang(lang);
  }, [lang]);
  return (
    <I18nContext.Provider value={BY_LANG[lang]}>
      <span hidden id={SSR_MARK_ID} data-lang={lang} />
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);

/** Texto de un error en el idioma actual: por su código si lo tiene; si no, su mensaje (p. ej. del backend). */
export function errorText(err: unknown, m: Messages): string {
  const { code, params } = errorCode(err);
  const fn = code ? (m.errors as Record<string, ((p: ErrorParams) => string) | undefined>)[code] : undefined;
  if (fn) return fn(params);
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : m.errors.unexpected();
}

export type { Lang } from "./paths";
export type { Messages } from "./messages";
