/** Port de `generate_deterministic_tutor_report` (backend/app/modules/tutor/llm_service.py). */
import type { DailyPlanItem, PlayerDiagnosisSummary, TutorLeak, TutorPedagogicalReport } from "@/types/api";
import { pyFixed0, pyFloat } from "./format";

const TIME_CLASS_ES: Record<string, string> = { rapid: "rápido", blitz: "blitz", bullet: "bullet", daily: "diario" };

const FALLBACK_LEAK_TITLES: Record<string, string> = {
  MIDDLEGAME_COLLAPSE: "Derrumbe en el medio juego",
  GENERAL_TACTICAL_CALCULATION: "Precisión táctica general",
};

const WEEKLY_PLAN: DailyPlanItem[] = [
  { day: "Día 1 (Lunes)", focus: "Diagnóstico y Táctica de Piezas Sueltas", duration_minutes: 25, exercises_description: "Resuelve 5 posiciones de tu 'BlunderBank' enfocadas en piezas colgadas. Anota en cada una qué pieza rival no estaba defendida." },
  { day: "Día 2 (Martes)", focus: "Entrenamiento de Pausa y Prevención de Impulsividad", duration_minutes: 30, exercises_description: "Juega 2 partidas a ritmo Rapid (15+10 o 10+0). Regla estricta: ninguna jugada táctica antes de consumir 5 segundos de reloj." },
  { day: "Día 3 (Miércoles)", focus: "Clavadas y Horquillas Tácticas", duration_minutes: 20, exercises_description: "Entrena problemas de clavadas y ataques dobles en Lichess/Chess.com. Reconoce los rayos X hacia el rey o la dama." },
  { day: "Día 4 (Jueves)", focus: "Ajuste de Repertorio de Aperturas", duration_minutes: 25, exercises_description: "Revisa las partidas analizadas donde tu evaluación cayó antes de la jugada 12. Encuentra la jugada de desarrollo recomendada por Stockfish." },
  { day: "Día 5 (Viernes)", focus: "Resolución de Errores Propios (Blunder Replay)", duration_minutes: 30, exercises_description: "Repite los ejercicios de tu BlunderBank sin pedir pistas. Intenta acertar la primera jugada a la primera oportunidad." },
  { day: "Día 6 (Sábado)", focus: "Práctica Competitiva Consciente", duration_minutes: 35, exercises_description: "Juega 3 partidas rápidas aplicando conscientemente el escaneo LPDO en cada turno de tu medio juego." },
  { day: "Día 7 (Domingo)", focus: "Repaso y Evaluación Semanal", duration_minutes: 20, exercises_description: "Vuelve a correr el escaneo del Profesor Personal en ChessTutor para medir la reducción en tu Centipawn Loss y tus piezas colgadas." },
];

export function generateDeterministicTutorReport(summary: PlayerDiagnosisSummary): TutorPedagogicalReport {
  const p = summary.player;
  const m = summary.overall_metrics;
  const clk = summary.clock_psychology;

  const pace = TIME_CLASS_ES[p.time_class] ?? p.time_class;
  const greeting = `¡Hola ${p.username}! He analizado tus ${p.games_analyzed} partidas recientes en ritmo ${pace} (Rating actual: ${p.elo_current}).`;
  const overview =
    `Tu tasa de victorias es del ${pyFixed0(m.win_rate * 100)}% con una puntuación de precisión del ${pyFloat(m.accuracy_score)}/100 ` +
    `y una pérdida media de ${pyFloat(m.avg_centipawn_loss)} centipeones por jugada. Tu juego tiene una base sólida, ` +
    `pero existen 3 patrones muy claros y recurrentes donde se está escapando la mayor parte de tu Elo.`;

  const leaks: TutorLeak[] = summary.top_3_algorithmic_flags.map((flag, i) => {
    const idx = i + 1;
    if (flag.code === "HANGING_PIECES") {
      const pct = summary.tactical_motifs.hanging_piece?.percentage_of_blunders ?? 40;
      return {
        title: `Fuga #${idx}: Piezas Colgadas e Indefensas en Medio Juego`,
        severity: flag.severity as TutorLeak["severity"],
        explanation:
          `El ${pyFloat(pct)}% ` +
          "de tus fallos graves ocurren al dejar piezas sin suficiente apoyo táctico o al no advertir que una pieza propia está sobrecargada. " +
          "En partidas de ritmo rápido, tiendes a enfocarte en tu plan de ataque y olvidas preguntarte qué amenaza el rival.",
        tactical_concept: "Principio LPDO de John Nunn ('Loose Pieces Drop Off' / Las piezas sueltas caen).",
        actionable_advice: "Antes de confirmar cualquier jugada, haz un escaneo de seguridad de 2 segundos: '¿Alguna de mis piezas queda sin defensa tras este movimiento?'.",
      };
    }
    if (flag.code === "IMPULSIVE_MOVE_SELECTION") {
      return {
        title: `Fuga #${idx}: Juego Reactivo e Impulsivo`,
        severity: flag.severity as TutorLeak["severity"],
        explanation:
          `Cometiste ${clk.blunders_under_3s_with_ample_time} errores críticos jugando al instante mientras disponías de abundante tiempo en tu reloj. ` +
          `Tu tiempo medio en jugadas buenas es de ${pyFloat(clk.avg_time_on_good_moves_seconds)}s, pero en tus blunders cae a ${pyFloat(clk.avg_time_on_blunders_seconds)}s. ` +
          "Juegas por inercia o reflejo en lugar de calcular.",
        tactical_concept: "Disciplina del Reloj y Regla de las 3 Jugadas Candidatas.",
        actionable_advice: "En posiciones tácticas o cuando el rival realiza una jugada inesperada, obliga a tu mano a soltar el ratón y cuenta mentalmente hasta 3 antes de mover.",
      };
    }
    if (flag.code === "TIME_TROUBLE_PANIC") {
      return {
        title: `Fuga #${idx}: Colapso por Apuro de Tiempo`,
        severity: flag.severity as TutorLeak["severity"],
        explanation:
          `Se registraron ${clk.blunders_in_time_trouble_under_10s} errores graves con el reloj casi agotado. ` +
          "Llegas al medio juego tardío habiendo consumido demasiado tiempo en decisiones tempranas no críticas.",
        tactical_concept: "Gestión Progresiva del Tiempo de Juego.",
        actionable_advice: "No inviertas más del 15% de tu tiempo inicial en las primeras 10 jugadas. En aperturas conocidas, juega con fluidez para tener reserva en el final.",
      };
    }
    if (flag.code.includes("REPERTOIRE_LEAK")) {
      return {
        title: `Fuga #${idx}: Fuga de Apertura en el Repertorio`,
        severity: flag.severity as TutorLeak["severity"],
        explanation: `Tus estadísticas en esta línea son desfavorables: ${flag.metric_reference}. Sales de la apertura con desventaja de desarrollo o estructura comprometida.`,
        tactical_concept: "Comprensión de los Planes Típicos de Apertura.",
        actionable_advice: "Revisa las primeras 5 jugadas principales de esta variante y familiarízate con las casillas clave de ruptura de peones.",
      };
    }
    return {
      title: `Fuga #${idx}: ${FALLBACK_LEAK_TITLES[flag.code] ?? "Cálculo táctico"}`,
      severity: flag.severity as TutorLeak["severity"],
      explanation: flag.metric_reference,
      tactical_concept: "Cálculo Táctico y Prevención de Errores.",
      actionable_advice: "Dedica 15 minutos diarios a resolver ejercicios tácticos basados en tus propios errores.",
    };
  });

  let mentalTip =
    "Mantén la consistencia psicológica: cuando ganes ventaja material, no te relajes. " +
    "La fase más difícil del ajedrez es convertir una posición ganada sin descuidar la táctica básica.";
  if (clk.primary_flaw === "impulsive_play") {
    mentalTip =
      "Tu mente ve la primera jugada atractiva y tu mano la ejecuta de inmediato. " +
      "Aplica la regla de Lev Alburt: cuando encuentres una buena jugada, no la hagas; busca una mejor o verifica que no te dejen mate en 1.";
  } else if (clk.primary_flaw === "time_trouble_panic") {
    mentalTip =
      "Cuando el reloj baja de 20 segundos, la adrenalina nubla el cálculo táctico. " +
      "Aprende a jugar jugadas 'sólidas y activas' que no creen nuevas debilidades cuando estés bajo presión de tiempo.";
  }

  return { greeting, overview, top_3_leaks: leaks.slice(0, 3), weekly_plan: WEEKLY_PLAN.map((d) => ({ ...d })), mental_game_tip: mentalTip };
}
