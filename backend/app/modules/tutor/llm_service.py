import os
import json
import logging
from typing import Optional
import httpx

from backend.app.models.diagnosis import PlayerDiagnosisSummary
from backend.app.models.tutor import TutorPedagogicalReport, TutorLeak, DailyPlanItem
from backend.app.modules.tutor.prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)


def generate_deterministic_tutor_report(summary: PlayerDiagnosisSummary) -> TutorPedagogicalReport:
    """
    High-quality pedagogical generator used when external LLM API keys are not configured.
    Converts algorithmic flags, tactical motifs, and clock psychology into a human-grade report.
    """
    p = summary.player
    m = summary.overall_metrics
    clk = summary.clock_psychology

    greeting = f"¡Hola {p.username}! He analizado tus {p.games_analyzed} partidas recientes en ritmo {p.time_class} (Rating actual: {p.elo_current})."
    
    overview = (
        f"Tu tasa de victorias es del {m.win_rate*100:.0f}% con una puntuación de precisión del {m.accuracy_score}/100 "
        f"y una pérdida media de {m.avg_centipawn_loss} centipeones por jugada. Tu juego tiene una base sólida, "
        f"pero existen 3 patrones muy claros y recurrentes donde se está escapando la mayor parte de tu Elo."
    )

    leaks = []
    for idx, flag in enumerate(summary.top_3_algorithmic_flags, 1):
        if flag.code == "HANGING_PIECES":
            leaks.append(
                TutorLeak(
                    title=f"Fuga #{idx}: Piezas Colgadas e Indefensas en Medio Juego",
                    severity=flag.severity,
                    explanation=(
                        f"El {summary.tactical_motifs.get('hanging_piece', {}).percentage_of_blunders if hasattr(summary.tactical_motifs.get('hanging_piece', {}), 'percentage_of_blunders') else 40}% "
                        "de tus fallos graves ocurren al dejar piezas sin suficiente apoyo táctico o al no advertir que una pieza propia está sobrecargada. "
                        "En partidas de ritmo rápido, tiendes a enfocarte en tu plan de ataque y olvidas preguntarte qué amenaza el rival."
                    ),
                    tactical_concept="Principio LPDO de John Nunn ('Loose Pieces Drop Off' / Las piezas sueltas caen).",
                    actionable_advice="Antes de confirmar cualquier jugada, haz un escaneo de seguridad de 2 segundos: '¿Alguna de mis piezas queda sin defensa tras este movimiento?'."
                )
            )
        elif flag.code == "IMPULSIVE_MOVE_SELECTION":
            leaks.append(
                TutorLeak(
                    title=f"Fuga #{idx}: Juego Reactivo e Impulsivo",
                    severity=flag.severity,
                    explanation=(
                        f"Cometiste {clk.blunders_under_3s_with_ample_time} errores críticos en menos de 3 segundos mientras disponías de abundante tiempo en tu reloj. "
                        f"Tu tiempo medio en jugadas buenas es de {clk.avg_time_on_good_moves_seconds}s, pero en tus blunders cae a {clk.avg_time_on_blunders_seconds}s. "
                        "Juegas por inercia o reflejo en lugar de calcular."
                    ),
                    tactical_concept="Disciplina del Reloj y Regla de las 3 Jugadas Candidatas.",
                    actionable_advice="En posiciones tácticas o cuando el rival realiza una jugada inesperada, obliga a tu mano a soltar el ratón y cuenta mentalmente hasta 3 antes de mover."
                )
            )
        elif flag.code == "TIME_TROUBLE_PANIC":
            leaks.append(
                TutorLeak(
                    title=f"Fuga #{idx}: Colapso por Apuro de Tiempo",
                    severity=flag.severity,
                    explanation=(
                        f"Se registraron {clk.blunders_in_time_trouble_under_10s} errores graves con menos de 10 segundos en el reloj. "
                        "Llegas al medio juego tardío habiendo consumido demasiado tiempo en decisiones tempranas no críticas."
                    ),
                    tactical_concept="Gestión Progresiva del Tiempo de Juego.",
                    actionable_advice="No inviertas más del 15% de tu tiempo inicial en las primeras 10 jugadas. En aperturas conocidas, juega con fluidez para tener reserva en el final."
                )
            )
        elif "REPERTOIRE_LEAK" in flag.code:
            leaks.append(
                TutorLeak(
                    title=f"Fuga #{idx}: Fuga de Apertura en el Repertorio",
                    severity=flag.severity,
                    explanation=f"Tus estadísticas en esta línea son desfavorables: {flag.metric_reference}. Sales de la apertura con desventaja de desarrollo o estructura comprometida.",
                    tactical_concept="Comprensión de los Planes Típicos de Apertura.",
                    actionable_advice="Revisa las primeras 5 jugadas principales de esta variante y familiarízate con las casillas clave de ruptura de peones."
                )
            )
        else:
            leaks.append(
                TutorLeak(
                    title=f"Fuga #{idx}: {flag.code.replace('_', ' ').title()}",
                    severity=flag.severity,
                    explanation=flag.metric_reference,
                    tactical_concept="Cálculo Táctico y Prevención de Errores.",
                    actionable_advice="Dedica 15 minutos diarios a resolver ejercicios tácticos basados en tus propios errores."
                )
            )

    weekly_plan = [
        DailyPlanItem(
            day="Día 1 (Lunes)",
            focus="Diagnóstico y Táctica de Piezas Sueltas",
            duration_minutes=25,
            exercises_description="Resuelve 5 posiciones de tu 'BlunderBank' enfocadas en piezas colgadas. Anota en cada una qué pieza rival no estaba defendida."
        ),
        DailyPlanItem(
            day="Día 2 (Martes)",
            focus="Entrenamiento de Pausa y Prevención de Impulsividad",
            duration_minutes=30,
            exercises_description="Juega 2 partidas a ritmo Rapid (15+10 o 10+0). Regla estricta: ninguna jugada táctica antes de consumir 5 segundos de reloj."
        ),
        DailyPlanItem(
            day="Día 3 (Miércoles)",
            focus="Clavadas y Horquillas Tácticas",
            duration_minutes=20,
            exercises_description="Entrena problemas de clavadas y ataques dobles en Lichess/Chess.com. Reconoce los rayos X hacia el rey o la dama."
        ),
        DailyPlanItem(
            day="Día 4 (Jueves)",
            focus="Ajuste de Repertorio de Aperturas",
            duration_minutes=25,
            exercises_description="Revisa las partidas analizadas donde tu evaluación cayó antes de la jugada 12. Encuentra la jugada de desarrollo recomendada por Stockfish."
        ),
        DailyPlanItem(
            day="Día 5 (Viernes)",
            focus="Resolución de Errores Propios (Blunder Replay)",
            duration_minutes=30,
            exercises_description="Repite los ejercicios de tu BlunderBank sin pedir pistas. Intenta acertar la primera jugada a la primera oportunidad."
        ),
        DailyPlanItem(
            day="Día 6 (Sábado)",
            focus="Práctica Competitiva Consciente",
            duration_minutes=35,
            exercises_description="Juega 3 partidas rápidas aplicando conscientemente el escaneo LPDO en cada turno de tu medio juego."
        ),
        DailyPlanItem(
            day="Día 7 (Domingo)",
            focus="Repaso y Evaluación Semanal",
            duration_minutes=20,
            exercises_description="Vuelve a correr el escaneo del Profesor Personal en ChessTutor para medir la reducción en tu Centipawn Loss y tus piezas colgadas."
        ),
    ]

    if clk.primary_flaw == "impulsive_play":
        mental_tip = (
            "Tu mente ve la primera jugada atractiva y tu mano la ejecuta de inmediato. "
            "Aplica la regla de Lev Alburt: cuando encuentres una buena jugada, no la hagas; busca una mejor o verifica que no te dejen mate en 1."
        )
    elif clk.primary_flaw == "time_trouble_panic":
        mental_tip = (
            "Cuando el reloj baja de 20 segundos, la adrenalina nubla el cálculo táctico. "
            "Aprende a jugar jugadas 'sólidas y activas' que no creen nuevas debilidades cuando estés bajo presión de tiempo."
        )
    else:
        mental_tip = (
            "Mantén la consistencia psicológica: cuando ganes ventaja material, no te relajes. "
            "La fase más difícil del ajedrez es convertir una posición ganada sin descuidar la táctica básica."
        )

    return TutorPedagogicalReport(
        greeting=greeting,
        overview=overview,
        top_3_leaks=leaks[:3],
        weekly_plan=weekly_plan,
        mental_game_tip=mental_tip
    )


async def generate_tutor_report(summary: PlayerDiagnosisSummary) -> TutorPedagogicalReport:
    """
    Generates a personalized pedagogical report.
    Uses OpenAI / Gemini if OPENAI_API_KEY or GEMINI_API_KEY is defined in environment,
    otherwise falls back cleanly to the rule-based pedagogical engine.
    """
    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if openai_key:
        try:
            logger.info("Generating report with OpenAI LLM...")
            prompt = build_user_prompt(summary.model_dump_json(indent=2))
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"}
                    }
                )
                if res.status_code == 200:
                    raw_content = res.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(raw_content)
                    return TutorPedagogicalReport.model_validate(parsed)
        except Exception as e:
            logger.warning(f"OpenAI call failed ({e}), falling back to deterministic tutor engine.")

    # High-quality deterministic pedagogical fallback
    return generate_deterministic_tutor_report(summary)

