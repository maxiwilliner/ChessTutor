/**
 * Análisis completo en el navegador: Chess.com -> Stockfish WASM -> heurísticas -> resumen, ejercicios e informe.
 * Emite los mismos eventos de progreso que el stream SSE del backend (`/analysis/stream`).
 */
import type { BlunderBankItem, PlayerDiagnosisSummary, TutorPedagogicalReport } from "@/types/api";
import type { Engine } from "./engine/pool";
import type { EvaluatedMove, NormalizedGame } from "./types";
import { archiveLabel, getRecentGames } from "./chesscom";
import { CodedError, type ErrorParams } from "@/lib/errors";
import { evaluateGameSmart, DEFAULT_DEPTH, type AnalysisDepth, type EvalCache } from "./evaluator";
import { assembleDiagnosisAndPuzzles } from "./aggregator";
import { generateDeterministicTutorReport } from "./tutor";

export interface ProgressEvent {
  stage: "fetching_games" | "evaluating_start" | "evaluating" | "classifying" | "complete" | "error";
  /** En español (como el SSE del backend); la interfaz compone su propio texto con los campos de abajo. */
  message: string;
  progress_pct: number;
  current_game?: number;
  total_games?: number;
  /** Mes que se está revisando, "2026-10". */
  month?: string;
  /** Blancas y negras de la partida que se evalúa. */
  players?: [string, string];
}

export interface AnalysisResult {
  games: NormalizedGame[];
  summary: PlayerDiagnosisSummary;
  puzzles: BlunderBankItem[];
  report: TutorPedagogicalReport;
}

/** Sin partidas del ritmo pedido: es un error del usuario, no de la app (no va a Sentry). */
export class AnalysisError extends CodedError {
  constructor(message: string, params: ErrorParams) {
    super("no_games", message, params, "AnalysisError");
  }
}

const PACE_ES: Record<string, string> = { rapid: "rápidas", blitz: "de blitz", bullet: "de bullet", daily: "diarias" };

export async function runAnalysis(opts: {
  username: string;
  timeClass: string;
  limit: number;
  engine: Engine;
  cache?: EvalCache;
  depth?: AnalysisDepth;
  onProgress?: (e: ProgressEvent) => void;
  signal?: AbortSignal;
}): Promise<AnalysisResult> {
  const { username, timeClass, limit, engine, cache, depth = DEFAULT_DEPTH, onProgress, signal } = opts;
  const emit = (e: ProgressEvent) => onProgress?.(e);
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException("Análisis cancelado", "AbortError");
  };

  emit({ stage: "fetching_games", message: `Descargando partidas recientes de ${username}...`, progress_pct: 5 });
  const games = await getRecentGames(username, timeClass, limit, signal, (month) =>
    emit({
      stage: "fetching_games",
      message: `Buscando partidas de ${username} en ${archiveLabel(month.replace("-", "/"))}...`,
      progress_pct: 5,
      month,
    })
  );
  if (!games.length) {
    throw new AnalysisError(`${username} no tiene partidas ${PACE_ES[timeClass] ?? timeClass} recientes en Chess.com. Prueba con otro ritmo.`, {
      username,
      timeClass,
    });
  }

  const total = games.length;
  emit({ stage: "evaluating_start", message: `Analizando ${total} partidas con Stockfish...`, progress_pct: 10, total_games: total });

  const evaluated: EvaluatedMove[][] = [];
  for (let i = 0; i < total; i++) {
    checkAbort();
    const g = games[i];
    emit({
      stage: "evaluating",
      message: `Evaluando partida ${i + 1} de ${total} (${g.white_username} vs ${g.black_username})...`,
      progress_pct: 10 + Math.floor(((i + 1) / total) * 75),
      current_game: i + 1,
      total_games: total,
      players: [g.white_username, g.black_username],
    });
    evaluated.push(await evaluateGameSmart(g, engine, depth, cache, signal));
  }

  checkAbort();
  emit({ stage: "classifying", message: "Clasificando errores tácticos, aperturas y psicología del reloj...", progress_pct: 92 });
  const { summary, puzzles } = assembleDiagnosisAndPuzzles(username, timeClass, games, evaluated);
  const report = generateDeterministicTutorReport(summary);
  emit({ stage: "complete", message: "Análisis finalizado con éxito.", progress_pct: 100 });
  return { games, summary, puzzles, report };
}
