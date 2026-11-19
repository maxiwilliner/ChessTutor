/** Mismos casos que backend/tests/test_games.py. */
import { describe, expect, it } from "vitest";
import type { Classification, EvaluatedMove, NormalizedGame, Phase, Termination } from "./types";
import { parseTermination } from "./parser";
import { buildGameRecap, buildGameStats } from "./games";
import { analyzeClockUsage } from "./clock";

const FEN = "8/8/8/8/8/8/8/8 w - - 0 1";

function game(o: { result?: NormalizedGame["user_result"]; termination?: Termination; color?: "white" | "black"; tc?: string; userElo?: number; oppElo?: number; id?: string } = {}): NormalizedGame {
  const { result = "win", termination = "checkmate", color = "white", tc = "600", userElo = 1500, oppElo = 1500, id = "g1" } = o;
  const white = color === "white";
  return {
    id,
    url: `https://www.chess.com/game/live/${id}`,
    white_username: white ? "yo" : "opp_zq",
    white_rating: white ? userElo : oppElo,
    white_result: "",
    black_username: white ? "opp_zq" : "yo",
    black_rating: white ? oppElo : userElo,
    black_result: "",
    user_color: color,
    user_result: result,
    time_control: tc,
    time_class: "rapid",
    eco: "Unknown",
    opening_name: "Unknown Opening",
    end_time: 1700000000,
    moves_count: 0,
    moves: [],
    termination,
  };
}

function move(
  n: number,
  before: number,
  after: number,
  o: { spent?: number; remaining?: number; classification?: Classification; phase?: Phase; turn?: "white" | "black" } = {}
): EvaluatedMove {
  const { spent = 5, remaining = 500, classification = "good", phase = "middlegame", turn = "white" } = o;
  return {
    ply: turn === "white" ? 2 * n - 1 : 2 * n,
    move_number: n,
    turn,
    user_move_uci: "a1a2",
    user_move_san: "Ra2",
    fen_before: FEN,
    fen_after: FEN,
    time_spent_seconds: spent,
    clock_remaining_seconds: remaining,
    eval_before_cp: before,
    eval_after_cp: after,
    cpl: Math.max(0, before - after),
    classification,
    best_move_uci: null,
    best_move_san: null,
    pv_uci: [],
    pv_san: [],
    refutation_uci: [],
    refutation_san: [],
    phase,
    tactical_theme: null,
    psychological_tag: "normal",
  };
}

describe("cómo terminó la partida", () => {
  it.each([
    ["rival won on time", "timeout"],
    ["yo won by checkmate", "checkmate"],
    ["rival won by resignation", "resignation"],
    ["yo won - game abandoned", "abandoned"],
    ["Game drawn by agreement", "agreement"],
    ["Game drawn by repetition", "repetition"],
    ["Game drawn by stalemate", "stalemate"],
    ["Game drawn by insufficient material", "insufficient"],
    ["Game drawn by timeout vs insufficient material", "timeout_vs_insufficient"],
    ["Game drawn by 50-move rule", "fifty_moves"],
    ["", "other"],
  ])("%s -> %s", (text, code) => expect(parseTermination(text)).toBe(code));
});

describe("resumen por partida", () => {
  it("ventaja desperdiciada: jugada y ejercicio", () => {
    const moves = [move(10, 50, 320), move(11, 350, 340), move(12, 340, 40, { classification: "blunder" }), move(13, -200, -400)];
    const r = buildGameRecap(game({ result: "loss" }), moves, new Set(["bb_g1_m12_white"]));
    expect([r.advantage, r.advantage_lost_move, r.advantage_lost_puzzle_id, r.disadvantage]).toEqual(["thrown", 12, "bb_g1_m12_white", null]);
    expect([r.max_eval, r.min_eval]).toEqual([3.5, -4]);
  });

  it("ventaja convertida y remontada", () => {
    const moves = [move(5, -350, -330, { turn: "black" }), move(6, -100, -90, { turn: "black" }), move(7, 400, 420, { turn: "black" })];
    const r = buildGameRecap(game({ color: "black" }), moves, new Set());
    expect([r.advantage, r.advantage_lost_move, r.disadvantage, r.user_rating, r.opponent_username]).toEqual([
      "converted",
      null,
      "saved_win",
      1500,
      "opp_zq",
    ]);
  });

  it("precisión del rival entre mis jugadas", () => {
    const r = buildGameRecap(game(), [move(1, 0, 0), move(2, 500, 500)], new Set());
    expect(r.user_accuracy).toBe(100);
    expect(r.opponent_accuracy!).toBeLessThan(20);
  });

  it("agregados", () => {
    const s = buildGameStats([
      buildGameRecap(game({ oppElo: 1600, id: "a" }), [move(1, 0, 0), move(2, 400, 400)], new Set()),
      buildGameRecap(game({ result: "loss", oppElo: 1400, id: "b" }), [move(1, 400, 0), move(2, 0, -50)], new Set()),
      buildGameRecap(game({ result: "draw", oppElo: 1520, id: "c" }), [move(1, -400, -400), move(2, -10, 0)], new Set()),
    ]);
    expect([s.advantage.games_with_advantage, s.advantage.converted, s.advantage.thrown]).toEqual([2, 1, 1]);
    expect([s.advantage.games_with_disadvantage, s.advantage.saved_draw]).toEqual([1, 1]);
    expect([s.by_rating_gap.stronger.games, s.by_rating_gap.stronger.win_rate]).toEqual([1, 1]);
    expect(s.by_rating_gap.weaker.losses).toBe(1);
    expect(s.by_rating_gap.similar.draws).toBe(1);
    expect(s.vs_opponent.games_compared).toBe(3);
  });
});

describe("uso del reloj", () => {
  it("tramos, finales por tiempo, fases y rápidas vs pensadas", () => {
    const moves = [
      move(5, 0, 0, { spent: 2, remaining: 550, phase: "opening" }),
      move(9, 0, 0, { spent: 1, remaining: 400 }),
      move(10, 0, -300, { spent: 30, remaining: 200, classification: "blunder" }),
      move(11, 0, -300, { spent: 10, remaining: 100, classification: "error", phase: "endgame" }),
      move(12, 0, 0, { spent: 2, remaining: 30, phase: "endgame" }),
    ];
    const out = analyzeClockUsage([game({ result: "loss", termination: "timeout" }), game({ tc: "1/86400", id: "d" })], [moves, [move(1, 0, 0)]]);
    expect(Object.fromEntries(out.error_rate_by_clock!.map((b) => [b.bucket, [b.moves, b.serious_errors]]))).toEqual({
      gt50: [2, 0],
      "25_50": [1, 1],
      "10_25": [1, 1],
      lt10: [1, 0],
    });
    expect(out.time_endings).toEqual({ games_with_clock: 1, games_low_clock: 1, lost_on_time: 1, won_on_time: 0 });
    expect(out.time_by_phase!.opening).toBe(0.3);
    const f = out.fast_vs_thought!;
    expect([f.fast.moves, f.thought.moves, f.fast.accuracy, f.fast_threshold_seconds, f.thought_threshold_seconds]).toEqual([2, 1, 100, 3, 18]);
    expect(f.thought.accuracy).toBeLessThan(50);
  });
});
