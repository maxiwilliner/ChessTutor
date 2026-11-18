/** Port de `backend/app/modules/engine/evaluator.py` (two-pass + refutación). */
import { Chess } from "chess.js";
import type { EvaluatedMove, NormalizedGame, Phase, PositionEvaluation } from "./types";
import type { Engine, EvalLimits } from "./engine/pool";
import { centipawnLoss, classifyMove, pyRound } from "./scoring";

export interface AnalysisDepth {
  fast: EvalLimits;
  deep: EvalLimits;
}

/** Mismas profundidades que el backend (STOCKFISH_DEPTH_FAST/DEEP). El tiempo se amplía: el WASM lite es más lento que el nativo. */
export const DEFAULT_DEPTH: AnalysisDepth = {
  fast: { depth: 11, movetime: 80 },
  deep: { depth: 15, movetime: 400 },
};

/** Caché de evaluaciones (IndexedDB en el navegador, Map en tests). */
export interface EvalCache {
  getMany(keys: string[]): Promise<Map<string, PositionEvaluation>>;
  setMany(entries: [string, PositionEvaluation][]): Promise<void>;
}

export const cacheKey = (fen: string, depth: number) => `${depth}|${fen}`;

export function determinePhase(fen: string, moveNumber: number): Phase {
  if (moveNumber <= 12) return "opening";
  const values: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 };
  let material = 0;
  for (const row of new Chess(fen).board()) for (const p of row) if (p) material += values[p.type] ?? 0;
  return material <= 13 ? "endgame" : "middlegame";
}

// `|| 0` normaliza -0 (en Python, -0 de un entero es 0)
export const getPlayerEval = (scoreCp: number | null, userIsWhite: boolean) =>
  scoreCp === null ? 0 : (userIsWhite ? scoreCp : -scoreCp) || 0;

export async function evaluateMany(
  fens: string[],
  limits: EvalLimits,
  engine: Engine,
  cache?: EvalCache,
  signal?: AbortSignal
): Promise<PositionEvaluation[]> {
  const unique = Array.from(new Set(fens));
  const results = new Map<string, PositionEvaluation>();
  if (cache) {
    const hit = await cache.getMany(unique.map((f) => cacheKey(f, limits.depth)));
    unique.forEach((f) => {
      const ev = hit.get(cacheKey(f, limits.depth));
      if (ev) results.set(f, ev);
    });
  }
  const missing = unique.filter((f) => !results.has(f));
  const fresh = await Promise.all(missing.map((f) => engine.evaluate(f, limits, signal)));
  missing.forEach((f, i) => results.set(f, fresh[i]));
  if (cache && fresh.length) {
    await cache.setMany(fresh.filter((e) => e.depth !== 99).map((e) => [cacheKey(e.fen, limits.depth), e]));
  }
  return fens.map((f) => results.get(f)!);
}

const isMistake = (c: string) => c === "inaccuracy" || c === "error" || c === "blunder";

export async function evaluateGameSmart(
  game: NormalizedGame,
  engine: Engine,
  depth: AnalysisDepth = DEFAULT_DEPTH,
  cache?: EvalCache,
  signal?: AbortSignal
): Promise<EvaluatedMove[]> {
  if (!game.moves.length) return [];
  const userIsWhite = game.user_color === "white";
  const pe = (ev: PositionEvaluation) => getPlayerEval(ev.score_cp, userIsWhite);

  // Pasada 1
  const fast = await evaluateMany([game.moves[0].fen_before, ...game.moves.map((m) => m.fen_after)], depth.fast, engine, cache, signal);

  const userIdx = game.moves.flatMap((m, i) => (m.turn === game.user_color ? [i] : []));
  const candidates = userIdx.filter((i) => isMistake(classifyMove(pe(fast[i]), pe(fast[i + 1]))));

  // Pasada 2: antes y después de cada candidata
  const deepList = await evaluateMany(
    candidates.flatMap((i) => [game.moves[i].fen_before, game.moves[i].fen_after]),
    depth.deep,
    engine,
    cache,
    signal
  );
  const deep = new Map(candidates.map((i, k) => [i, [deepList[2 * k], deepList[2 * k + 1]] as const]));

  return userIdx.map((i) => {
    const mv = game.moves[i];
    const [before, after] = deep.get(i) ?? [fast[i], fast[i + 1]];
    const evalBefore = pe(before);
    const evalAfter = pe(after);
    const classification = classifyMove(evalBefore, evalAfter);
    const mistake = isMistake(classification);
    return {
      ply: mv.ply,
      move_number: mv.move_number,
      turn: mv.turn,
      user_move_uci: mv.uci,
      user_move_san: mv.san,
      fen_before: mv.fen_before,
      fen_after: mv.fen_after,
      time_spent_seconds: mv.time_spent_seconds,
      clock_remaining_seconds: mv.clock_remaining_seconds,
      eval_before_cp: pyRound(evalBefore, 1),
      eval_after_cp: pyRound(evalAfter, 1),
      cpl: pyRound(centipawnLoss(evalBefore, evalAfter), 1),
      classification,
      best_move_uci: before.best_move_uci,
      best_move_san: before.best_move_san,
      pv_uci: before.pv_uci,
      pv_san: before.pv_san,
      refutation_uci: mistake ? after.pv_uci.slice(0, 3) : [],
      refutation_san: mistake ? after.pv_san.slice(0, 3) : [],
      phase: determinePhase(mv.fen_before, mv.move_number),
      tactical_theme: null,
      psychological_tag: "normal",
    };
  });
}
