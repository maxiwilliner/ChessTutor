/**
 * Texto de un aviso del diagnóstico (`AlgorithmicFlag`) en cualquier idioma, reconstruido a partir de su código y
 * del resumen. En español coincide con el `metric_reference` que guarda el agregador (Python y TS).
 */
import type { AlgorithmicFlag, PlayerDiagnosisSummary } from "@/types/api";
import type { Lang } from "@/lib/i18n/paths";
import { pyFixed0, pyFloat } from "./format";

/** La misma regla que el agregador usa para elegir la apertura problemática. */
const problemOpening = (summary: PlayerDiagnosisSummary, eco: string) =>
  summary.opening_repertoire_gaps.find((o) => o.games_played >= 2 && o.win_rate <= 0.35 && o.eco === eco);

export function flagMetricText(flag: AlgorithmicFlag, summary: PlayerDiagnosisSummary, lang: Lang): string {
  const clk = summary.clock_psychology;
  const en = lang === "en";
  switch (flag.code) {
    case "HANGING_PIECES": {
      const pct = pyFloat(summary.tactical_motifs.hanging_piece?.percentage_of_blunders ?? 0);
      return en
        ? `${pct}% of your serious mistakes come from hanging or unprotected pieces.`
        : `${pct}% de tus errores graves provienen de piezas colgadas o desprotegidas.`;
    }
    case "IMPULSIVE_MOVE_SELECTION": {
      const n = clk.blunders_under_3s_with_ample_time;
      return en
        ? `${n} mistakes played instantly with plenty of time on the clock.`
        : `${n} errores jugados al instante con tiempo de sobra en el reloj.`;
    }
    case "TIME_TROUBLE_PANIC": {
      const n = clk.blunders_in_time_trouble_under_10s;
      return en ? `${n} serious mistakes made in time trouble.` : `${n} errores graves cometidos en apuro de tiempo.`;
    }
    case "MIDDLEGAME_COLLAPSE": {
      const pct = pyFloat(summary.phase_distribution.middlegame.percentage_of_blunders);
      return en
        ? `${pct}% of your mistakes happen in the middlegame.`
        : `${pct}% de los errores ocurren durante la fase de medio juego.`;
    }
    case "GENERAL_TACTICAL_CALCULATION": {
      const cpl = pyFloat(summary.overall_metrics.avg_centipawn_loss);
      return en ? `Average centipawn loss of ${cpl} CPL per move.` : `Pérdida media de centipeones de ${cpl} CPL por jugada.`;
    }
  }
  if (flag.code.startsWith("REPERTOIRE_LEAK_")) {
    const w = problemOpening(summary, flag.code.slice("REPERTOIRE_LEAK_".length));
    if (w) {
      const wr = pyFixed0(w.win_rate * 100);
      const ev = pyFloat(w.avg_eval_at_move_12);
      return en
        ? `In the ${w.name} (${w.eco}) you only win ${wr}% of your games, with an average evaluation of ${ev} at move 12.`
        : `En ${w.name} (${w.eco}) obtienes solo un ${wr}% de victorias con una evaluación media de ${ev} en la jugada 12.`;
    }
  }
  return flag.metric_reference;
}
