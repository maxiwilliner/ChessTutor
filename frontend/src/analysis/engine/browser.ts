"use client";

import { EnginePool, type UciProcess } from "./pool";

/** Stockfish 19 lite single-thread (WASM, ~7 MB sin comprimir). Lo copia `scripts/copy-engine.mjs` a /public/engine. */
export const ENGINE_URL = "/engine/stockfish-19-lite-single.js";

function workerProcess(): UciProcess {
  const worker = new Worker(ENGINE_URL);
  return {
    send: (cmd) => worker.postMessage(cmd),
    onLine: (listener) => {
      worker.onmessage = (e: MessageEvent) => {
        if (typeof e.data === "string") e.data.split("\n").forEach((l) => l && listener(l.trim()));
      };
    },
    terminate: () => worker.terminate(),
  };
}

/** Número de motores en paralelo: deja un núcleo libre para la interfaz; máximo 4. */
export function browserEngineSize(): number {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(4, cores - 1));
}

let shared: EnginePool | null = null;

/** Pool compartido por toda la página (los Workers tardan en arrancar; se reutilizan). */
export function getBrowserEngine(): EnginePool {
  if (!shared) shared = new EnginePool(workerProcess, browserEngineSize());
  return shared;
}
