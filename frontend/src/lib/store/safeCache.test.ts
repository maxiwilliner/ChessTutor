import { describe, expect, it } from "vitest";
import { memoryBackend, type LocalBackend } from "./localBackend";
import { isQuotaError, safeEvalCache } from "./local";
import type { PositionEvaluation } from "@/analysis/types";

const EV: PositionEvaluation = { fen: "x", depth: 11, score_cp: 10, mate_in: null, best_move_uci: "e2e4", best_move_san: "e4", pv_uci: [], pv_san: [] };
const quota = () => Object.assign(new Error("lleno"), { name: "QuotaExceededError" });

describe("caché de evaluaciones a prueba de fallos", () => {
  it("si el disco se llena, vacía la caché y no rompe el análisis", async () => {
    const mem = memoryBackend();
    await mem.evalSetMany([["a", EV]]);
    const b: LocalBackend = { ...mem, evalSetMany: async () => Promise.reject(quota()) };
    const cache = safeEvalCache(async () => b);
    await expect(cache.setMany([["b", EV]])).resolves.toBeUndefined();
    expect((await mem.evalGetMany(["a"])).size).toBe(0);
  });

  it("si leer falla, devuelve vacío", async () => {
    const b: LocalBackend = { ...memoryBackend(), evalGetMany: async () => Promise.reject(new Error("IndexedDB cerrada")) };
    await expect(safeEvalCache(async () => b).getMany(["a"])).resolves.toEqual(new Map());
  });

  it("detecta errores de cuota", () => {
    expect(isQuotaError(quota())).toBe(true);
    expect(isQuotaError(new Error("otro"))).toBe(false);
  });
});
