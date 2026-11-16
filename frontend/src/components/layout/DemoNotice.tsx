"use client";

import React, { useState } from "react";
import { Download, Trash2, ShieldCheck } from "lucide-react";
import { clearLocalData, exportLocalData } from "@/lib/store/local";
import { cn } from "@/lib/cn";

/** Franja bajo la cabecera: qué es la demo y dónde viven los datos. */
export function DemoBanner() {
  return (
    <div className="border-b border-brass-500/20 bg-brass-400/[0.07]">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs text-brass-200 sm:px-6 lg:px-8">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">Demo gratuita.</strong> El análisis se hace en tu navegador y tus datos se guardan solo
          aquí: no tenemos servidor ni cuentas.
        </span>
      </div>
    </div>
  );
}

/** Pie de la demo: exportar/borrar datos locales y licencia de Stockfish (GPL-3.0). */
export function DemoFooterControls() {
  const [status, setStatus] = useState("");

  const onExport = async () => {
    const data = await exportLocalData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "chesstutor-datos.json" });
    a.click();
    URL.revokeObjectURL(url);
  };

  const onClear = async () => {
    if (!window.confirm("¿Borrar todos tus análisis, ejercicios y progreso de este navegador? No se puede deshacer.")) return;
    await clearLocalData();
    try {
      window.localStorage.clear();
    } catch {
      // sin almacenamiento local
    }
    setStatus("Datos borrados.");
    window.setTimeout(() => window.location.assign("/"), 800);
  };

  const linkCls = "inline-flex items-center gap-1 hover:text-brass-300";
  return (
    <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
      <button type="button" onClick={onExport} className={linkCls}>
        <Download className="h-3.5 w-3.5" aria-hidden /> Exportar mis datos
      </button>
      <button type="button" onClick={onClear} className={cn(linkCls, "hover:text-rose-300")}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Borrar mis datos de este navegador
      </button>
      {status && <span role="status">{status}</span>}
      <span className="text-ivory-faint/80">
        Motor:{" "}
        <a href="https://stockfishchess.org" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          Stockfish 19
        </a>{" "}
        (
        <a href="/engine/COPYING.txt" className="underline-offset-2 hover:underline">
          GPL-3.0
        </a>
        ,{" "}
        <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
          código fuente
        </a>
        )
      </span>
    </div>
  );
}
