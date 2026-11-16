/** Traducción de la salida UCI de Stockfish a `PositionEvaluation` (mismo formato que stockfish_pool.py). */
import { Chess } from "chess.js";
import type { PositionEvaluation } from "../types";
import { uciLineToSan } from "../notation";

export interface UciInfo {
  depth: number;
  scoreType: "cp" | "mate";
  score: number;
  pv: string[];
}

/** Lee una línea `info ... score ... pv ...` de la variante principal (multipv 1). */
export function parseInfoLine(line: string): UciInfo | null {
  if (!line.startsWith("info ") || !line.includes(" score ") || !line.includes(" pv ")) return null;
  const t = line.split(/\s+/);
  const at = (key: string) => t.indexOf(key);
  const multipv = at("multipv");
  if (multipv >= 0 && t[multipv + 1] !== "1") return null;
  const s = at("score");
  const scoreType = t[s + 1] as "cp" | "mate";
  if (scoreType !== "cp" && scoreType !== "mate") return null;
  return {
    depth: Number(t[at("depth") + 1] ?? 0),
    scoreType,
    score: Number(t[s + 2]),
    pv: t.slice(at("pv") + 1),
  };
}

/** Posiciones terminales sin motor (mate = ±10000 para el ganador, tablas = 0). Ver terminal_evaluation en Python. */
export function terminalEvaluation(fen: string): PositionEvaluation | null {
  const board = new Chess(fen);
  const base = { fen, depth: 99, best_move_uci: null, best_move_san: null, pv_uci: [], pv_san: [] };
  if (board.isCheckmate()) return { ...base, score_cp: board.turn() === "w" ? -10000 : 10000, mate_in: 0 };
  if (board.isStalemate() || board.isInsufficientMaterial()) return { ...base, score_cp: 0, mate_in: null };
  return null;
}

/** Convierte la última info (perspectiva del bando que mueve) a evaluación desde las blancas. */
export function toEvaluation(fen: string, depth: number, info: UciInfo | null): PositionEvaluation {
  const sign = fen.split(" ")[1] === "b" ? -1 : 1;
  let scoreCp: number | null = null;
  let mateIn: number | null = null;
  if (info?.scoreType === "cp") scoreCp = sign * info.score;
  if (info?.scoreType === "mate") {
    mateIn = sign * info.score;
    scoreCp = mateIn > 0 ? 10000 - Math.abs(mateIn) * 100 : -10000 + Math.abs(mateIn) * 100;
  }
  const pvUci = (info?.pv ?? []).slice(0, 5);
  const [bestSan, pvSan] = uciLineToSan(fen, pvUci);
  return {
    fen,
    depth,
    score_cp: scoreCp,
    mate_in: mateIn,
    best_move_uci: pvUci[0] ?? null,
    best_move_san: bestSan,
    pv_uci: pvUci,
    pv_san: pvSan,
  };
}
