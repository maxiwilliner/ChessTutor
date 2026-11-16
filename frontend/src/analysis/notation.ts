/** Port de `backend/app/modules/engine/notation.py`. */
import { Chess } from "chess.js";

export function uciToMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined };
}

/** Convierte una variante UCI a SAN desde `fen`. Devuelve [primera jugada, variante]. Se detiene en la primera ilegal. */
export function uciLineToSan(fen: string, pvUci: string[], maxPlies = 5): [string | null, string[]] {
  let board: Chess;
  try {
    board = new Chess(fen);
  } catch {
    return [null, []];
  }
  const san: string[] = [];
  for (const uci of pvUci.slice(0, maxPlies)) {
    try {
      san.push(board.move(uciToMove(uci)).san);
    } catch {
      break;
    }
  }
  return [san[0] ?? null, san];
}
