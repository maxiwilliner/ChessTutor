"use client";

/**
 * Ajustes del análisis según el dispositivo (demo en el navegador).
 */
import { DEFAULT_DEPTH, type AnalysisDepth } from "./evaluator";
import { browserEngineSize, deviceCores } from "./engine/browser";

/** Equipos modestos (≤ 4 núcleos o móvil): algo menos de profundidad para no tardar minutos ni vaciar la batería. */
export function isLowPowerDevice(): boolean {
  const mobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  return mobile || deviceCores() <= 4;
}

export const LOW_POWER_DEPTH: AnalysisDepth = {
  fast: { depth: 10, movetime: 60 },
  deep: { depth: 13, movetime: 250 },
};

export const adaptiveDepth = (): AnalysisDepth => (isLowPowerDevice() ? LOW_POWER_DEPTH : DEFAULT_DEPTH);

/** Posiciones típicas por partida: ~75 en la pasada rápida y ~10 en la profunda (5 errores × antes/después). */
const FAST_POSITIONS_PER_GAME = 75;
const DEEP_POSITIONS_PER_GAME = 10;
/** Medido en escritorio (12 núcleos, 4 motores): 10 partidas en 11,6 s incluida la descarga. */
const DESKTOP_SECONDS_PER_GAME_4_ENGINES = 1.2;
const DOWNLOAD_SECONDS = 2;

/**
 * Estimación del análisis. En equipos lentos manda el tope de tiempo por posición (`movetime`): el motor
 * pierde profundidad, no tiempo, así que la cifra es un límite superior real. En escritorio se usa lo medido.
 */
export function estimateSeconds(games: number): number {
  const engines = browserEngineSize();
  const perGame = isLowPowerDevice()
    ? (FAST_POSITIONS_PER_GAME * (LOW_POWER_DEPTH.fast.movetime ?? 0) + DEEP_POSITIONS_PER_GAME * (LOW_POWER_DEPTH.deep.movetime ?? 0)) /
      1000 /
      engines
    : (DESKTOP_SECONDS_PER_GAME_4_ENGINES * 4) / engines;
  return Math.max(5, Math.round((DOWNLOAD_SECONDS + games * perGame) / 5) * 5);
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds} s`;
  const min = Math.round(seconds / 60);
  return `~${min} min`;
}
