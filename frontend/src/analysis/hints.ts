/** Port de `generate_hints_for_blunder` (backend/app/modules/heuristics/aggregator.py). */
import type { TutorHints } from "@/types/api";

export function generateHintsForBlunder(theme: string, bestMoveSan: string, bestMoveUci: string | null): TutorHints {
  const target = bestMoveUci ? bestMoveUci.slice(2, 4) : "la casilla clave";
  switch (theme) {
    case "hanging_piece":
      return {
        level_1_conceptual: "¿Hay alguna pieza indefensa en el tablero o tu última jugada dejó algo desprotegido?",
        level_2_directional: `Evalúa la actividad y seguridad alrededor de ${target}.`,
        level_3_concrete: `La mejor jugada es ${bestMoveSan}, asegurando la pieza o castigando la falta de defensa.`,
      };
    case "pin_exploitation":
      return {
        level_1_conceptual: "Observa las piezas alineadas con el rey o la dama rival.",
        level_2_directional: `Hay una clavada táctica que puedes explotar en la zona de ${target}.`,
        level_3_concrete: `Juega ${bestMoveSan}, aprovechando la inmovilidad de la pieza rival clavada.`,
      };
    case "fork_overlooked":
      return {
        level_1_conceptual: "¿Puede una sola pieza atacar dos objetivos simultáneamente?",
        level_2_directional: `Busca una bifurcación táctica colocando tu pieza en ${target}.`,
        level_3_concrete: `Ejecuta ${bestMoveSan}, logrando un ataque doble decisivo.`,
      };
    case "missed_mate":
      return {
        level_1_conceptual: "El rey rival está en una red de mate. ¡Calcula jugadas forzadas!",
        level_2_directional: `Da un jaque implacable llevando tu pieza a ${target}.`,
        level_3_concrete: `La jugada ganadora es ${bestMoveSan}, conduciendo al mate inevitable.`,
      };
    case "king_safety_collapse":
      return {
        level_1_conceptual: "Evalúa la seguridad del rey: diagonales y columnas abiertas.",
        level_2_directional: `Fíjate en las debilidades del enroque y la casilla ${target}.`,
        level_3_concrete: `Juega ${bestMoveSan} para neutralizar las amenazas sobre el monarca.`,
      };
    default:
      return {
        level_1_conceptual: "¿Cuál es la debilidad más evidente en la posición rival?",
        level_2_directional: `Busca la jugada más activa hacia ${target}.`,
        level_3_concrete: `La continuación recomendada por el motor es ${bestMoveSan}.`,
      };
  }
}
