"use client";

import { useEffect } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Mientras `active`: mantiene la pantalla encendida (Wake Lock, si el navegador lo permite) y pide confirmación
 * al cerrar o recargar la pestaña. En móvil, si la pantalla se apaga o se cambia de app, los Workers se congelan
 * y el análisis se queda parado.
 */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };

    const acquire = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      try {
        const l = await nav.wakeLock.request("screen");
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        // denegado (batería baja, iframe...): no pasa nada
      }
    };
    // El navegador suelta el bloqueo al ocultar la pestaña: se vuelve a pedir al volver
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      cancelled = true;
      void lock?.release().catch(() => undefined);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);
}
