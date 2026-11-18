import { describe, expect, it } from "vitest";
import fixture from "@/analysis/__fixtures__/pipeline.json";
import type { BlunderBankItem, PuzzleAttemptRequest } from "@/types/api";
import { applyAttempt, selectPuzzles, trainerStats, topLeakTheme, type PuzzleProgress } from "./trainerLogic";

const puzzles = fixture.puzzles as unknown as BlunderBankItem[];
const user = "demo_player";
const req = (puzzle_id: string, extra: Partial<PuzzleAttemptRequest> = {}): PuzzleAttemptRequest => ({
  username: user,
  puzzle_id,
  played_uci: "e2e4",
  is_solved: true,
  ...extra,
});

describe("repetición espaciada (equivalencia con record_puzzle_attempt)", () => {
  it("tres aciertos limpios dominan la posición; repetir el error la reinicia", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    let p: PuzzleProgress | undefined;
    const steps = [req("x"), req("x"), req("x"), req("x", { is_solved: false, repeated_old_blunder: true })];
    const out = steps.map((r) => {
      const res = applyAttempt(p, r, now);
      p = res.progress;
      return res.response;
    });
    expect(out.map((r) => r.consecutive_correct)).toEqual([1, 2, 3, 0]);
    expect(out.map((r) => r.is_mastered)).toEqual([false, false, true, false]);
    expect(out[2].next_review_at).toBe("2026-01-08T00:00:00.000Z");
    expect(out[3].message).toContain("Has repetido tu error");
    expect(p!.repeated_old_blunder_count).toBe(1);
  });

  it("resolver con pistas o tras fallar no suma racha", () => {
    let p = applyAttempt(undefined, req("y")).progress;
    p = applyAttempt(p, req("y")).progress;
    expect(applyAttempt(p, req("y", { hints_used: 1 })).progress.consecutive_correct).toBe(0);
    expect(applyAttempt(p, req("y", { mistakes: 2 })).progress.consecutive_correct).toBe(0);
  });
});

describe("selección de ejercicios", () => {
  it("fuga n.º 1 ignora el tema genérico", () => {
    expect(topLeakTheme(puzzles)).not.toBe("tactical_inaccuracy");
    const leak = selectPuzzles(puzzles, new Map(), { top_leak_only: true });
    expect(leak.length).toBeGreaterThan(0);
    expect(new Set(leak.map((p) => p.classification.theme)).size).toBe(1);
  });

  it("orden: vencidos, nuevos, en curso, dominados; peor error primero", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const [a, b, c] = puzzles;
    const progress = new Map<string, PuzzleProgress>([
      [a.id, { ...applyAttempt(undefined, req(a.id), new Date("2026-01-01T00:00:00Z")).progress }], // vencido
      [b.id, { ...applyAttempt(undefined, req(b.id), now).progress, is_mastered: true, next_review_at: "2026-02-01T00:00:00Z" }],
    ]);
    const ordered = selectPuzzles(puzzles, progress, {}, now);
    expect(ordered[0].id).toBe(a.id);
    expect(ordered[ordered.length - 1].id).toBe(b.id);
    const unseen = ordered.slice(1, -1);
    unseen.slice(1).forEach((p, i) => expect(unseen[i].engine_solution.cpl).toBeGreaterThanOrEqual(p.engine_solution.cpl));
    expect(ordered.find((p) => p.id === c.id)!.attempts_count).toBe(0);

    const stats = trainerStats(user, puzzles, progress, now);
    expect(stats).toMatchObject({ total_puzzles: puzzles.length, mastered_puzzles: 1, review_due_puzzles: 1 });
  });

  it("filtro psicológico", () => {
    const impulsive = selectPuzzles(puzzles, new Map(), { psych_tag: "impulsive" });
    expect(impulsive.every((p) => p.classification.psychological_tag === "impulsive")).toBe(true);
  });
});

describe("ámbito: último análisis", () => {
  it("solo los ejercicios del último análisis, en el orden de las partidas", () => {
    const latest = [puzzles[2].id, puzzles[0].id];
    const out = selectPuzzles(puzzles, new Map(), {}, new Date(), latest);
    expect(out.map((p) => p.id)).toEqual(latest);
    expect(selectPuzzles(puzzles, new Map(), {}, new Date()).length).toBe(puzzles.length);
  });
});

describe("estadísticas por ámbito", () => {
  it("cifras del último análisis; repasos pendientes de todo el banco", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const [a, b, c] = puzzles;
    const due = applyAttempt(undefined, req(c.id), new Date("2026-01-01T00:00:00Z")).progress; // c: vencido, fuera del análisis
    const progress = new Map<string, PuzzleProgress>([[c.id, due]]);
    const stats = trainerStats(user, puzzles, progress, now, [a.id, b.id]);
    expect(stats.total_puzzles).toBe(2);
    expect(stats.bank_puzzles).toBe(puzzles.length);
    expect(stats.review_due_puzzles).toBe(1);
  });
});
