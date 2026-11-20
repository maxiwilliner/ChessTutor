/**
 * Textos del análisis en dos idiomas: en español deben coincidir con lo que guarda el agregador (paridad con Python)
 * y en inglés no deben quedar restos en español.
 */
import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/pipeline.json";
import example from "../../public/example/hikaru-blitz.json";
import { assembleDiagnosisAndPuzzles } from "./aggregator";
import { flagMetricText } from "./flags";
import { generateDeterministicTutorReport } from "./tutor";
import { generateHintsForBlunder } from "./hints";
import { parseGamePgn } from "./parser";
import type { EvaluatedMove, NormalizedGame } from "./types";
import type { BlunderBankItem, PlayerDiagnosisSummary } from "@/types/api";

const SPANISH = /[áéíóúñ¿¡ÁÉÍÓÚÑ]|\b(de|la|el|tus?|para|con|partidas?|jugadas?|errores)\b/;

function inputs() {
  const games = fixture.games.map((g) => {
    const game = parseGamePgn(g.pgn, fixture.username) as NormalizedGame;
    game.end_time = g.end_time;
    return game;
  });
  const evaluated = (fixture.evaluated as unknown as EvaluatedMove[][]).map((moves) =>
    moves.map((m) => ({ ...m, tactical_theme: null, psychological_tag: "normal" as const }))
  );
  return { games, evaluated };
}

/** Resúmenes que cubren los seis códigos de aviso. */
function summaries(): PlayerDiagnosisSummary[] {
  const b = inputs();
  const base = assembleDiagnosisAndPuzzles(fixture.username, fixture.time_class, b.games, b.evaluated).summary;

  // Apuro de tiempo: todos los errores graves con el reloj casi agotado
  const t = inputs();
  t.evaluated.forEach((moves) =>
    moves.forEach((m) => {
      if (m.classification === "blunder" || m.classification === "error") m.clock_remaining_seconds = 2;
    })
  );
  const timeTrouble = assembleDiagnosisAndPuzzles(fixture.username, fixture.time_class, t.games, t.evaluated).summary;

  // Fuga de apertura: dos derrotas con la misma apertura y color
  const r = inputs();
  for (const g of r.games.slice(0, 2)) {
    Object.assign(g, { eco: "B01", opening_name: "Scandinavian Defense", user_color: r.games[0].user_color, user_result: "loss" });
  }
  const repertoire = assembleDiagnosisAndPuzzles(fixture.username, fixture.time_class, r.games, r.evaluated).summary;

  return [base, timeTrouble, repertoire, example.summary as unknown as PlayerDiagnosisSummary];
}

describe("avisos del diagnóstico", () => {
  const all = summaries();
  const codes = new Set(all.flatMap((s) => s.top_3_algorithmic_flags.map((f) => f.code.replace(/_[A-Z]\d\d$/, ""))));

  it("cubren los seis códigos", () => {
    expect([...codes].sort()).toEqual(
      ["GENERAL_TACTICAL_CALCULATION", "HANGING_PIECES", "IMPULSIVE_MOVE_SELECTION", "MIDDLEGAME_COLLAPSE", "REPERTOIRE_LEAK", "TIME_TROUBLE_PANIC"].sort()
    );
  });

  it("en español, idénticos al texto guardado por el agregador", () => {
    for (const s of all) for (const f of s.top_3_algorithmic_flags) expect(flagMetricText(f, s, "es")).toBe(f.metric_reference);
  });

  it("en inglés, sin restos en español", () => {
    for (const s of all) for (const f of s.top_3_algorithmic_flags) expect(flagMetricText(f, s, "en")).not.toMatch(SPANISH);
  });
});

describe("informe del profesor", () => {
  it("en español es el mismo que guarda el análisis", () => {
    expect(generateDeterministicTutorReport(fixture.summary as unknown as PlayerDiagnosisSummary, "es")).toEqual(fixture.report);
  });

  it("en inglés, completo y sin español", () => {
    for (const s of summaries()) {
      const r = generateDeterministicTutorReport(s, "en");
      const es = generateDeterministicTutorReport(s, "es");
      expect(r.top_3_leaks).toHaveLength(es.top_3_leaks.length);
      expect(r.weekly_plan).toHaveLength(7);
      for (const l of r.top_3_leaks) expect(l.title).toMatch(/^Leak #\d: /);
      expect(JSON.stringify(r)).not.toMatch(SPANISH);
    }
  });
});

describe("pistas", () => {
  const puzzles = [...(fixture.puzzles as unknown as BlunderBankItem[]), ...(example.puzzles as unknown as BlunderBankItem[])];
  const hintsOf = (p: BlunderBankItem, lang: "en" | "es") =>
    generateHintsForBlunder(p.classification.theme, p.engine_solution.best_move_san, p.engine_solution.best_move_uci, lang);

  it("en español, iguales a las guardadas en el ejercicio", () => {
    for (const p of puzzles) expect(hintsOf(p, "es")).toEqual(p.tutor_hints);
  });

  it("en inglés, para todos los temas y sin español", () => {
    for (const theme of ["hanging_piece", "pin_exploitation", "fork_overlooked", "missed_mate", "king_safety_collapse", "tactical_inaccuracy"]) {
      const h = generateHintsForBlunder(theme, "Nf3", "g1f3", "en");
      expect(JSON.stringify(h)).not.toMatch(SPANISH);
      expect(h.level_3_concrete).toContain("Nf3");
    }
    expect(generateHintsForBlunder("hanging_piece", "Nf3", null, "en").level_2_directional).toContain("the key square");
  });
});
