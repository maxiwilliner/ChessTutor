"""
Métricas de calidad de jugada basadas en probabilidad de victoria (mismo modelo que Lichess).

Todas las funciones reciben evaluaciones en centipeones desde la perspectiva del jugador que mueve.
Las puntuaciones de mate se codifican como ±(10000 − 100·n) en `stockfish_pool`, por eso se acotan
a ±CP_CAP antes de calcular nada: un mate perdido no debe valer 9000 centipeones de "pérdida".
"""
import math
from typing import Literal

CP_CAP = 1000.0

# Umbrales de caída de "winning chances" (escala −1..1), como en lichess/modules/analyse/Advice.scala
BLUNDER_DROP = 0.30
ERROR_DROP = 0.20
INACCURACY_DROP = 0.10

Classification = Literal["best", "good", "inaccuracy", "error", "blunder"]


def clamp_cp(cp: float) -> float:
    return max(-CP_CAP, min(CP_CAP, cp))


def winning_chances(cp: float) -> float:
    """Ventaja esperada en [−1, 1] a partir de centipeones (curva logística de Lichess)."""
    return 2.0 / (1.0 + math.exp(-0.00368208 * clamp_cp(cp))) - 1.0


def win_percent(cp: float) -> float:
    """Probabilidad de victoria en [0, 100]."""
    return 50.0 + 50.0 * winning_chances(cp)


def centipawn_loss(eval_before_cp: float, eval_after_cp: float) -> float:
    """Pérdida en centipeones con las evaluaciones acotadas a ±CP_CAP."""
    return max(0.0, clamp_cp(eval_before_cp) - clamp_cp(eval_after_cp))


def classify_move(eval_before_cp: float, eval_after_cp: float) -> Classification:
    """
    Clasifica una jugada por la caída de probabilidad de victoria.
    Una posición ya decidida (p. ej. +12 → +6) apenas cambia la probabilidad y no cuenta como error.
    """
    drop = winning_chances(eval_before_cp) - winning_chances(eval_after_cp)
    if drop >= BLUNDER_DROP:
        return "blunder"
    if drop >= ERROR_DROP:
        return "error"
    if drop >= INACCURACY_DROP:
        return "inaccuracy"
    return "best" if centipawn_loss(eval_before_cp, eval_after_cp) < 25.0 else "good"


def move_accuracy(eval_before_cp: float, eval_after_cp: float) -> float:
    """Precisión de una jugada (0-100) según la caída de probabilidad de victoria (fórmula de Lichess)."""
    drop = win_percent(eval_before_cp) - win_percent(eval_after_cp)
    if drop <= 0:
        return 100.0
    raw = 103.1668 * math.exp(-0.04354 * drop) - 3.1669
    return max(0.0, min(100.0, raw))
