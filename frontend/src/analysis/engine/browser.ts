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

/** Sin trabajo durante este tiempo, los motores se apagan para liberar memoria (~90 MB cada uno). */
export const ENGINE_IDLE_MS = 60_000;

let shared: EnginePool | null = null;
let idleTimer: number | null = null;

function cancelIdleShutdown() {
  if (idleTimer !== null) window.clearTimeout(idleTimer);
  idleTimer = null;
}

/**
 * Pool compartido por toda la página (los Workers tardan en arrancar; se reutilizan).
 * Se recrea si murió o se apagó por inactividad, o si hace falta más paralelismo del que tiene.
 * `size`: motores deseados (por defecto, uno por núcleo libre; el entrenador pide 2).
 */
export function getBrowserEngine(size = browserEngineSize()): EnginePool {
  cancelIdleShutdown();
  if (!shared || !shared.alive || shared.size < size) {
    shared?.dispose();
    shared = new EnginePool(workerProcess, size);
    const pool = shared;
    pool.onIdle = () => {
      cancelIdleShutdown();
      idleTimer = window.setTimeout(() => {
        if (shared === pool) {
          pool.dispose();
          shared = null;
        }
      }, ENGINE_IDLE_MS);
    };
  }
  return shared;
}

/** Arranca los motores por adelantado (p. ej. al enfocar el campo de usuario) para solapar la descarga del WASM. */
export function prewarmBrowserEngine() {
  getBrowserEngine().onIdle?.();
}
