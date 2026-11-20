/**
 * Port de `generate_deterministic_tutor_report` (backend/app/modules/tutor/llm_service.py), con versión en inglés.
 * En español la salida es idéntica a la de Python (lo comprueba `aggregator.test.ts` contra el fixture).
 */
import type { AlgorithmicFlag, DailyPlanItem, PlayerDiagnosisSummary, TutorLeak, TutorPedagogicalReport } from "@/types/api";
import type { Lang } from "@/lib/i18n/paths";
import { pyFixed0, pyFloat } from "./format";
import { flagMetricText } from "./flags";

type LeakText = Pick<TutorLeak, "title" | "explanation" | "tactical_concept" | "actionable_advice">;

interface TutorTexts {
  greeting: (username: string, games: number, pace: string, elo: number) => string;
  overview: (winPct: string, accuracy: string, cpl: string) => string;
  pace: Record<string, string>;
  hanging: (idx: number, pct: string) => LeakText;
  impulsive: (idx: number, n: number, good: string, bad: string) => LeakText;
  timeTrouble: (idx: number, n: number) => LeakText;
  repertoire: (idx: number, metric: string) => LeakText;
  fallback: (idx: number, code: string, metric: string) => LeakText;
  mental: { default: string; impulsive: string; timeTrouble: string };
  weeklyPlan: DailyPlanItem[];
}

const ES: TutorTexts = {
  greeting: (u, n, pace, elo) => `¡Hola ${u}! He analizado tus ${n} partidas recientes en ritmo ${pace} (Rating actual: ${elo}).`,
  overview: (win, acc, cpl) =>
    `Tu tasa de victorias es del ${win}% con una puntuación de precisión del ${acc}/100 ` +
    `y una pérdida media de ${cpl} centipeones por jugada. Tu juego tiene una base sólida, ` +
    `pero existen 3 patrones muy claros y recurrentes donde se está escapando la mayor parte de tu Elo.`,
  pace: { rapid: "rápido", blitz: "blitz", bullet: "bullet", daily: "diario" },
  hanging: (idx, pct) => ({
    title: `Fuga #${idx}: Piezas Colgadas e Indefensas en Medio Juego`,
    explanation:
      `El ${pct}% ` +
      "de tus fallos graves ocurren al dejar piezas sin suficiente apoyo táctico o al no advertir que una pieza propia está sobrecargada. " +
      "En partidas de ritmo rápido, tiendes a enfocarte en tu plan de ataque y olvidas preguntarte qué amenaza el rival.",
    tactical_concept: "Principio LPDO de John Nunn ('Loose Pieces Drop Off' / Las piezas sueltas caen).",
    actionable_advice: "Antes de confirmar cualquier jugada, haz un escaneo de seguridad de 2 segundos: '¿Alguna de mis piezas queda sin defensa tras este movimiento?'.",
  }),
  impulsive: (idx, n, good, bad) => ({
    title: `Fuga #${idx}: Juego Reactivo e Impulsivo`,
    explanation:
      `Cometiste ${n} errores críticos jugando al instante mientras disponías de abundante tiempo en tu reloj. ` +
      `Tu tiempo medio en jugadas buenas es de ${good}s, pero en tus blunders cae a ${bad}s. ` +
      "Juegas por inercia o reflejo en lugar de calcular.",
    tactical_concept: "Disciplina del Reloj y Regla de las 3 Jugadas Candidatas.",
    actionable_advice: "En posiciones tácticas o cuando el rival realiza una jugada inesperada, obliga a tu mano a soltar el ratón y cuenta mentalmente hasta 3 antes de mover.",
  }),
  timeTrouble: (idx, n) => ({
    title: `Fuga #${idx}: Colapso por Apuro de Tiempo`,
    explanation:
      `Se registraron ${n} errores graves con el reloj casi agotado. ` +
      "Llegas al medio juego tardío habiendo consumido demasiado tiempo en decisiones tempranas no críticas.",
    tactical_concept: "Gestión Progresiva del Tiempo de Juego.",
    actionable_advice: "No inviertas más del 15% de tu tiempo inicial en las primeras 10 jugadas. En aperturas conocidas, juega con fluidez para tener reserva en el final.",
  }),
  repertoire: (idx, metric) => ({
    title: `Fuga #${idx}: Fuga de Apertura en el Repertorio`,
    explanation: `Tus estadísticas en esta línea son desfavorables: ${metric}. Sales de la apertura con desventaja de desarrollo o estructura comprometida.`,
    tactical_concept: "Comprensión de los Planes Típicos de Apertura.",
    actionable_advice: "Revisa las primeras 5 jugadas principales de esta variante y familiarízate con las casillas clave de ruptura de peones.",
  }),
  fallback: (idx, code, metric) => ({
    title: `Fuga #${idx}: ${{ MIDDLEGAME_COLLAPSE: "Derrumbe en el medio juego", GENERAL_TACTICAL_CALCULATION: "Precisión táctica general" }[code] ?? "Cálculo táctico"}`,
    explanation: metric,
    tactical_concept: "Cálculo Táctico y Prevención de Errores.",
    actionable_advice: "Dedica 15 minutos diarios a resolver ejercicios tácticos basados en tus propios errores.",
  }),
  mental: {
    default:
      "Mantén la consistencia psicológica: cuando ganes ventaja material, no te relajes. " +
      "La fase más difícil del ajedrez es convertir una posición ganada sin descuidar la táctica básica.",
    impulsive:
      "Tu mente ve la primera jugada atractiva y tu mano la ejecuta de inmediato. " +
      "Aplica la regla de Lev Alburt: cuando encuentres una buena jugada, no la hagas; busca una mejor o verifica que no te dejen mate en 1.",
    timeTrouble:
      "Cuando el reloj baja de 20 segundos, la adrenalina nubla el cálculo táctico. " +
      "Aprende a jugar jugadas 'sólidas y activas' que no creen nuevas debilidades cuando estés bajo presión de tiempo.",
  },
  weeklyPlan: [
    { day: "Día 1 (Lunes)", focus: "Diagnóstico y Táctica de Piezas Sueltas", duration_minutes: 25, exercises_description: "Resuelve 5 posiciones de tu 'BlunderBank' enfocadas en piezas colgadas. Anota en cada una qué pieza rival no estaba defendida." },
    { day: "Día 2 (Martes)", focus: "Entrenamiento de Pausa y Prevención de Impulsividad", duration_minutes: 30, exercises_description: "Juega 2 partidas a ritmo Rapid (15+10 o 10+0). Regla estricta: ninguna jugada táctica antes de consumir 5 segundos de reloj." },
    { day: "Día 3 (Miércoles)", focus: "Clavadas y Horquillas Tácticas", duration_minutes: 20, exercises_description: "Entrena problemas de clavadas y ataques dobles en Lichess/Chess.com. Reconoce los rayos X hacia el rey o la dama." },
    { day: "Día 4 (Jueves)", focus: "Ajuste de Repertorio de Aperturas", duration_minutes: 25, exercises_description: "Revisa las partidas analizadas donde tu evaluación cayó antes de la jugada 12. Encuentra la jugada de desarrollo recomendada por Stockfish." },
    { day: "Día 5 (Viernes)", focus: "Resolución de Errores Propios (Blunder Replay)", duration_minutes: 30, exercises_description: "Repite los ejercicios de tu BlunderBank sin pedir pistas. Intenta acertar la primera jugada a la primera oportunidad." },
    { day: "Día 6 (Sábado)", focus: "Práctica Competitiva Consciente", duration_minutes: 35, exercises_description: "Juega 3 partidas rápidas aplicando conscientemente el escaneo LPDO en cada turno de tu medio juego." },
    { day: "Día 7 (Domingo)", focus: "Repaso y Evaluación Semanal", duration_minutes: 20, exercises_description: "Vuelve a correr el escaneo del Profesor Personal en ChessTutor para medir la reducción en tu Centipawn Loss y tus piezas colgadas." },
  ],
};

/** El texto del aviso termina en punto; en inglés se encadena en una frase y se quita para no duplicarlo. */
const noDot = (s: string) => s.replace(/\.\s*$/, "");

const EN: TutorTexts = {
  greeting: (u, n, pace, elo) => `Hi ${u}! I've analyzed your ${n} recent ${pace} games (current rating: ${elo}).`,
  overview: (win, acc, cpl) =>
    `Your win rate is ${win}%, with an accuracy score of ${acc}/100 and an average loss of ${cpl} centipawns per move. ` +
    `Your game has a solid base, but there are 3 very clear, recurring patterns where most of your Elo is leaking.`,
  pace: { rapid: "rapid", blitz: "blitz", bullet: "bullet", daily: "daily" },
  hanging: (idx, pct) => ({
    title: `Leak #${idx}: Hanging and Undefended Pieces in the Middlegame`,
    explanation:
      `${pct}% of your serious mistakes come from leaving pieces without enough tactical support, or from missing that one of your pieces is overloaded. ` +
      "In faster games you tend to focus on your attacking plan and forget to ask what your opponent is threatening.",
    tactical_concept: "John Nunn's LPDO principle (“Loose Pieces Drop Off”).",
    actionable_advice: "Before confirming any move, do a 2-second safety scan: “Is any of my pieces left undefended after this move?”",
  }),
  impulsive: (idx, n, good, bad) => ({
    title: `Leak #${idx}: Reactive, Impulsive Play`,
    explanation:
      `You made ${n} critical mistakes moving instantly while you had plenty of time on your clock. ` +
      `Your average time on good moves is ${good}s, but on your blunders it drops to ${bad}s. ` +
      "You're playing on autopilot instead of calculating.",
    tactical_concept: "Clock discipline and the 3 candidate moves rule.",
    actionable_advice: "In tactical positions, or when your opponent plays an unexpected move, take your hand off the mouse and count to 3 before moving.",
  }),
  timeTrouble: (idx, n) => ({
    title: `Leak #${idx}: Time-Trouble Collapse`,
    explanation:
      `${n} serious mistakes happened with your clock almost out. ` +
      "You reach the late middlegame having spent too much time on early, non-critical decisions.",
    tactical_concept: "Progressive time management.",
    actionable_advice: "Don't spend more than 15% of your starting time on the first 10 moves. In openings you know, play fluently to keep a reserve for the endgame.",
  }),
  repertoire: (idx, metric) => ({
    title: `Leak #${idx}: An Opening Leak in Your Repertoire`,
    explanation: `Your results in this line are poor: ${noDot(metric)}. You come out of the opening with worse development or a compromised structure.`,
    tactical_concept: "Understanding the typical plans of the opening.",
    actionable_advice: "Review the first 5 main moves of this line and get familiar with the key pawn-break squares.",
  }),
  fallback: (idx, code, metric) => ({
    title: `Leak #${idx}: ${{ MIDDLEGAME_COLLAPSE: "Middlegame Collapse", GENERAL_TACTICAL_CALCULATION: "General Tactical Accuracy" }[code] ?? "Tactical Calculation"}`,
    explanation: metric,
    tactical_concept: "Tactical calculation and blunder prevention.",
    actionable_advice: "Spend 15 minutes a day solving tactics built from your own mistakes.",
  }),
  mental: {
    default:
      "Stay psychologically consistent: when you win material, don't relax. " +
      "The hardest phase of chess is converting a won position without neglecting basic tactics.",
    impulsive:
      "Your mind sees the first attractive move and your hand plays it right away. " +
      "Apply Lev Alburt's rule: when you find a good move, don't play it yet; look for a better one, or check you're not allowing mate in 1.",
    timeTrouble:
      "When the clock drops below 20 seconds, adrenaline clouds your tactical calculation. " +
      "Learn to play 'solid and active' moves that don't create new weaknesses when you're under time pressure.",
  },
  weeklyPlan: [
    { day: "Day 1 (Monday)", focus: "Diagnosis and Loose-Piece Tactics", duration_minutes: 25, exercises_description: "Solve 5 positions from your BlunderBank focused on hanging pieces. For each one, note which enemy piece was undefended." },
    { day: "Day 2 (Tuesday)", focus: "Pause Training and Impulse Control", duration_minutes: 30, exercises_description: "Play 2 rapid games (15+10 or 10+0). Strict rule: no tactical move before using 5 seconds of your clock." },
    { day: "Day 3 (Wednesday)", focus: "Pins and Forks", duration_minutes: 20, exercises_description: "Train pin and double-attack puzzles on Lichess/Chess.com. Spot the X-rays toward the king or queen." },
    { day: "Day 4 (Thursday)", focus: "Opening Repertoire Tune-up", duration_minutes: 25, exercises_description: "Review the analyzed games where your evaluation dropped before move 12. Find the developing move Stockfish recommends." },
    { day: "Day 5 (Friday)", focus: "Solving Your Own Mistakes (Blunder Replay)", duration_minutes: 30, exercises_description: "Repeat the exercises in your BlunderBank without asking for hints. Try to find the first move on your first attempt." },
    { day: "Day 6 (Saturday)", focus: "Mindful Competitive Practice", duration_minutes: 35, exercises_description: "Play 3 rapid games, consciously applying the LPDO scan on every move of your middlegame." },
    { day: "Day 7 (Sunday)", focus: "Weekly Review", duration_minutes: 20, exercises_description: "Run ChessTutor's analysis again to measure how much your centipawn loss and hanging pieces have dropped." },
  ],
};

const TEXTS: Record<Lang, TutorTexts> = { es: ES, en: EN };

export function generateDeterministicTutorReport(summary: PlayerDiagnosisSummary, lang: Lang = "es"): TutorPedagogicalReport {
  const t = TEXTS[lang];
  const p = summary.player;
  const m = summary.overall_metrics;
  const clk = summary.clock_psychology;
  // En español se usa el texto guardado (idéntico al de Python); en inglés se reconstruye
  const metric = (flag: AlgorithmicFlag) => (lang === "es" ? flag.metric_reference : flagMetricText(flag, summary, lang));

  const greeting = t.greeting(p.username, p.games_analyzed, t.pace[p.time_class] ?? p.time_class, p.elo_current);
  const overview = t.overview(pyFixed0(m.win_rate * 100), pyFloat(m.accuracy_score), pyFloat(m.avg_centipawn_loss));

  const leaks: TutorLeak[] = summary.top_3_algorithmic_flags.map((flag, i) => {
    const idx = i + 1;
    const severity = flag.severity as TutorLeak["severity"];
    let text: LeakText;
    if (flag.code === "HANGING_PIECES") {
      text = t.hanging(idx, pyFloat(summary.tactical_motifs.hanging_piece?.percentage_of_blunders ?? 40));
    } else if (flag.code === "IMPULSIVE_MOVE_SELECTION") {
      text = t.impulsive(
        idx,
        clk.blunders_under_3s_with_ample_time,
        pyFloat(clk.avg_time_on_good_moves_seconds),
        pyFloat(clk.avg_time_on_blunders_seconds)
      );
    } else if (flag.code === "TIME_TROUBLE_PANIC") {
      text = t.timeTrouble(idx, clk.blunders_in_time_trouble_under_10s);
    } else if (flag.code.includes("REPERTOIRE_LEAK")) {
      text = t.repertoire(idx, metric(flag));
    } else {
      text = t.fallback(idx, flag.code, metric(flag));
    }
    return { ...text, severity };
  });

  let mentalTip = t.mental.default;
  if (clk.primary_flaw === "impulsive_play") mentalTip = t.mental.impulsive;
  else if (clk.primary_flaw === "time_trouble_panic") mentalTip = t.mental.timeTrouble;

  return { greeting, overview, top_3_leaks: leaks.slice(0, 3), weekly_plan: t.weeklyPlan.map((d) => ({ ...d })), mental_game_tip: mentalTip };
}
