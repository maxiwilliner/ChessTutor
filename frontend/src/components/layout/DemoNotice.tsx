"use client";

import React, { useEffect, useState } from "react";
import { Download, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { clearLocalData, exportLocalData, isStoragePersistent } from "@/lib/store/local";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

const bold = (t: React.ReactNode) => <strong className="font-semibold">{t}</strong>;

/** Franja bajo la cabecera: qué es la demo y dónde viven los datos. */
export function DemoBanner() {
  const { m } = useI18n();
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    isStoragePersistent().then(setPersistent).catch(() => setPersistent(false));
  }, []);

  return (
    <div className={persistent ? "border-b border-brass-500/20 bg-brass-400/[0.07]" : "border-b border-amber-500/30 bg-amber-500/10"}>
      <div
        role={persistent ? undefined : "status"}
        className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs text-brass-200 sm:px-6 lg:px-8"
      >
        {persistent ? (
          <>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{m.demo.bannerLong(bold)}</span>
            <span className="sm:hidden">{m.demo.bannerShort(bold)}</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
            <span className="text-amber-100">{m.demo.notPersistent(bold)}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Pie de la demo: exportar/borrar datos locales y licencia de Stockfish (GPL-3.0). */
export function DemoFooterControls() {
  const { m, path } = useI18n();
  const [status, setStatus] = useState("");

  const onExport = async () => {
    const data = await exportLocalData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: m.demo.exportFile });
    a.click();
    URL.revokeObjectURL(url);
  };

  const onClear = async () => {
    if (!window.confirm(m.demo.confirmClear)) return;
    await clearLocalData();
    try {
      window.localStorage.clear();
    } catch {
      // sin almacenamiento local
    }
    setStatus(m.demo.cleared);
    window.setTimeout(() => window.location.assign(path("/")), 800);
  };

  const linkCls = "inline-flex items-center gap-1 hover:text-brass-300";
  return (
    <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
      <button type="button" onClick={onExport} className={linkCls}>
        <Download className="h-3.5 w-3.5" aria-hidden /> {m.demo.export}
      </button>
      <button type="button" onClick={onClear} className={cn(linkCls, "hover:text-rose-300")}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden /> {m.demo.clear}
      </button>
      {status && <span role="status">{status}</span>}
      <span className="text-ivory-faint/80">
        {m.demo.engine}{" "}
        <a href="https://stockfishchess.org" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          Stockfish 19
        </a>{" "}
        (
        <a href="/engine/COPYING.txt" className="underline-offset-2 hover:underline">
          GPL-3.0
        </a>
        ,{" "}
        <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          {m.demo.source}
        </a>
        )
      </span>
    </div>
  );
}
