/** Port de `backend/app/modules/heuristics/clock.py`. */
import type { ClockPsychology } from "@/types/api";
import type { EvaluatedMove, PsychTag } from "./types";
import { pyRound } from "./scoring";

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
