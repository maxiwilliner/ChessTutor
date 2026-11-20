"use client";

/**
 * Demo de coste 0: el análisis corre en el navegador (Stockfish WASM) y los datos se guardan
 * solo en este navegador (IndexedDB, o memoria si no está disponible). Ningún dato del usuario
 * sale de su equipo, salvo las peticiones de partidas públicas a api.chess.com.
 */
import type { BlunderBankItem, PlayerDiagnosisSummary, TutorPedagogicalReport } from "@/types/api";
import type { EvalCache } from "@/analysis/evaluator";
import { getProfile } from "@/analysis/chesscom";
import { getBrowserEngine } from "@/analysis/engine/browser";
import { adaptiveDepth, isLowPowerDevice } from "@/analysis/device";
import { ANALYSIS_VERSION } from "@/analysis/version";
import { CodedError } from "@/lib/errors";
import { applyAttempt, evaluateAlternativeMove, selectPuzzles, trainerStats, progressKey } from "./trainerLogic";
import { getLocalBackend, resetLocalBackend, type LocalBackend } from "./localBackend";
import type { AnalyzeParams, DataStore } from "./types";

const norm = (u: string) => u.trim().toLowerCase();

export const isQuotaError = (e: unknown) => {
  const name = (e as { name?: string } | null)?.name ?? "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
};

/**
 * La caché de evaluaciones es opcional: si IndexedDB falla (o se llena) el análisis sigue sin ella.
 * Con el disco lleno se vacía la caché para dejar sitio a lo importante (análisis y progreso).
 */
export function safeEvalCache(backend: () => Promise<LocalBackend>): EvalCache {
  return {
    async getMany(keys) {
      try {
        return await (await backend()).evalGetMany(keys);
      } catch {
        return new Map();
      }
    },
    async setMany(entries) {
      try {
        await (await backend()).evalSetMany(entries);
      } catch (e) {
        if (isQuotaError(e)) await (await backend()).evalClear().catch(() => undefined);
      }
    },
  };
}

const evalCache = safeEvalCache(getLocalBackend);

const LOCK_NAME = "chesstutor-analysis";

/** Evita dos análisis a la vez en pestañas distintas (duplicarían los motores y la CPU). */
async function withAnalysisLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return fn();
  return locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
    if (!lock) {
      throw new CodedError(
        "analysis_locked",
        "Ya hay un análisis en marcha en otra pestaña. Espera a que termine o ciérrala y vuelve a intentarlo.",
        {},
        "AnalysisLocked"
      );
    }
    return fn();
  });
}

/** Pide que el navegador no borre los datos por falta de uso (Safari los borra a los 7 días). En Firefox abriría un permiso: no se pide. */
async function requestPersistence() {
  try {
    const storage = navigator.storage;
    if (!storage?.persist || /firefox/i.test(navigator.userAgent) || (await storage.persisted())) return;
    await storage.persist();
  } catch {
    // opcional
  }
}

interface AnalysisToSave {
  summary: PlayerDiagnosisSummary;
  report: TutorPedagogicalReport;
  puzzles: BlunderBankItem[];
  gameIds: string[];
  createdAt?: string;
}

/** Guarda un análisis y hace upsert de sus ejercicios (los de partidas reanalizadas que ya no califican se borran si no tienen progreso). */
async function saveAnalysis(username: string, a: AnalysisToSave) {
  const b = await getLocalBackend();
  const u = norm(username);
  try {
    await b.putAnalysis({
      username: u,
      analysis_version: ANALYSIS_VERSION,
      summary: a.summary,
      report: a.report,
      puzzle_ids: a.puzzles.map((p) => p.id),
      created_at: a.createdAt ?? new Date().toISOString(),
    });
    const keep = new Set(a.puzzles.map((p) => p.id));
    const prefixes = a.gameIds.map((id) => `bb_${id}_m`);
    const stale: string[] = [];
    for (const old of await b.puzzlesByUser(u)) {
      if (keep.has(old.id) || !prefixes.some((pre) => old.id.startsWith(pre))) continue;
      if (!(await b.getProgress(progressKey(u, old.id)))) stale.push(old.id);
    }
    await b.writePuzzles(a.puzzles.map((p) => ({ ...p, username: u })), stale);
  } catch (e) {
    if (isQuotaError(e)) {
      throw new CodedError(
        "storage_full",
        "Tu navegador no tiene espacio para guardar el análisis. Libera espacio o borra los datos de la demo (al pie de la página)."
      );
    }
    throw e;
  }
  void requestPersistence();
}

/** Ejemplo pre-analizado (`public/example/<usuario>-<ritmo>.json`, generado con `npm run example:build`). */
export interface ExampleFile {
  analysis_version: number;
  created_at: string;
  username: string;
  time_class: string;
  summary: PlayerDiagnosisSummary;
  report: TutorPedagogicalReport;
  puzzles: BlunderBankItem[];
}

export const examplePath = (username: string, timeClass: string) => `/example/${norm(username)}-${timeClass}.json`;

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
  if (!a) throw new CodedError("no_analysis", "No hay un análisis guardado para este usuario en este navegador.");
  if (a.analysis_version !== ANALYSIS_VERSION) {
    throw new CodedError(
      "analysis_outdated",
      "Mejoramos el análisis desde tu última visita: vuelve a analizar tus partidas (tu progreso en los ejercicios se conserva)."
    );
  }
  return a;
}

async function runAndSave({ username, timeClass, limit, onProgress, signal }: AnalyzeParams) {
  // Import diferido: el pipeline (heurísticas, agregador, tutor) solo se descarga al analizar
  const { runAnalysis } = await import("@/analysis/pipeline");
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
  await saveAnalysis(username, {
    summary: { ...result.summary, engine_profile: isLowPowerDevice() ? "low_power" : "standard" },
    report: result.report,
    puzzles: result.puzzles,
    gameIds: result.games.map((g) => g.id),
  });
}

export const localStore: DataStore = {
  mode: "demo",

  analyze: (params: AnalyzeParams) => withAnalysisLock(() => runAndSave(params)),

  async loadExample(username, timeClass) {
    try {
      const res = await fetch(examplePath(username, timeClass));
      if (!res.ok) return false;
      const ex = (await res.json()) as ExampleFile;
      if (ex.analysis_version !== ANALYSIS_VERSION) return false;
      await saveAnalysis(ex.username, {
        summary: ex.summary,
        report: ex.report,
        puzzles: ex.puzzles,
        gameIds: (ex.summary.games ?? []).map((g) => g.id),
        createdAt: ex.created_at,
      });
      return true;
    } catch {
      return false;
    }
  },

  getSummary: async (username) => (await currentAnalysis(username)).summary,
  // El informe por reglas se redacta al mostrarlo, en el idioma de la interfaz (en español es igual al guardado)
  async getReport(username, lang = "es") {
    const [{ summary }, { generateDeterministicTutorReport }] = await Promise.all([currentAnalysis(username), import("@/analysis/tutor")]);
    return generateDeterministicTutorReport(summary, lang);
  },

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
    if (!puzzles.length) throw new CodedError("no_puzzles", "No hay ejercicios: analiza primero tus partidas.");
    const latestIds = filter?.scope === "all" ? undefined : (await b.getAnalysis(norm(username)))?.puzzle_ids;
    return selectPuzzles(puzzles, progress, filter, new Date(), latestIds);
  },

  async getTrainerStats(username, scope = "all") {
    const b = await getLocalBackend();
    const { puzzles, progress } = await loadUser(b, username);
    const latestIds = scope === "latest" ? (await b.getAnalysis(norm(username)))?.puzzle_ids : undefined;
    return trainerStats(username, puzzles, progress, new Date(), latestIds);
  },

  async submitAttempt(req) {
    const b = await getLocalBackend();
    const { progress, response } = applyAttempt(await b.getProgress(progressKey(req.username, req.puzzle_id)), req);
    await b.putProgress(progress);
    return response;
  },

  // Dos posiciones por jugada (la jugada y la mejor): con 2 motores basta
  evaluateMove: (puzzle, playedUci) => evaluateAlternativeMove(puzzle, playedUci, getBrowserEngine(2)),
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
