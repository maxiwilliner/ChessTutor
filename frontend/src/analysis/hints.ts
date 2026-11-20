/**
 * Port de `generate_hints_for_blunder` (backend/app/modules/heuristics/aggregator.py), con versión en inglés.
 * En español coincide con Python; la interfaz genera las pistas al mostrarlas, en su idioma.
 */
import type { TutorHints } from "@/types/api";
import type { Lang } from "@/lib/i18n/paths";

type HintSet = (target: string, san: string) => TutorHints;

const hints =
  (l1: string, l2: (target: string) => string, l3: (san: string) => string): HintSet =>
  (target, san) => ({
    level_1_conceptual: l1,
    level_2_directional: l2(target),
    level_3_concrete: l3(san),
  });

interface HintTexts {
  keySquare: string;
  themes: Record<string, HintSet>;
  fallback: HintSet;
}

const ES: HintTexts = {
  keySquare: "la casilla clave",
  themes: {
    hanging_piece: hints(
      "¿Hay alguna pieza indefensa en el tablero o tu última jugada dejó algo desprotegido?",
      (t) => `Evalúa la actividad y seguridad alrededor de ${t}.`,
      (san) => `La mejor jugada es ${san}, asegurando la pieza o castigando la falta de defensa.`
    ),
    pin_exploitation: hints(
      "Observa las piezas alineadas con el rey o la dama rival.",
      (t) => `Hay una clavada táctica que puedes explotar en la zona de ${t}.`,
      (san) => `Juega ${san}, aprovechando la inmovilidad de la pieza rival clavada.`
    ),
    fork_overlooked: hints(
      "¿Puede una sola pieza atacar dos objetivos simultáneamente?",
      (t) => `Busca una bifurcación táctica colocando tu pieza en ${t}.`,
      (san) => `Ejecuta ${san}, logrando un ataque doble decisivo.`
    ),
    missed_mate: hints(
      "El rey rival está en una red de mate. ¡Calcula jugadas forzadas!",
      (t) => `Da un jaque implacable llevando tu pieza a ${t}.`,
      (san) => `La jugada ganadora es ${san}, conduciendo al mate inevitable.`
    ),
    king_safety_collapse: hints(
      "Evalúa la seguridad del rey: diagonales y columnas abiertas.",
      (t) => `Fíjate en las debilidades del enroque y la casilla ${t}.`,
      (san) => `Juega ${san} para neutralizar las amenazas sobre el monarca.`
    ),
  },
  fallback: hints(
    "¿Cuál es la debilidad más evidente en la posición rival?",
    (t) => `Busca la jugada más activa hacia ${t}.`,
    (san) => `La continuación recomendada por el motor es ${san}.`
  ),
};

const EN: HintTexts = {
  keySquare: "the key square",
  themes: {
    hanging_piece: hints(
      "Is any piece left undefended on the board, or did your last move leave something unprotected?",
      (t) => `Look at the activity and safety around ${t}.`,
      (san) => `The best move is ${san}, securing the piece or punishing the missing defense.`
    ),
    pin_exploitation: hints(
      "Look at the pieces lined up with the enemy king or queen.",
      (t) => `There's a tactical pin you can exploit around ${t}.`,
      (san) => `Play ${san}, taking advantage of the pinned enemy piece.`
    ),
    fork_overlooked: hints(
      "Can a single piece attack two targets at once?",
      (t) => `Look for a fork by putting your piece on ${t}.`,
      (san) => `Play ${san}, landing a decisive double attack.`
    ),
    missed_mate: hints(
      "The enemy king is in a mating net. Calculate forcing moves!",
      (t) => `Give a relentless check by bringing your piece to ${t}.`,
      (san) => `The winning move is ${san}, leading to unavoidable mate.`
    ),
    king_safety_collapse: hints(
      "Assess king safety: open diagonals and files.",
      (t) => `Look at the weaknesses around the castled king and the ${t} square.`,
      (san) => `Play ${san} to neutralize the threats against the king.`
    ),
  },
  fallback: hints(
    "What's the most obvious weakness in your opponent's position?",
    (t) => `Look for the most active move toward ${t}.`,
    (san) => `The engine's recommended continuation is ${san}.`
  ),
};

const BY_LANG: Record<Lang, HintTexts> = { es: ES, en: EN };

export function generateHintsForBlunder(theme: string, bestMoveSan: string, bestMoveUci: string | null, lang: Lang = "es"): TutorHints {
  const set = BY_LANG[lang];
  const target = bestMoveUci ? bestMoveUci.slice(2, 4) : set.keySquare;
  return (set.themes[theme] ?? set.fallback)(target, bestMoveSan);
}
