import type {
  BlunderBankItem,
  EvaluateMoveResponse,
  PlayerDiagnosisSummary,
  PlayerProfile,
  PuzzleAttemptRequest,
  PuzzleAttemptResponse,
  TrainerStatsResponse,
  TutorPedagogicalReport,
} from "@/types/api";
import type { GetPuzzlesFilter } from "@/lib/api";
import type { ProgressEvent } from "@/analysis/pipeline";

export type AppMode = "demo" | "full";

export interface AnalyzeParams {
  username: string;
  timeClass: string;
  limit: number;
  onProgress: (e: ProgressEvent) => void;
  signal?: AbortSignal;
}

/**
 * Acceso a datos de la app. Dos implementaciones con la misma interfaz:
 * - `remote` (versión completa): API del backend.
 * - `local` (demo de coste 0): análisis en el navegador y datos en IndexedDB.
 */
export interface DataStore {
  readonly mode: AppMode;
  /** Lanza el análisis; resuelve al terminar o rechaza con un mensaje en español. */
  analyze(params: AnalyzeParams): Promise<void>;
  getSummary(username: string): Promise<PlayerDiagnosisSummary>;
  getReport(username: string): Promise<TutorPedagogicalReport>;
  getProfile(username: string): Promise<PlayerProfile | null>;
  getPuzzles(username: string, filter?: GetPuzzlesFilter): Promise<BlunderBankItem[]>;
  getTrainerStats(username: string): Promise<TrainerStatsResponse>;
  submitAttempt(req: PuzzleAttemptRequest): Promise<PuzzleAttemptResponse | null>;
  evaluateMove(puzzle: BlunderBankItem, playedUci: string, fen: string): Promise<EvaluateMoveResponse>;
}
