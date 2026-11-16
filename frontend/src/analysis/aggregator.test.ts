import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/pipeline.json";
import { assembleDiagnosisAndPuzzles } from "./aggregator";
import { generateDeterministicTutorReport } from "./tutor";
import { parseGamePgn } from "./parser";
import { classifyMove, moveAccuracy, winPercent, centipawnLoss } from "./scoring";
import { uciLineToSan } from "./notation";
import type { EvaluatedMove, NormalizedGame } from "./types";

const MATE_IN_2 = 10000 - 200;

function inputs() {
  const games = fixture.games.map((g) => {
    const game = parseGamePgn(g.pgn, fixture.username) as NormalizedGame;
    game.end_time = g.end_time;
    return game;
  });
  // Las jugadas del fixture ya traen tema y etiqueta calculados por Python: se borran para recalcularlos.
  const evaluated = (fixture.evaluated as unknown as EvaluatedMove[][]).map((moves) =>
    moves.map((m) => ({ ...m, tactical_theme: null, psychological_tag: "normal" as const }))
  );
  return { games, evaluated };
}

describe("scoring (equivalencia con scoring.py)", () => {
  it("clasificación y precisión", () => {
    expect(classifyMove(1500, 900)).toMatch(/best|good/);
    expect(classifyMove(50, -350)).toBe("blunder");
    expect(classifyMove(MATE_IN_2, 0)).toBe("blunder");
    expect(classifyMove(100, 0)).toBe("inaccuracy");
    expect(classifyMove(100, -60)).toBe("error");
    expect(centipawnLoss(MATE_IN_2, -MATE_IN_2)).toBe(2000);
    expect(winPercent(0)).toBeCloseTo(50);
    expect(moveAccuracy(100, 300)).toBe(100);
  });

  it("clasificaciones del fixture coinciden", () => {
    for (const m of (fixture.evaluated as unknown as EvaluatedMove[][]).flat()) {
      expect(classifyMove(m.eval_before_cp, m.eval_after_cp)).toBe(m.classification);
      expect(centipawnLoss(m.eval_before_cp, m.eval_after_cp)).toBeCloseTo(m.cpl, 1);
    }
  });

  it("uciLineToSan", () => {
    expect(uciLineToSan("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ["e2e4", "e7e5", "g1f3"])).toEqual(["e4", ["e4", "e5", "Nf3"]]);
  });
});

describe("agregador y tutor (equivalencia con aggregator.py / llm_service.py)", () => {
  const { games, evaluated } = inputs();
  const { summary, puzzles } = assembleDiagnosisAndPuzzles(fixture.username, fixture.time_class, games, evaluated);

  it("tema táctico y etiqueta psicológica por jugada", () => {
    const expected = (fixture.evaluated as unknown as EvaluatedMove[][]).flat();
    evaluated.flat().forEach((m, i) => {
      expect([m.ply, m.tactical_theme]).toEqual([expected[i].ply, expected[i].tactical_theme]);
      expect(m.psychological_tag).toBe(expected[i].psychological_tag);
    });
  });

  it("resumen idéntico", () => {
    expect(summary).toEqual(fixture.summary);
  });

  it("ejercicios idénticos", () => {
    expect(puzzles).toEqual(fixture.puzzles);
  });

  it("informe por reglas idéntico", () => {
    expect(generateDeterministicTutorReport(summary)).toEqual(fixture.report);
  });
});
