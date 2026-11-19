/**
 * Tipos del motor de análisis en el navegador.
 * Espejo de los modelos Pydantic de `backend/app/models/{chesscom,engine}.py` (mismos nombres de campo,
 * para que los fixtures exportados desde Python se comparen campo a campo).
 */

export type Color = "white" | "black";
export type Classification = "best" | "good" | "inaccuracy" | "error" | "blunder";
export type Phase = "opening" | "middlegame" | "endgame";
export type Termination =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "abandoned"
  | "agreement"
  | "repetition"
  | "stalemate"
  | "insufficient"
  | "timeout_vs_insufficient"
  | "fifty_moves"
  | "other";
export type PsychTag = "impulsive" | "time_trouble" | "normal";

export interface MoveWithClock {
  ply: number;
  move_number: number;
  turn: Color;
  san: string;
  uci: string;
  fen_before: string;
  fen_after: string;
  clock_remaining_seconds: number;
  time_spent_seconds: number;
}

export interface NormalizedGame {
  id: string;
  url: string;
  white_username: string;
  white_rating: number;
  white_result: string;
  black_username: string;
  black_rating: number;
  black_result: string;
  user_color: Color;
  user_result: "win" | "loss" | "draw";
  time_control: string;
  time_class: string;
  eco: string;
  opening_name: string;
  end_time: number;
  moves_count: number;
  moves: MoveWithClock[];
  /** Cómo terminó (cabecera PGN Termination): checkmate, resignation, timeout... */
  termination: Termination;
}

/** Evaluación de una posición. score_cp desde el punto de vista de las blancas; mate = ±(10000 − 100·n). */
export interface PositionEvaluation {
  fen: string;
  depth: number;
  score_cp: number | null;
  mate_in: number | null;
  best_move_uci: string | null;
  best_move_san: string | null;
  pv_uci: string[];
  pv_san: string[];
}

export interface EvaluatedMove {
  ply: number;
  move_number: number;
  turn: Color;
  user_move_uci: string;
  user_move_san: string;
  fen_before: string;
  fen_after: string;
  time_spent_seconds: number;
  clock_remaining_seconds: number;
  /** Desde la perspectiva del jugador que mueve. */
  eval_before_cp: number;
  eval_after_cp: number;
  cpl: number;
  classification: Classification;
  best_move_uci: string | null;
  best_move_san: string | null;
  pv_uci: string[];
  pv_san: string[];
  refutation_uci: string[];
  refutation_san: string[];
  phase: Phase;
  tactical_theme: string | null;
  psychological_tag: PsychTag | null;
}
