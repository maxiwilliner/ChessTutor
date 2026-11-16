/**
 * Formateo igual que Python, para que los textos generados coincidan con los del backend.
 * `str(x)` de un float en Python siempre lleva decimal: 80.0 -> "80.0" (JS daría "80").
 */
export function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

/** f"{x:.0f}" */
export const pyFixed0 = (x: number) => Math.round(x).toFixed(0);
