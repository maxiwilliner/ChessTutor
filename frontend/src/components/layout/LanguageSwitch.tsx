"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { LANG_STORAGE_KEY, LANGS, switchLangPath, type Lang } from "@/lib/i18n/paths";
import { cn } from "@/lib/cn";

/** Cada idioma se nombra en su propia lengua. */
const NAMES: Record<Lang, string> = { en: "English", es: "Español" };

function remember(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // sin almacenamiento: la elección dura lo que la pestaña
  }
}

/**
 * Píldora EN | ES. El enlace apunta a la misma página en el otro idioma (con `hrefLang`, útil sin JS y para
 * buscadores); al pulsar se guarda la elección y se navega conservando la query actual (p. ej. `?username=`).
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, m } = useI18n();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  return (
    <div role="group" aria-label={m.lang.label} className={cn("flex rounded-xl border border-ink-600 bg-ink-900/80 p-0.5", className)}>
      {LANGS.map((l) => {
        const active = l === lang;
        const cls = cn(
          "num rounded-[10px] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
          active ? "bg-ink-700 text-ivory" : "text-ivory-faint hover:text-ivory"
        );
        if (active) {
          return (
            <span key={l} className={cls} aria-current="true" title={NAMES[l]} lang={l}>
              {l}
            </span>
          );
        }
        return (
          <Link
            key={l}
            href={switchLangPath(pathname, l)}
            hrefLang={l}
            lang={l}
            title={NAMES[l]}
            aria-label={NAMES[l]}
            className={cls}
            onClick={(e) => {
              remember(l);
              // Ctrl/Cmd-clic: dejar que abra otra pestaña con el enlace tal cual
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              const { pathname: p, search, hash } = window.location;
              router.push(switchLangPath(`${p}${search}${hash}`, l));
            }}
          >
            {l}
          </Link>
        );
      })}
    </div>
  );
}
