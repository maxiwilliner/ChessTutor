/** Fotogramas para reproducir una variante en el tablero (solución, línea del motor o refutación). */
import { Chess } from "chess.js";
import { uciToMove } from "@/analysis/notation";

export type LineSide = "user" | "opp";

export interface LineStep {
  uci: string;
  by: LineSide;
  /** La jugada del usuario en la partida (se marca en rojo). */
  isBlunder?: boolean;
}

export interface LineFrame {
  fen: string;
  /** Jugada que llevó a esta posición (null en el fotograma inicial). */
  uci: string | null;
  san: string | null;
  by: LineSide | null;
  isBlunder: boolean;
  capture: boolean;
  check: boolean;
}

/** Fotograma 0 = posición inicial; uno más por jugada legal. Se detiene en la primera ilegal. */
export function buildLine(startFen: string, steps: LineStep[]): LineFrame[] {
  const board = new Chess(startFen);
  const frames: LineFrame[] = [
    { fen: startFen, uci: null, san: null, by: null, isBlunder: false, capture: false, check: false },
  ];
  for (const step of steps) {
    try {
      const mv = board.move(uciToMove(step.uci.toLowerCase()));
      frames.push({
        fen: board.fen(),
        uci: step.uci.toLowerCase(),
        san: mv.san,
        by: step.by,
        isBlunder: !!step.isBlunder,
        capture: mv.isCapture() || mv.isEnPassant(),
        check: board.inCheck(),
      });
    } catch {
      break;
    }
  }
  return frames;
}

/** Variante que alterna bandos empezando por `first`. */
export const alternating = (ucis: string[], first: LineSide): LineStep[] =>
  ucis.map((uci, i) => ({ uci, by: (i % 2 === 0) === (first === "user") ? "user" : "opp" }));
