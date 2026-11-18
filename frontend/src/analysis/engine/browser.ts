"use client";

import { EnginePool, type UciProcess } from "./pool";

/** Stockfish 19 lite single-thread (WASM, ~1,9 MB). Lo copia `scripts/copy-engine.mjs` a /public/engine. */
export const ENGINE_URL = "/engine/stockfish-19-lite-single.js";

function workerProcess(): UciProcess {
  if (typeof WebAssembly !== "object") throw new Error("este navegador no admite WebAssembly");
  const worker = new Worker(ENGINE_URL);
  return {
    send: (cmd) => worker.postMessage(cmd),
    onLine: (listener) => {
      worker.onmessage = (e: MessageEvent) => {
        if (typeof e.data === "string") e.data.split("\n").forEach((l) => l && listener(l.trim()));
      };
    },
    onError: (listener) => {
      worker.onerror = (e: ErrorEvent) => {
        e.preventDefault();
        listener(new Error(e.message || "el Worker del motor falló al cargar"));
      };
    },
    terminate: () => worker.terminate(),
  };
}

/** Núcleos lógicos del dispositivo (2 si el navegador no lo dice). */
export const deviceCores = () => (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2);

/** Número de motores en paralelo: deja un núcleo libre para la interfaz; máximo 4. */
export function browserEngineSize(): number {
  return Math.max(1, Math.min(4, deviceCores() - 1));
}

let shared: EnginePool | null = null;

/** Pool compartido por toda la página (los Workers tardan en arrancar; se reutilizan). Se recrea si murió. */
export function getBrowserEngine(): EnginePool {
  if (!shared || !shared.alive) {
    shared?.dispose();
    shared = new EnginePool(workerProcess, browserEngineSize());
  }
  return shared;
}
