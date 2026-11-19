/**
 * Port de `backend/app/modules/heuristics/games.py`: resumen por partida (Elo, precisión tuya y del rival)
 * y conversión de ventaja. La precisión del rival sale de `eval_after` de tu jugada y `eval_before` de la siguiente.
 */
import type { GameRecap, GameStats, RatingGapBucket, RatingGapKey } from "@/types/api";
import type { EvaluatedMove, NormalizedGame } from "./types";
import { clampCp, moveAccuracy, pyRound } from "./scoring";

const ADVANTAGE_CP = 300;
const LOST_BELOW_CP = 100;
const SIMILAR_RATING = 50;

export function combineAccuracies(acc: number[]): number {
  if (!acc.length) return 0;
  const arithmetic = acc.reduce((a, b) => a + b, 0) / acc.length;
  const harmonic = acc.length / acc.reduce((s, a) => s + 1 / Math.max(a, 1), 0);
  return (arithmetic + harmonic) / 2;
}

export function opponentMoveAccuracies(moves: EvaluatedMove[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < moves.length; i++) {
    const [a, b] = [moves[i], moves[i + 1]];
    if (b.ply !== a.ply + 2) continue;
    out.push(moveAccuracy(-a.eval_after_cp, -b.eval_before_cp));
  }
  return out;
}

const ADVANTAGE: Record<NormalizedGame["user_result"], GameRecap["advantage"]> = { win: "converted", draw: "drawn", loss: "thrown" };
const DISADVANTAGE: Record<NormalizedGame["user_result"], GameRecap["disadvantage"]> = {
  win: "saved_win",
  draw: "saved_draw",
  loss: "lost",
};

export function buildGameRecap(game: NormalizedGame, moves: EvaluatedMove[], puzzleIds: Set<string>): GameRecap {
  const white = game.user_color === "white";
  const oppAccs = opponentMoveAccuracies(moves);
  const series = moves.map((m) => clampCp(m.eval_before_cp));
  if (moves.length) series.push(clampCp(moves[moves.length - 1].eval_after_cp));

  const advantage = moves.some((m) => clampCp(m.eval_before_cp) >= ADVANTAGE_CP) ? ADVANTAGE[game.user_result] : null;
  const disadvantage = moves.some((m) => clampCp(m.eval_before_cp) <= -ADVANTAGE_CP) ? DISADVANTAGE[game.user_result] : null;

  let lostMove: number | null = null;
  let lostPuzzle: string | null = null;
  if (advantage === "drawn" || advantage === "thrown") {
    let seen = false;
    for (const m of moves) {
      if (clampCp(m.eval_before_cp) >= ADVANTAGE_CP) seen = true;
      if (seen && clampCp(m.eval_after_cp) < LOST_BELOW_CP) {
        lostMove = m.move_number;
        const pid = `bb_${game.id}_m${m.move_number}_${m.turn}`;
        lostPuzzle = puzzleIds.has(pid) ? pid : null;
        break;
      }
    }
  }

  return {
    id: game.id,
    url: game.url,
    end_time: game.end_time,
    color: game.user_color,
    result: game.user_result,
    termination: game.termination,
    user_rating: white ? game.white_rating : game.black_rating,
    opponent_rating: white ? game.black_rating : game.white_rating,
    opponent_username: white ? game.black_username : game.white_username,
    eco: game.eco,
    opening_name: game.opening_name,
    moves_count: game.moves_count,
    user_accuracy: moves.length ? pyRound(combineAccuracies(moves.map((m) => moveAccuracy(m.eval_before_cp, m.eval_after_cp))), 1) : null,
    opponent_accuracy: oppAccs.length ? pyRound(combineAccuracies(oppAccs), 1) : null,
    max_eval: series.length ? pyRound(Math.max(...series) / 100, 2) : 0,
    min_eval: series.length ? pyRound(Math.min(...series) / 100, 2) : 0,
    advantage,
    disadvantage,
    advantage_lost_move: lostMove,
    advantage_lost_puzzle_id: lostPuzzle,
  };
}

export function ratingGapKey(r: Pick<GameRecap, "opponent_rating" | "user_rating">): RatingGapKey {
  const gap = r.opponent_rating - r.user_rating;
  if (gap > SIMILAR_RATING) return "stronger";
  if (gap < -SIMILAR_RATING) return "weaker";
  return "similar";
}

export function buildGameStats(recaps: GameRecap[]): GameStats {
  const adv = recaps.filter((r) => r.advantage);
  const dis = recaps.filter((r) => r.disadvantage);
  const compared = recaps.filter((r) => r.user_accuracy !== null && r.opponent_accuracy !== null);
  const better = compared.filter((r) => r.user_accuracy! > r.opponent_accuracy!);
  const worse = compared.filter((r) => r.user_accuracy! < r.opponent_accuracy!);
  const n = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

  const gap = (key: RatingGapKey): RatingGapBucket => {
    const rs = recaps.filter((r) => ratingGapKey(r) === key);
    const wins = n(rs, (r) => r.result === "win");
    const draws = n(rs, (r) => r.result === "draw");
    return { games: rs.length, wins, draws, losses: rs.length - wins - draws, win_rate: rs.length ? pyRound(wins / rs.length, 2) : 0 };
  };

  return {
    advantage: {
      games_with_advantage: adv.length,
      converted: n(adv, (r) => r.advantage === "converted"),
      drawn: n(adv, (r) => r.advantage === "drawn"),
      thrown: n(adv, (r) => r.advantage === "thrown"),
      games_with_disadvantage: dis.length,
      saved_draw: n(dis, (r) => r.disadvantage === "saved_draw"),
      saved_win: n(dis, (r) => r.disadvantage === "saved_win"),
      lost: n(dis, (r) => r.disadvantage === "lost"),
    },
    vs_opponent: {
      games_compared: compared.length,
      played_better: better.length,
      played_better_lost: n(better, (r) => r.result === "loss"),
      played_worse_won: n(worse, (r) => r.result === "win"),
    },
    by_rating_gap: { stronger: gap("stronger"), similar: gap("similar"), weaker: gap("weaker") },
  };
}
