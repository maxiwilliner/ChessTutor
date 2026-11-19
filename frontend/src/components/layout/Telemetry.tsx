"use client";

import { useEffect } from "react";
import { initTelemetry } from "@/lib/telemetry";

const RELOAD_KEY = "chesstutor_chunk_reload";

/** Tras un despliegue, una pestaña abierta puede pedir trozos de JS que ya no existen. */
export function isChunkLoadError(reason: unknown): boolean {
  const e = reason as { name?: string; message?: string } | null;
  const text = `${e?.name ?? ""} ${e?.message ?? reason ?? ""}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    text
  );
}

/**
 * Recarga la página una sola vez (marca en sessionStorage, que se limpia a los 30 s para que un
 * despliegue posterior en la misma sesión también se recupere).
 */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
}

/** Arranca los informes de errores y la recuperación tras despliegues. No pinta nada. */
export function Telemetry() {
  useEffect(() => {
    initTelemetry();
    const onError = (e: ErrorEvent) => isChunkLoadError(e.error ?? e.message) && reloadOnce();
    const onRejection = (e: PromiseRejectionEvent) => isChunkLoadError(e.reason) && reloadOnce();
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
