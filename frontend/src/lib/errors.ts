/**
 * Errores con código: el mensaje en español queda para registros y Sentry, y la interfaz muestra el texto
 * del diccionario del idioma actual (`errorText` en `@/lib/i18n`).
 */
export type ErrorParams = Record<string, string | number>;

export type ErrorCode =
  | "invalid_username"
  | "user_not_found"
  | "offline"
  | "chesscom_network"
  | "chesscom_rate_limited"
  | "chesscom_server"
  | "no_games"
  | "engine_start"
  | "engine_timeout"
  | "engine_stopped"
  | "analysis_locked"
  | "storage_full"
  | "no_analysis"
  | "analysis_outdated"
  | "no_puzzles"
  | "backend_unreachable"
  | "stats_failed"
  | "attempt_failed"
  | "evaluate_failed"
  | "report_failed";

export class CodedError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly params: ErrorParams = {},
    name?: string
  ) {
    super(message);
    if (name) this.name = name;
  }
}

/** Código y parámetros de cualquier error que los traiga (CodedError, ChessComError, EngineError…). */
export function errorCode(err: unknown): { code?: string; params: ErrorParams } {
  const e = err as { code?: unknown; params?: unknown } | null;
  return {
    code: typeof e?.code === "string" ? e.code : undefined,
    params: e?.params && typeof e.params === "object" ? (e.params as ErrorParams) : {},
  };
}
