"use client";

/**
 * Demo de coste 0: el análisis corre en el navegador (Stockfish WASM) y los datos se guardan
 * solo en IndexedDB de este navegador. Ningún dato del usuario sale de su equipo, salvo las
 * peticiones de partidas públicas a api.chess.com.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BlunderBankItem, PlayerDiagnosisSummary, TutorPedagogicalReport } from "@/types/api";
import type { PositionEvaluation } from "@/analysis/types";
import type { EvalCache } from "@/analysis/evaluator";
import { runAnalysis } from "@/analysis/pipeline";
import { getProfile } from "@/analysis/chesscom";
import { getBrowserEngine } from "@/analysis/engine/browser";
import { applyAttempt, evaluateAlternativeMove, selectPuzzles, trainerStats, progressKey, type PuzzleProgress } from "./trainerLogic";
import type { DataStore } from "./types";

const DB_NAME = "chesstutor-demo";
/** Tope de la caché de evaluaciones (~250 B cada una -> ~5 MB). */
const EVAL_CACHE_MAX = 20_000;

interface StoredAnalysis {
  username: string;
  summary: PlayerDiagnosisSummary;
  report: TutorPedagogicalReport;
  created_at: string;
}

type StoredPuzzle = BlunderBankItem & { username: string };

interface DemoDB extends DBSchema {
  analyses: { key: string; value: StoredAnalysis };
  puzzles: { key: string; value: StoredPuzzle; indexes: { by_user: string } };
  progress: { key: string; value: PuzzleProgress; indexes: { by_user: string } };
  evals: { key: string; value: { key: string; ev: PositionEvaluation; used_at: number }; indexes: { by_used: number } };
}

let dbPromise: Promise<IDBPDatabase<DemoDB>> | null = null;
function db() {
  dbPromise ??= openDB<DemoDB>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore("analyses", { keyPath: "username" });
      d.createObjectStore("puzzles", { keyPath: "id" }).createIndex("by_user", "username");
      d.createObjectStore("progress", { keyPath: "key" }).createIndex("by_user", "username");
      d.createObjectStore("evals", { keyPath: "key" }).createIndex("by_used", "used_at");
    },
  });
  return dbPromise;
}

const norm = (u: string) => u.trim().toLowerCase();

/** Caché de evaluaciones en IndexedDB con poda de las menos usadas. */
const evalCache: EvalCache = {
  async getMany(keys) {
    const d = await db();
    const tx = d.transaction("evals", "readwrite");
    const out = new Map<string, PositionEvaluation>();
    const now = Date.now();
    await Promise.all(
      keys.map(async (k) => {
        const row = await tx.store.get(k);
        if (row) {
          out.set(k, row.ev);
          await tx.store.put({ ...row, used_at: now });
        }
      })
    );
    await tx.done;
    return out;
  },
  async setMany(entries) {
    const d = await db();
    const tx = d.transaction("evals", "readwrite");
    const now = Date.now();
    await Promise.all(entries.map(([key, ev]) => tx.store.put({ key, ev, used_at: now })));
    const excess = (await tx.store.count()) - EVAL_CACHE_MAX;
    if (excess > 0) {
      let cursor = await tx.store.index("by_used").openCursor();
      for (let i = 0; cursor && i < excess; i++) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    await tx.done;
  },
};

async function loadUser(username: string) {
  const d = await db();
  const u = norm(username);
  const [puzzles, progressRows] = await Promise.all([
    d.getAllFromIndex("puzzles", "by_user", u),
    d.getAllFromIndex("progress", "by_user", u),
  ]);
  const progress = new Map(progressRows.map((p) => [p.puzzle_id, p]));
  return { puzzles: puzzles.map(({ username: _u, ...p }) => (void _u, p as BlunderBankItem)), progress };
}

export const localStore: DataStore = {
  mode: "demo",

  async analyze({ username, timeClass, limit, onProgress, signal }) {
    const result = await runAnalysis({ username, timeClass, limit, engine: getBrowserEngine(), cache: evalCache, onProgress, signal });
    const d = await db();
    const u = norm(username);
    const tx = d.transaction(["analyses", "puzzles", "progress"], "readwrite");
    await tx.objectStore("analyses").put({ username: u, summary: result.summary, report: result.report, created_at: new Date().toISOString() });

    // Upsert de ejercicios; los de partidas reanalizadas que ya no califican se borran si no tienen progreso.
    const keep = new Set(result.puzzles.map((p) => p.id));
    const gameIds = result.games.map((g) => `bb_${g.id}_m`);
    const existing = await tx.objectStore("puzzles").index("by_user").getAll(u);
    for (const old of existing) {
      if (keep.has(old.id) || !gameIds.some((prefix) => old.id.startsWith(prefix))) continue;
      if (!(await tx.objectStore("progress").get(progressKey(u, old.id)))) await tx.objectStore("puzzles").delete(old.id);
    }
    await Promise.all(result.puzzles.map((p) => tx.objectStore("puzzles").put({ ...p, username: u })));
    await tx.done;
  },

  async getSummary(username) {
    const a = await (await db()).get("analyses", norm(username));
    if (!a) throw new Error("No hay un análisis guardado para este usuario en este navegador.");
    return a.summary;
  },

  async getReport(username) {
    const a = await (await db()).get("analyses", norm(username));
    if (!a) throw new Error("No hay un análisis guardado para este usuario en este navegador.");
    return a.report;
  },

  async getProfile(username) {
    try {
      return await getProfile(username);
    } catch {
      return null;
    }
  },

  async getPuzzles(username, filter) {
    const { puzzles, progress } = await loadUser(username);
    const out = selectPuzzles(puzzles, progress, filter);
    if (!out.length && !puzzles.length) throw new Error("No hay ejercicios: analiza primero tus partidas.");
    return out;
  },

  async getTrainerStats(username) {
    const { puzzles, progress } = await loadUser(username);
    return trainerStats(username, puzzles, progress);
  },

  async submitAttempt(req) {
    const d = await db();
    const key = progressKey(req.username, req.puzzle_id);
    const { progress, response } = applyAttempt(await d.get("progress", key), req);
    await d.put("progress", progress);
    return response;
  },

  async evaluateMove(puzzle, playedUci) {
    return evaluateAlternativeMove(puzzle, playedUci, getBrowserEngine());
  },
};

/** Exporta todos los datos de la demo (para que el usuario se los lleve). */
export async function exportLocalData() {
  const d = await db();
  const [analyses, puzzles, progress] = await Promise.all([d.getAll("analyses"), d.getAll("puzzles"), d.getAll("progress")]);
  return { exported_at: new Date().toISOString(), analyses, puzzles, progress };
}

/** Borra todos los datos de la demo de este navegador. */
export async function clearLocalData() {
  (await db()).close();
  dbPromise = null;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
