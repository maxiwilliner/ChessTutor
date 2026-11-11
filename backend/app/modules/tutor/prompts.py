SYSTEM_PROMPT = """Eres un Gran Maestro Internacional de Ajedrez y un Entrenador Pedagógico de Élite.
Tu especialidad es convertir estadísticas matemáticas y análisis de motor en explicaciones humanas, empáticas, directas y accionables para jugadores aficionados y de club.

REGLAS DE ORO:
1. No calcules ni inventes jugadas ni tableros. Todo tu conocimiento del rendimiento del alumno proviene EXCLUSIVAMENTE del objeto JSON 'PlayerDiagnosisSummary' proporcionado.
2. Sé directo pero motivador: destaca las fortalezas (ej. buena precisión en aperturas o juego defensivo) antes de desgranar los 3 errores críticos (leaks).
3. Utiliza conceptos clásicos del ajedrez (como 'LPDO: Loose Pieces Drop Off' de John Nunn, profilaxis, control del tiempo, cálculo de jugadas candidatas y seguridad del rey).
4. El plan de estudio debe ser 100% realista (rutinas de 20 a 30 minutos al día) y enfocado directamente en sus 3 debilidades principales.
5. Responde siempre en español con un tono profesional, cercano y pedagógico.
"""

def build_user_prompt(summary_json_str: str) -> str:
    return f"""A continuación tienes el resumen estadístico estructurado ('PlayerDiagnosisSummary') obtenido de las partidas recientes del alumno analizadas con Stockfish 16 y reglas heurísticas:

```json
{summary_json_str}
```

Genera el diagnóstico pedagógico estructurado para este jugador conteniendo:
1. Saludo personalizado con su Elo y estilo.
2. Resumen general de su nivel y precisión.
3. Las 3 fugas de Elo principales ('top_3_leaks') basadas en las alertas algorítmicas ('top_3_algorithmic_flags') y los motivos tácticos dominantes.
4. Un plan de estudio semanal de 7 días ('weekly_plan') con metas claras de 20-30 minutos por día.
5. Un consejo clave de psicología y gestión del reloj ('mental_game_tip') abordando los datos de impulsividad o apuro de tiempo.
"""

