/** Port de `backend/app/modules/heuristics/clock.py`. */
import type { ClockBucketCode, ClockPsychology } from "@/types/api";
import type { EvaluatedMove, NormalizedGame, Phase, PsychTag } from "./types";
import { moveAccuracy, pyRound } from "./scoring";
import { parseTimeControl } from "./parser";

const DEFAULT_BASE_SECONDS = 600;
const base = (t: number) => (t > 0 ? t : DEFAULT_BASE_SECONDS);

export const timeTroubleThreshold = (baseTime: number) => Math.min(30, Math.max(10, 0.05 * base(baseTime)));
export const impulsiveMoveThreshold = (baseTime: number) => Math.min(3, Math.max(1, 0.02 * base(baseTime)));

export function tagMovePsychology(timeSpent: number, clockRemaining: number, isSeriousError: boolean, baseTime = 0): PsychTag {
  if (!isSeriousError) return "normal";
  if (clockRemaining < timeTroubleThreshold(baseTime)) return "time_trouble";
  if (timeSpent <= impulsiveMoveThreshold(baseTime) && clockRemaining >= 0.25 * base(baseTime)) return "impulsive";
  return "normal";
}

export function analyzeClockPsychology(moves: EvaluatedMove[]): ClockPsychology {
  const serious = moves.filter((m) => m.classification === "blunder" || m.classification === "error");
  const good = moves.filter((m) => m.classification === "best" || m.classification === "good");
  const impulsive = serious.filter((m) => m.psychological_tag === "impulsive").length;
  const trouble = serious.filter((m) => m.psychological_tag === "time_trouble").length;
  const avg = (xs: EvaluatedMove[]) => (xs.length ? pyRound(xs.reduce((s, m) => s + m.time_spent_seconds, 0) / xs.length, 1) : 0);
  const avgBlunder = avg(serious);
  const avgGood = avg(good);

  let primary: ClockPsychology["primary_flaw"] = "none";
  if (impulsive >= 3 && impulsive >= trouble) primary = "impulsive_play";
  else if (trouble >= 3 && trouble > impulsive) primary = "time_trouble_panic";

  return {
    blunders_under_3s_with_ample_time: impulsive,
    blunders_in_time_trouble_under_10s: trouble,
    primary_flaw: primary,
    avg_time_on_blunders_seconds: avgBlunder,
    avg_time_on_good_moves_seconds: avgGood,
    blunder_time_ratio: avgGood > 0 ? pyRound(avgBlunder / avgGood, 2) : 1,
  };
}

// ---- Uso del reloj (port de `analyze_clock_usage`) ----

/** Tramos del reloj antes de mover (fracción del tiempo inicial): [código, mínimo incluido]. */
const CLOCK_BUCKETS: [ClockBucketCode, number][] = [
  ["gt50", 0.5],
  ["25_50", 0.25],
  ["10_25", 0.1],
  ["lt10", 0],
];
const LOW_CLOCK_FRACTION = 0.1;
/** Las primeras jugadas son teoría: rápidas y buenas, sesgarían "rápidas vs pensadas". */
const SKIP_OPENING_MOVES = 8;

/** Jugada "pensada": al menos el 3 % del tiempo inicial (entre 5 y 60 s). */
export const thoughtMoveThreshold = (baseTime: number) => Math.min(60, Math.max(5, 0.03 * base(baseTime)));

const meanOrZero = (xs: number[], digits = 1) => (xs.length ? pyRound(xs.reduce((a, b) => a + b, 0) / xs.length, digits) : 0);

export type ClockUsage = Pick<ClockPsychology, "error_rate_by_clock" | "time_endings" | "time_by_phase" | "fast_vs_thought">;

export function analyzeClockUsage(games: NormalizedGame[], evaluatedGamesMoves: EvaluatedMove[][]): ClockUsage {
  const buckets = new Map<ClockBucketCode, [number, number]>(CLOCK_BUCKETS.map(([c]) => [c, [0, 0]]));
  const phasePct: Record<Phase, number[]> = { opening: [], middlegame: [], endgame: [] };
  const fastAcc: number[] = [];
  const thoughtAcc: number[] = [];
  let gamesWithClock = 0;
  let gamesLow = 0;
  let lostOnTime = 0;
  let wonOnTime = 0;
  let fastLimit: number | null = null;
  let thoughtLimit: number | null = null;

  games.forEach((game, gi) => {
    const moves = evaluatedGamesMoves[gi];
    const [baseTime, inc] = parseTimeControl(game.time_control);
    if (baseTime <= 0 || !moves.length) return;
    gamesWithClock++;
    if (game.termination === "timeout") {
      if (game.user_result === "loss") lostOnTime++;
      else if (game.user_result === "win") wonOnTime++;
    }
    if (moves.some((m) => m.clock_remaining_seconds < LOW_CLOCK_FRACTION * baseTime)) gamesLow++;

    const spent: Record<Phase, number> = { opening: 0, middlegame: 0, endgame: 0 };
    const fLim = impulsiveMoveThreshold(baseTime);
    const tLim = thoughtMoveThreshold(baseTime);
    fastLimit ??= fLim;
    thoughtLimit ??= tLim;
    for (const m of moves) {
      spent[m.phase] += m.time_spent_seconds;
      const before = (m.clock_remaining_seconds + m.time_spent_seconds - inc) / baseTime;
      const hit = CLOCK_BUCKETS.find(([, low]) => before >= low);
      if (hit) {
        const b = buckets.get(hit[0])!;
        b[0]++;
        if (m.classification === "blunder" || m.classification === "error") b[1]++;
      }
      if (m.move_number > SKIP_OPENING_MOVES) {
        const acc = moveAccuracy(m.eval_before_cp, m.eval_after_cp);
        if (m.time_spent_seconds <= fLim) fastAcc.push(acc);
        else if (m.time_spent_seconds >= tLim) thoughtAcc.push(acc);
      }
    }
    (Object.keys(spent) as Phase[]).forEach((ph) => phasePct[ph].push((spent[ph] / baseTime) * 100));
  });

  if (!gamesWithClock) return {};

  return {
    error_rate_by_clock: CLOCK_BUCKETS.map(([code]) => {
      const [n, errs] = buckets.get(code)!;
      return { bucket: code, moves: n, serious_errors: errs, error_rate: n ? pyRound((errs / n) * 100, 1) : 0 };
    }),
    time_endings: { games_with_clock: gamesWithClock, games_low_clock: gamesLow, lost_on_time: lostOnTime, won_on_time: wonOnTime },
    time_by_phase: {
      opening: meanOrZero(phasePct.opening),
      middlegame: meanOrZero(phasePct.middlegame),
      endgame: meanOrZero(phasePct.endgame),
    },
    fast_vs_thought: {
      fast: { moves: fastAcc.length, accuracy: meanOrZero(fastAcc) },
      thought: { moves: thoughtAcc.length, accuracy: meanOrZero(thoughtAcc) },
      fast_threshold_seconds: pyRound(fastLimit ?? 0, 1),
      thought_threshold_seconds: pyRound(thoughtLimit ?? 0, 1),
    },
  };
}
