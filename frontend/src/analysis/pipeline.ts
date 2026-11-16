/**
 * Análisis completo en el navegador: Chess.com -> Stockfish WASM -> heurísticas -> resumen, ejercicios e informe.
 * Emite los mismos eventos de progreso que el stream SSE del backend (`/analysis/stream`).
 */
import type { BlunderBankItem, PlayerDiagnosisSummary, TutorPedagogicalReport } from "@/types/api";
import type { Engine } from "./engine/pool";
import type { EvaluatedMove, NormalizedGame } from "./types";
import { getRecentGames } from "./chesscom";
import { evaluateGameSmart, DEFAULT_DEPTH, type AnalysisDepth, type EvalCache } from "./evaluator";
import { assembleDiagnosisAndPuzzles } from "./aggregator";
import { generateDeterministicTutorReport } from "./tutor";

export interface ProgressEvent {
  stage: "fetching_games" | "evaluating_start" | "evaluating" | "classifying" | "complete" | "error";
  message: string;
  progress_pct: number;
  current_game?: number;
  total_games?: number;
}

export interface AnalysisResult {
  games: NormalizedGame[];
  summary: PlayerDiagnosisSummary;
  puzzles: BlunderBankItem[];
  report: TutorPedagogicalReport;
}

export class AnalysisError extends Error {}

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
  const games = await getRecentGames(username, timeClass, limit, signal);
  if (!games.length) throw new AnalysisError(`No se encontraron partidas ${timeClass} para ${username} en Chess.com.`);

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
    });
    evaluated.push(await evaluateGameSmart(g, engine, depth, cache));
  }

  checkAbort();
  emit({ stage: "classifying", message: "Clasificando errores tácticos, aperturas y psicología del reloj...", progress_pct: 92 });
  const { summary, puzzles } = assembleDiagnosisAndPuzzles(username, timeClass, games, evaluated);
  const report = generateDeterministicTutorReport(summary);
  emit({ stage: "complete", message: "Análisis finalizado con éxito.", progress_pct: 100 });
  return { games, summary, puzzles, report };
}
