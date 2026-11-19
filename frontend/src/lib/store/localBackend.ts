"use client";

/**
 * Almacenamiento de la demo. IndexedDB si el navegador lo permite; si no (modo privado de algunos
 * navegadores, almacenamiento bloqueado), memoria de la pestaña: la demo funciona igual, pero no guarda.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { BlunderBankItem, PlayerDiagnosisSummary, TutorPedagogicalReport } from "@/types/api";
import type { PositionEvaluation } from "@/analysis/types";
import type { PuzzleProgress } from "./trainerLogic";

export const DB_NAME = "chesstutor-demo";
const DB_VERSION = 1;
const OPEN_TIMEOUT_MS = 3000;
/** Tope de la caché de evaluaciones (~250 B cada una -> ~5 MB). */
export const EVAL_CACHE_MAX = 20_000;

export interface StoredAnalysis {
  username: string;
  /** Versión del análisis que lo generó (ver ANALYSIS_VERSION). Ausente en datos antiguos. */
  analysis_version?: number;
  summary: PlayerDiagnosisSummary;
  report: TutorPedagogicalReport;
  /** Ejercicios de este análisis, en el orden de las partidas (más reciente primero). Ausente en datos antiguos. */
  puzzle_ids?: string[];
  created_at: string;
}

export type StoredPuzzle = BlunderBankItem & { username: string };

export interface LocalBackend {
  readonly persistent: boolean;
  getAnalysis(username: string): Promise<StoredAnalysis | undefined>;
  putAnalysis(a: StoredAnalysis): Promise<void>;
  puzzlesByUser(username: string): Promise<StoredPuzzle[]>;
  /** Escribe `puts` y borra `deleteIds` en una sola operación. */
  writePuzzles(puts: StoredPuzzle[], deleteIds: string[]): Promise<void>;
  progressByUser(username: string): Promise<PuzzleProgress[]>;
  getProgress(key: string): Promise<PuzzleProgress | undefined>;
  putProgress(p: PuzzleProgress): Promise<void>;
  evalGetMany(keys: string[]): Promise<Map<string, PositionEvaluation>>;
  evalSetMany(entries: [string, PositionEvaluation][]): Promise<void>;
  /** Vacía la caché de evaluaciones (p. ej. si el disco se llena). */
  evalClear(): Promise<void>;
  exportAll(): Promise<{ analyses: StoredAnalysis[]; puzzles: StoredPuzzle[]; progress: PuzzleProgress[] }>;
  clear(): Promise<void>;
}

/* ------------------------------------------------------------------ memoria */

export function memoryBackend(): LocalBackend {
  const analyses = new Map<string, StoredAnalysis>();
  const puzzles = new Map<string, StoredPuzzle>();
  const progress = new Map<string, PuzzleProgress>();
  const evals = new Map<string, PositionEvaluation>();
  return {
    persistent: false,
    getAnalysis: async (u) => analyses.get(u),
    putAnalysis: async (a) => void analyses.set(a.username, a),
    puzzlesByUser: async (u) => [...puzzles.values()].filter((p) => p.username === u),
    writePuzzles: async (puts, deleteIds) => {
      deleteIds.forEach((id) => puzzles.delete(id));
      puts.forEach((p) => puzzles.set(p.id, p));
    },
    progressByUser: async (u) => [...progress.values()].filter((p) => p.username === u),
    getProgress: async (k) => progress.get(k),
    putProgress: async (p) => void progress.set(p.key, p),
    evalGetMany: async (keys) => new Map(keys.flatMap((k) => (evals.has(k) ? [[k, evals.get(k)!] as const] : []))),
    evalSetMany: async (entries) => {
      entries.forEach(([k, v]) => evals.set(k, v));
      // Map conserva el orden de inserción: se descartan las más antiguas
      for (const k of evals.keys()) {
        if (evals.size <= EVAL_CACHE_MAX) break;
        evals.delete(k);
      }
    },
    evalClear: async () => evals.clear(),
    exportAll: async () => ({ analyses: [...analyses.values()], puzzles: [...puzzles.values()], progress: [...progress.values()] }),
    clear: async () => {
      analyses.clear();
      puzzles.clear();
      progress.clear();
      evals.clear();
    },
  };
}

/* --------------------------------------------------------------- IndexedDB */

interface DemoDB extends DBSchema {
  analyses: { key: string; value: StoredAnalysis };
  puzzles: { key: string; value: StoredPuzzle; indexes: { by_user: string } };
  progress: { key: string; value: PuzzleProgress; indexes: { by_user: string } };
  evals: { key: string; value: { key: string; ev: PositionEvaluation; used_at: number }; indexes: { by_used: number } };
}

function idbBackend(db: IDBPDatabase<DemoDB>): LocalBackend {
  return {
    persistent: true,
    getAnalysis: (u) => db.get("analyses", u),
    putAnalysis: async (a) => void (await db.put("analyses", a)),
    puzzlesByUser: (u) => db.getAllFromIndex("puzzles", "by_user", u),
    writePuzzles: async (puts, deleteIds) => {
      const tx = db.transaction("puzzles", "readwrite");
      await Promise.all([...deleteIds.map((id) => tx.store.delete(id)), ...puts.map((p) => tx.store.put(p))]);
      await tx.done;
    },
    progressByUser: (u) => db.getAllFromIndex("progress", "by_user", u),
    getProgress: (k) => db.get("progress", k),
    putProgress: async (p) => void (await db.put("progress", p)),
    async evalGetMany(keys) {
      const tx = db.transaction("evals", "readwrite");
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
    async evalSetMany(entries) {
      const tx = db.transaction("evals", "readwrite");
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
    evalClear: async () => {
      await db.clear("evals");
    },
    exportAll: async () => {
      const [analyses, puzzles, progress] = await Promise.all([db.getAll("analyses"), db.getAll("puzzles"), db.getAll("progress")]);
      return { analyses, puzzles, progress };
    },
    clear: async () => {
      db.close();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => resolve();
      });
    },
  };
}

async function openIdb(): Promise<IDBPDatabase<DemoDB>> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB no disponible");
  const open = openDB<DemoDB>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      d.createObjectStore("analyses", { keyPath: "username" });
      d.createObjectStore("puzzles", { keyPath: "id" }).createIndex("by_user", "username");
      d.createObjectStore("progress", { keyPath: "key" }).createIndex("by_user", "username");
      d.createObjectStore("evals", { keyPath: "key" }).createIndex("by_used", "used_at");
    },
  });
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("IndexedDB no responde")), OPEN_TIMEOUT_MS));
  return Promise.race([open, timeout]);
}

let backendPromise: Promise<LocalBackend> | null = null;

/** Backend de la pestaña: IndexedDB o, si falla, memoria. Se decide una vez. */
export function getLocalBackend(): Promise<LocalBackend> {
  backendPromise ??= openIdb()
    .then(idbBackend)
    .catch((err) => {
      console.warn("Almacenamiento local no disponible, se usará memoria:", err);
      return memoryBackend();
    });
  return backendPromise;
}

/** Tras borrar los datos se vuelve a abrir una base nueva. */
export function resetLocalBackend() {
  backendPromise = null;
}
