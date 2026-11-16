/** Prueba de humo con el Stockfish WASM real (el mismo que usa el navegador), ejecutado en Node. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fixture from "./__fixtures__/pipeline.json";
import { createNodeEngine } from "./engine/node";
import type { EnginePool } from "./engine/pool";
import { evaluateGameSmart, DEFAULT_DEPTH } from "./evaluator";
import { parseGamePgn } from "./parser";
import { assembleDiagnosisAndPuzzles } from "./aggregator";
import type { NormalizedGame } from "./types";

let engine: EnginePool;
beforeAll(async () => {
  engine = await createNodeEngine();
}, 30_000);
afterAll(() => engine?.dispose());

describe("Stockfish WASM en Node", () => {
  it("evalúa una posición y encuentra el mate", async () => {
    const ev = await engine.evaluate("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/5N2/PPPP1PPP/RNB1K2R w KQkq - 4 4", { depth: 10 });
    expect(ev.best_move_uci).toBe("h5f7");
    expect(ev.mate_in).toBe(1);
  });

  it("pipeline completo sobre 2 partidas reales, coherente con Python", async () => {
    const games = fixture.games.slice(0, 2).map((g) => {
      const game = parseGamePgn(g.pgn, fixture.username) as NormalizedGame;
      game.end_time = g.end_time;
      return game;
    });
    const started = Date.now();
    const evaluated = [];
    for (const game of games) evaluated.push(await evaluateGameSmart(game, engine, DEFAULT_DEPTH));
    const { summary } = assembleDiagnosisAndPuzzles(fixture.username, "rapid", games, evaluated);
    const seconds = (Date.now() - started) / 1000;

    // Motor distinto (lite WASM vs nativo): no idéntico, pero del mismo orden.
    const pyBlunders = (fixture.evaluated as { classification: string }[][]).slice(0, 2).flat().filter((m) => m.classification === "blunder").length;
    const tsBlunders = evaluated.flat().filter((m) => m.classification === "blunder").length;
    console.log(`2 partidas en ${seconds.toFixed(1)} s · blunders TS ${tsBlunders} / Python ${pyBlunders} · precisión ${summary.overall_metrics.accuracy_score}`);
    expect(Math.abs(tsBlunders - pyBlunders)).toBeLessThanOrEqual(2);
    expect(summary.overall_metrics.accuracy_score).toBeGreaterThan(30);
  }, 180_000);
});
