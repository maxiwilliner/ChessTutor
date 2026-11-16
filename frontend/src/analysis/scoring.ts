/**
 * Port de `backend/app/modules/engine/scoring.py`.
 * Calidad de jugada por probabilidad de victoria (modelo de Lichess). Evaluaciones desde la perspectiva del jugador.
 */
import type { Classification } from "./types";

export const CP_CAP = 1000;
export const BLUNDER_DROP = 0.3;
export const ERROR_DROP = 0.2;
export const INACCURACY_DROP = 0.1;

export const clampCp = (cp: number) => Math.max(-CP_CAP, Math.min(CP_CAP, cp));

export function winningChances(cp: number): number {
  return 2 / (1 + Math.exp(-0.00368208 * clampCp(cp))) - 1;
}

export const winPercent = (cp: number) => 50 + 50 * winningChances(cp);

export const centipawnLoss = (before: number, after: number) => Math.max(0, clampCp(before) - clampCp(after));

export function classifyMove(before: number, after: number): Classification {
  const drop = winningChances(before) - winningChances(after);
  if (drop >= BLUNDER_DROP) return "blunder";
  if (drop >= ERROR_DROP) return "error";
  if (drop >= INACCURACY_DROP) return "inaccuracy";
  return centipawnLoss(before, after) < 25 ? "best" : "good";
}

export function moveAccuracy(before: number, after: number): number {
  const drop = winPercent(before) - winPercent(after);
  if (drop <= 0) return 100;
  const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

/** Redondeo como `round(x, n)` de Python (al par en empates exactos, suficiente para nuestras cifras). */
export function pyRound(x: number, digits = 0): number {
  const f = 10 ** digits;
  const v = x * f;
  const r = Math.round(v);
  // Python redondea 0.5 al par; JS hacia +∞. Corregir solo empates exactos.
  if (Math.abs(v % 1) === 0.5) return (r % 2 === 0 ? r : r - 1) / f;
  return r / f;
}
