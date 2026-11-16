/** Port de `backend/app/modules/heuristics/tactical.py` sobre chess.js. */
import { Chess, type Color as CjsColor, type PieceSymbol, type Square, SQUARES } from "chess.js";
import { uciToMove } from "./notation";

const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const other = (c: CjsColor): CjsColor => (c === "w" ? "b" : "w");

/** Copia el tablero y aplica la jugada; null si es ilegal. */
function after(board: Chess, uci: string): Chess | null {
  const next = new Chess(board.fen());
  try {
    next.move(uciToMove(uci));
    return next;
  } catch {
    return null;
  }
}

/** ¿La pieza de `sq` ataca `target`? (equivale a `target in board.attacks(sq)` de python-chess) */
function attacksSquare(board: Chess, sq: Square, target: Square): boolean {
  const piece = board.get(sq);
  return !!piece && board.attackers(target, piece.color).includes(sq);
}

/** Clavada absoluta (python-chess `is_pinned`): quitar la pieza expone al rey a un nuevo atacante. */
function isPinned(board: Chess, color: CjsColor, sq: Square): boolean {
  const piece = board.get(sq);
  if (!piece || piece.color !== color || piece.type === "k") return false;
  const kingSq = SQUARES.find((s) => {
    const p = board.get(s);
    return p && p.type === "k" && p.color === color;
  });
  if (!kingSq) return false;
  const before = new Set(board.attackers(kingSq, other(color)));
  const probe = new Chess(board.fen(), { skipValidation: true });
  probe.remove(sq);
  return probe.attackers(kingSq, other(color)).some((a) => !before.has(a));
}

export function isPieceHanging(board: Chess, square: Square, color: CjsColor): boolean {
  const piece = board.get(square);
  if (!piece || piece.color !== color) return false;
  const attackers = board.attackers(square, other(color));
  if (!attackers.length) return false;
  const defenders = board.attackers(square, color);
  if (!defenders.length) return true;
  const minAttacker = Math.min(...attackers.map((s) => PIECE_VALUES[board.get(s)!.type] ?? 10));
  if (minAttacker < PIECE_VALUES[piece.type]) return true;
  return attackers.length > defenders.length;
}

export function detectHangingPiece(before: Chess, uci: string): boolean {
  const color = before.turn();
  const next = after(before, uci);
  if (!next) return false;
  const to = uci.slice(2, 4) as Square;
  if (isPieceHanging(next, to, color)) return true;
  for (const sq of SQUARES) {
    const p = next.get(sq);
    if (p && p.color === color && sq !== to && isPieceHanging(next, sq, color) && !isPieceHanging(before, sq, color)) {
      return true;
    }
  }
  return false;
}

export function detectPinExploitation(before: Chess, uci: string): boolean {
  const color = before.turn();
  if (isPinned(before, color, uci.slice(0, 2) as Square)) return true;
  const next = after(before, uci);
  if (!next) return false;
  const enemy = other(color);
  const sliders = SQUARES.filter((s) => {
    const p = next.get(s);
    return p && p.color === enemy && (p.type === "b" || p.type === "r" || p.type === "q");
  });
  const valuable = SQUARES.filter((s) => {
    const p = next.get(s);
    return p && p.color === color && (p.type === "q" || p.type === "r");
  });
  for (const e of sliders) {
    for (const v of valuable) {
      if (attacksSquare(next, e, v) && !attacksSquare(before, e, v)) return true;
    }
  }
  return false;
}

/** La respuesta del rival ataca 2+ piezas valiosas del usuario a la vez. */
export function detectFork(boardAfterUserMove: Chess, replyUci: string | null): boolean {
  if (!replyUci) return false;
  const temp = after(boardAfterUserMove, replyUci);
  if (!temp) return false;
  const forkSq = replyUci.slice(2, 4) as Square;
  const user = temp.turn();
  let targets = 0;
  for (const sq of SQUARES) {
    const p = temp.get(sq);
    if (p && p.color === user && p.type !== "p" && attacksSquare(temp, forkSq, sq)) targets++;
  }
  return targets >= 2;
}

export const detectMissedMate = (evalBefore: number, evalAfter: number) => evalBefore >= 8000 && evalAfter < 2000;

export function detectKingSafety(board: Chess, color: CjsColor, moveNumber: number): boolean {
  const kingSq = SQUARES.find((s) => {
    const p = board.get(s);
    return p && p.type === "k" && p.color === color;
  });
  if (!kingSq || moveNumber <= 15 || !"de".includes(kingSq[0])) return false;
  const pawnsOnFile = (file: string) =>
    SQUARES.filter((s) => s[0] === file && board.get(s)?.type === "p").length;
  return pawnsOnFile("e") === 0 || pawnsOnFile("d") === 0;
}

export function classifyTacticalMotif(
  fenBefore: string,
  uci: string,
  evalBefore: number,
  evalAfter: number,
  opponentPv: string[],
  moveNumber: number
): string {
  const board = new Chess(fenBefore);
  if (detectMissedMate(evalBefore, evalAfter)) return "missed_mate";
  if (detectHangingPiece(board, uci)) return "hanging_piece";
  if (detectPinExploitation(board, uci)) return "pin_exploitation";
  const next = after(board, uci);
  if (next && opponentPv.length && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(opponentPv[0]) && detectFork(next, opponentPv[0])) {
    return "fork_overlooked";
  }
  if (detectKingSafety(board, board.turn(), moveNumber)) return "king_safety_collapse";
  return "tactical_inaccuracy";
}
