"use client";

/**
 * Demo de coste 0: el análisis corre en el navegador (Stockfish WASM) y los datos se guardan
 * solo en este navegador (IndexedDB, o memoria si no está disponible). Ningún dato del usuario
 * sale de su equipo, salvo las peticiones de partidas públicas a api.chess.com.
 */
import type { BlunderBankItem } from "@/types/api";
import type { EvalCache } from "@/analysis/evaluator";
import { runAnalysis } from "@/analysis/pipeline";
import { getProfile } from "@/analysis/chesscom";
import { getBrowserEngine } from "@/analysis/engine/browser";
import { adaptiveDepth } from "@/analysis/device";
import { ANALYSIS_VERSION } from "@/analysis/version";
import { applyAttempt, evaluateAlternativeMove, selectPuzzles, trainerStats, progressKey } from "./trainerLogic";
import { getLocalBackend, resetLocalBackend, type LocalBackend } from "./localBackend";
import type { DataStore } from "./types";

const norm = (u: string) => u.trim().toLowerCase();

const evalCache: EvalCache = {
  getMany: async (keys) => (await getLocalBackend()).evalGetMany(keys),
  setMany: async (entries) => (await getLocalBackend()).evalSetMany(entries),
};

async function loadUser(b: LocalBackend, username: string) {
  const u = norm(username);
  const [puzzles, progressRows] = await Promise.all([b.puzzlesByUser(u), b.progressByUser(u)]);
  return {
    puzzles: puzzles.map(({ username: _u, ...p }) => (void _u, p as BlunderBankItem)),
    progress: new Map(progressRows.map((p) => [p.puzzle_id, p])),
  };
}

async function currentAnalysis(username: string) {
  const a = await (await getLocalBackend()).getAnalysis(norm(username));
  if (!a) throw new Error("No hay un análisis guardado para este usuario en este navegador.");
  if (a.analysis_version !== ANALYSIS_VERSION) {
    throw new Error("Mejoramos el análisis desde tu última visita: vuelve a analizar tus partidas (tu progreso en los ejercicios se conserva).");
  }
  return a;
}

export const localStore: DataStore = {
  mode: "demo",

  async analyze({ username, timeClass, limit, onProgress, signal }) {
    const result = await runAnalysis({
      username,
      timeClass,
      limit,
      engine: getBrowserEngine(),
      cache: evalCache,
      depth: adaptiveDepth(),
      onProgress,
      signal,
    });
    const b = await getLocalBackend();
    const u = norm(username);
    await b.putAnalysis({
      username: u,
      analysis_version: ANALYSIS_VERSION,
      summary: result.summary,
      report: result.report,
      puzzle_ids: result.puzzles.map((p) => p.id),
      created_at: new Date().toISOString(),
    });

    // Upsert de ejercicios; los de partidas reanalizadas que ya no califican se borran si no tienen progreso.
    const keep = new Set(result.puzzles.map((p) => p.id));
    const prefixes = result.games.map((g) => `bb_${g.id}_m`);
    const stale: string[] = [];
    for (const old of await b.puzzlesByUser(u)) {
      if (keep.has(old.id) || !prefixes.some((pre) => old.id.startsWith(pre))) continue;
      if (!(await b.getProgress(progressKey(u, old.id)))) stale.push(old.id);
    }
    await b.writePuzzles(result.puzzles.map((p) => ({ ...p, username: u })), stale);
  },

  getSummary: async (username) => (await currentAnalysis(username)).summary,
  getReport: async (username) => (await currentAnalysis(username)).report,

  async getProfile(username) {
    try {
      return await getProfile(username);
    } catch {
      return null;
    }
  },

  async getPuzzles(username, filter) {
    const b = await getLocalBackend();
    const { puzzles, progress } = await loadUser(b, username);
    if (!puzzles.length) throw new Error("No hay ejercicios: analiza primero tus partidas.");
    const latestIds = filter?.scope === "all" ? undefined : (await b.getAnalysis(norm(username)))?.puzzle_ids;
    return selectPuzzles(puzzles, progress, filter, new Date(), latestIds);
  },

  async getTrainerStats(username) {
    const { puzzles, progress } = await loadUser(await getLocalBackend(), username);
    return trainerStats(username, puzzles, progress);
  },

  async submitAttempt(req) {
    const b = await getLocalBackend();
    const { progress, response } = applyAttempt(await b.getProgress(progressKey(req.username, req.puzzle_id)), req);
    await b.putProgress(progress);
    return response;
  },

  evaluateMove: (puzzle, playedUci) => evaluateAlternativeMove(puzzle, playedUci, getBrowserEngine()),
};

/** ¿Se guardan los datos entre visitas? (false si el navegador no permite IndexedDB). */
export async function isStoragePersistent() {
  return (await getLocalBackend()).persistent;
}

/** Exporta todos los datos de la demo (para que el usuario se los lleve). */
export async function exportLocalData() {
  return { exported_at: new Date().toISOString(), ...(await (await getLocalBackend()).exportAll()) };
}

/** Borra todos los datos de la demo de este navegador. */
export async function clearLocalData() {
  await (await getLocalBackend()).clear();
  resetLocalBackend();
}
