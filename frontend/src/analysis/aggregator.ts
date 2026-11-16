/** Port de `assemble_diagnosis_and_puzzles` (backend/app/modules/heuristics/aggregator.py). */
import type {
  AlgorithmicFlag,
  BlunderBankItem,
  OpeningGap,
  PhaseStats,
  PlayerDiagnosisSummary,
  TacticalMotifDetail,
} from "@/types/api";
import type { EvaluatedMove, NormalizedGame, Phase } from "./types";
import { parseTimeControl } from "./parser";
import { clampCp, moveAccuracy, pyRound } from "./scoring";
import { classifyTacticalMotif } from "./tactical";
import { analyzeClockPsychology, tagMovePsychology } from "./clock";
import { generateHintsForBlunder } from "./hints";
import { pyFixed0, pyFloat } from "./format";

export const THEME_DESCRIPTIONS: Record<string, string> = {
  hanging_piece: "Piezas propias dejadas sin defensa táctica o captura de piezas rivales envenenadas",
  pin_exploitation: "Fallo al detectar piezas clavadas al rey o a piezas de mayor valor",
  fork_overlooked: "Ataques dobles de caballo o dama desatendidos",
  missed_mate: "Omisión de secuencias forzadas de mate en 1 a 3 jugadas",
  king_safety_collapse: "Rey atrapado en el centro o apertura de líneas frente al enroque",
  tactical_inaccuracy: "Imprecisión en el cálculo posicional o intercambio desventajoso de material",
};

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatPeriod(games: NormalizedGame[]): string {
  const stamps = games.map((g) => g.end_time).filter((t) => t > 0);
  if (!stamps.length) return "Partidas recientes";
  const first = new Date(Math.min(...stamps) * 1000);
  const last = new Date(Math.max(...stamps) * 1000);
  const fmt = (d: Date, year: boolean) => `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}` + (year ? ` ${d.getUTCFullYear()}` : "");
  if (first.toISOString().slice(0, 10) === last.toISOString().slice(0, 10)) return fmt(last, true);
  return `${fmt(first, first.getUTCFullYear() !== last.getUTCFullYear())} – ${fmt(last, true)}`;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const harmonicMean = (xs: number[]) => xs.length / xs.reduce((a, b) => a + 1 / b, 0);

export function gameAccuracy(moves: EvaluatedMove[]): number {
  const acc = moves.map((m) => moveAccuracy(m.eval_before_cp, m.eval_after_cp));
  if (!acc.length) return 0;
  return (mean(acc) + harmonicMean(acc.map((a) => Math.max(a, 1)))) / 2;
}

export function overallAccuracy(evaluated: EvaluatedMove[][]): number {
  const perGame = evaluated.filter((m) => m.length).map(gameAccuracy);
  return perGame.length ? pyRound(mean(perGame), 1) : 0;
}

/** Elemento más frecuente; los empates se resuelven por orden de aparición (como Counter.most_common). */
function mostCommon(xs: string[]): string {
  const counts = new Map<string, number>();
  xs.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  let best = xs[0];
  counts.forEach((n, k) => {
    if (n > (counts.get(best) ?? 0)) best = k;
  });
  return best;
}

export function assembleDiagnosisAndPuzzles(
  username: string,
  timeClass: string,
  games: NormalizedGame[],
  evaluatedGamesMoves: EvaluatedMove[][]
): { summary: PlayerDiagnosisSummary; puzzles: BlunderBankItem[] } {
  const total = games.length;
  const wins = games.filter((g) => g.user_result === "win").length;
  const draws = games.filter((g) => g.user_result === "draw").length;
  const losses = total - wins - draws;
  const rate = (n: number) => (total ? pyRound(n / total, 2) : 0);

  const all: EvaluatedMove[] = [];
  const puzzles: BlunderBankItem[] = [];

  games.forEach((game, gi) => {
    const [baseTime] = parseTimeControl(game.time_control);
    for (const m of evaluatedGamesMoves[gi]) {
      all.push(m);
      if (!["blunder", "error", "inaccuracy"].includes(m.classification)) continue;
      const theme = classifyTacticalMotif(m.fen_before, m.user_move_uci, m.eval_before_cp, m.eval_after_cp, m.refutation_uci, m.move_number);
      const psy = tagMovePsychology(
        m.time_spent_seconds,
        m.clock_remaining_seconds,
        m.classification === "blunder" || m.classification === "error",
        baseTime
      );
      m.tactical_theme = theme;
      m.psychological_tag = psy;

      if ((m.classification === "blunder" || m.classification === "error") && m.best_move_uci) {
        const bestSan = m.best_move_san || m.best_move_uci;
        puzzles.push({
          id: `bb_${game.id}_m${m.move_number}_${m.turn}`,
          game_url: game.url,
          metadata: {
            white: game.white_username,
            black: game.black_username,
            user_color: game.user_color,
            eco: game.eco,
            opening_name: game.opening_name,
            time_control: game.time_control,
          },
          move_number: m.move_number,
          turn: m.turn,
          fen_before: m.fen_before,
          user_move: {
            uci: m.user_move_uci,
            san: m.user_move_san,
            time_spent_seconds: m.time_spent_seconds,
            clock_remaining_seconds: m.clock_remaining_seconds,
          },
          engine_solution: {
            best_move_uci: m.best_move_uci,
            best_move_san: bestSan,
            eval_before: pyRound(m.eval_before_cp / 100, 2),
            eval_after_user_move: pyRound(m.eval_after_cp / 100, 2),
            cpl: m.cpl,
            pv_uci: m.pv_uci,
            pv_san: m.pv_san,
            refutation_uci: m.refutation_uci,
            refutation_san: m.refutation_san,
          },
          classification: { phase: m.phase, theme, psychological_tag: psy },
          tutor_hints: generateHintsForBlunder(theme, bestSan, m.best_move_uci),
          is_mastered: false,
          consecutive_correct: 0,
          next_review_at: null,
          attempts_count: 0,
          repeated_blunder_count: 0,
        });
      }
    }
  });

  // 1. Errores
  const count = (c: string, xs = all) => xs.filter((m) => m.classification === c).length;
  const blundersTotal = count("blunder");
  const avgCpl = all.length ? pyRound(all.reduce((s, m) => s + m.cpl, 0) / all.length, 1) : 0;

  // 2. Fases
  const phaseStats = (phase: Phase): PhaseStats => {
    const xs = all.filter((m) => m.phase === phase);
    const b = count("blunder", xs);
    return {
      blunders: b,
      avg_cpl: xs.length ? pyRound(xs.reduce((s, m) => s + m.cpl, 0) / xs.length, 1) : 0,
      percentage_of_blunders: blundersTotal ? pyRound((b / blundersTotal) * 100, 1) : 0,
    };
  };
  const phaseDist = { opening: phaseStats("opening"), middlegame: phaseStats("middlegame"), endgame: phaseStats("endgame") };

  // 3. Motivos tácticos
  const serious = all.filter((m) => m.classification === "blunder" || m.classification === "error");
  const motifCounts = new Map<string, number>();
  serious.forEach((m) => {
    const t = m.tactical_theme || "tactical_inaccuracy";
    motifCounts.set(t, (motifCounts.get(t) ?? 0) + 1);
  });
  const tacticalMotifs: Record<string, TacticalMotifDetail> = {};
  for (const [key, description] of Object.entries(THEME_DESCRIPTIONS)) {
    const cnt = motifCounts.get(key) ?? 0;
    tacticalMotifs[key] = {
      count: cnt,
      percentage_of_blunders: serious.length ? pyRound((cnt / serious.length) * 100, 1) : 0,
      description,
    };
  }

  // 4. Reloj
  const clock = analyzeClockPsychology(all);

  // 5. Aperturas
  const groups = new Map<string, { eco: string; name: string; color: NormalizedGame["user_color"]; items: [NormalizedGame, EvaluatedMove[]][] }>();
  games.forEach((g, gi) => {
    const key = JSON.stringify([g.eco, g.opening_name, g.user_color]);
    if (!groups.has(key)) groups.set(key, { eco: g.eco, name: g.opening_name, color: g.user_color, items: [] });
    groups.get(key)!.items.push([g, evaluatedGamesMoves[gi]]);
  });
  const openingGaps: OpeningGap[] = [];
  groups.forEach(({ eco, name, color, items }) => {
    const opWins = items.filter(([g]) => g.user_result === "win").length;
    const evals12: number[] = [];
    const themes: string[] = [];
    for (const [, moves] of items) {
      let m12 = 0;
      for (const m of moves) {
        if (m.move_number <= 12) m12 = clampCp(m.eval_after_cp);
        if ((m.classification === "blunder" || m.classification === "error") && m.tactical_theme) themes.push(m.tactical_theme);
      }
      evals12.push(m12);
    }
    openingGaps.push({
      eco,
      name,
      color,
      games_played: items.length,
      win_rate: pyRound(opWins / items.length, 2),
      avg_eval_at_move_12: evals12.length ? pyRound(mean(evals12) / 100, 2) : 0,
      dominant_blunder_motif: themes.length ? mostCommon(themes) : "none",
    });
  });
  openingGaps.sort((a, b) => b.games_played - a.games_played || a.win_rate - b.win_rate);

  // 6. Flags
  const flags: AlgorithmicFlag[] = [];
  const hpPct = tacticalMotifs.hanging_piece.percentage_of_blunders;
  if (hpPct >= 25) {
    flags.push({
      code: "HANGING_PIECES",
      severity: hpPct >= 40 ? "CRITICAL" : "HIGH",
      metric_reference: `${pyFloat(hpPct)}% de tus errores graves provienen de piezas colgadas o desprotegidas.`,
    });
  }
  if (clock.primary_flaw === "impulsive_play") {
    flags.push({
      code: "IMPULSIVE_MOVE_SELECTION",
      severity: "HIGH",
      metric_reference: `${clock.blunders_under_3s_with_ample_time} errores jugados al instante con tiempo de sobra en el reloj.`,
    });
  } else if (clock.primary_flaw === "time_trouble_panic") {
    flags.push({
      code: "TIME_TROUBLE_PANIC",
      severity: "HIGH",
      metric_reference: `${clock.blunders_in_time_trouble_under_10s} errores graves cometidos en apuro de tiempo.`,
    });
  }
  const problem = openingGaps.filter((o) => o.games_played >= 2 && o.win_rate <= 0.35);
  if (problem.length) {
    const w = problem[0];
    flags.push({
      code: `REPERTOIRE_LEAK_${w.eco}`,
      severity: w.avg_eval_at_move_12 <= -1.5 ? "HIGH" : "MEDIUM",
      metric_reference: `En ${w.name} (${w.eco}) obtienes solo un ${pyFixed0(w.win_rate * 100)}% de victorias con una evaluación media de ${pyFloat(w.avg_eval_at_move_12)} en la jugada 12.`,
    });
  }
  if (flags.length < 3 && phaseDist.middlegame.percentage_of_blunders >= 50) {
    flags.push({
      code: "MIDDLEGAME_COLLAPSE",
      severity: "MEDIUM",
      metric_reference: `${pyFloat(phaseDist.middlegame.percentage_of_blunders)}% de los errores ocurren durante la fase de medio juego.`,
    });
  }
  if (flags.length < 3) {
    flags.push({
      code: "GENERAL_TACTICAL_CALCULATION",
      severity: "MEDIUM",
      metric_reference: `Pérdida media de centipeones de ${pyFloat(avgCpl)} CPL por jugada.`,
    });
  }

  const g0 = games[0];
  const summary: PlayerDiagnosisSummary = {
    player: {
      username,
      elo_current: g0.user_color === "white" ? g0.white_rating : g0.black_rating,
      time_class: timeClass,
      games_analyzed: total,
      period: formatPeriod(games),
    },
    overall_metrics: {
      win_rate: rate(wins),
      draw_rate: rate(draws),
      loss_rate: rate(losses),
      avg_centipawn_loss: avgCpl,
      accuracy_score: overallAccuracy(evaluatedGamesMoves),
    },
    error_breakdown: {
      blunders_total: blundersTotal,
      errors_total: count("error"),
      inaccuracies_total: count("inaccuracy"),
      blunders_per_game: total ? pyRound(blundersTotal / total, 2) : 0,
    },
    phase_distribution: phaseDist,
    tactical_motifs: tacticalMotifs,
    clock_psychology: clock,
    opening_repertoire_gaps: openingGaps,
    top_3_algorithmic_flags: flags.slice(0, 3),
  };
  return { summary, puzzles };
}
