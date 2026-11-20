"use client";

/** Cabecera, enlace de salto y pie: en cliente para que sus textos y enlaces sigan el idioma de la ruta. */
import React from "react";
import Link from "next/link";
import { KnightMark } from "./KnightMark";
import { NavLinks } from "./NavLinks";
import { LanguageSwitch } from "./LanguageSwitch";
import { DemoFooterControls } from "./DemoNotice";
import { FeedbackLink } from "./FeedbackLink";
import { APP_MODE } from "@/lib/mode";
import { useI18n } from "@/lib/i18n";

export function SkipLink() {
  const { m } = useI18n();
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brass-400 focus:px-3 focus:py-2 focus:text-ink-950"
    >
      {m.nav.skipToContent}
    </a>
  );
}

export function SiteHeader() {
  const { m, path } = useI18n();
  return (
    <header className="sticky top-0 z-50 border-b border-ink-600/60 bg-ink-900/75 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={path("/")} className="group flex items-center gap-2.5" aria-label={m.nav.homeAria}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brass-500/30 bg-gradient-to-b from-brass-400/20 to-brass-400/5 text-brass-300 transition-colors group-hover:text-brass-200">
            <KnightMark className="h-6 w-6" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-ivory">
            Chess<span className="text-brass-400">Tutor</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <NavLinks />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { m, path } = useI18n();
  return (
    <footer
      className={
        APP_MODE === "demo"
          ? "border-t border-ink-600/50 pb-28 pt-6 text-center text-xs text-ivory-faint sm:pb-6"
          : "hidden border-t border-ink-600/50 py-6 text-center text-xs text-ivory-faint sm:block"
      }
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span>{m.footer.about}</span>
          <Link href={path("/privacy")} className="hover:text-brass-300">
            {m.footer.privacy}
          </Link>
          <FeedbackLink className="text-xs" />
        </div>
        {APP_MODE === "demo" && <DemoFooterControls />}
      </div>
    </footer>
  );
}
