import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/pipeline.json";
import { evaluateGameSmart, DEFAULT_DEPTH } from "./evaluator";
import { parseGamePgn } from "./parser";
import { parseInfoLine, toEvaluation, terminalEvaluation } from "./engine/uci";
import type { Engine } from "./engine/pool";
import type { EvaluatedMove, NormalizedGame, PositionEvaluation } from "./types";

/** Motor falso que devuelve exactamente las evaluaciones que recibió el evaluador de Python. */
const fakeEngine: Engine = {
  size: 1,
  dispose: () => undefined,
  evaluate: async (fen, { depth }) => {
    const ev = (fixture.positions as Record<string, PositionEvaluation>)[`${depth}|${fen}`];
    if (!ev) throw new Error(`Posición no grabada: ${depth}|${fen}`);
    return ev;
  },
};

describe("evaluador (equivalencia con evaluator.py)", () => {
  fixture.games.forEach((g, i) => {
    it(`partida ${i + 1}`, async () => {
      const game = parseGamePgn(g.pgn, fixture.username) as NormalizedGame;
      const moves = await evaluateGameSmart(game, fakeEngine, DEFAULT_DEPTH);
      const expected = (fixture.evaluated[i] as unknown as EvaluatedMove[]).map((m) => ({
        ...m,
        tactical_theme: null,
        psychological_tag: "normal",
      }));
      expect(moves).toEqual(expected);
    });
  });
});

describe("UCI", () => {
  it("info con cp y mate, perspectiva de blancas", () => {
    const info = parseInfoLine("info depth 12 seldepth 18 multipv 1 score cp -35 nodes 1 nps 1 time 5 pv e7e5 g1f3")!;
    expect(info).toMatchObject({ depth: 12, scoreType: "cp", score: -35, pv: ["e7e5", "g1f3"] });
    const fenBlack = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(toEvaluation(fenBlack, 12, info)).toMatchObject({ score_cp: 35, best_move_san: "e5", pv_san: ["e5", "Nf3"] });

    const mate = parseInfoLine("info depth 5 score mate 2 pv h5f7")!;
    const fenWhite = "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    expect(toEvaluation(fenWhite, 5, mate)).toMatchObject({ score_cp: 9800, mate_in: 2 });
    expect(parseInfoLine("info depth 3 multipv 2 score cp 10 pv e2e4")).toBeNull();
  });

  it("posiciones terminales", () => {
    expect(terminalEvaluation("r1bqkbnr/pppp1Qpp/2n5/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4")?.score_cp).toBe(10000);
    expect(terminalEvaluation("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3")?.score_cp).toBe(-10000);
  });
});
