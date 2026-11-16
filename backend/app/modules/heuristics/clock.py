from typing import List, Literal
from backend.app.models.diagnosis import ClockPsychology
from backend.app.models.engine import EvaluatedMove

PsychTag = Literal["impulsive", "time_trouble", "normal"]

DEFAULT_BASE_SECONDS = 600.0


def _base(base_time: float) -> float:
    return base_time if base_time and base_time > 0 else DEFAULT_BASE_SECONDS


def time_trouble_threshold(base_time: float) -> float:
    """Segundos restantes por debajo de los cuales hay apuro: 10 s en bullet/blitz, hasta 30 s en rápidas."""
    return min(30.0, max(10.0, 0.05 * _base(base_time)))


def impulsive_move_threshold(base_time: float) -> float:
    """Tiempo de reflexión que se considera "jugar por reflejo": 3 s en rápidas/blitz, ~1 s en bullet."""
    return min(3.0, max(1.0, 0.02 * _base(base_time)))


def tag_move_psychology(
    time_spent: float,
    clock_remaining: float,
    is_serious_error: bool,
    base_time: float = 0.0,
) -> PsychTag:
    """
    Etiqueta un error grave según la gestión del reloj, con umbrales relativos al control de tiempo:
    - time_trouble: quedaba menos de `time_trouble_threshold` en el reloj.
    - impulsive: se jugó en menos de `impulsive_move_threshold` teniendo al menos el 25 % del tiempo base.
    """
    if not is_serious_error:
        return "normal"
    if clock_remaining < time_trouble_threshold(base_time):
        return "time_trouble"
    if time_spent <= impulsive_move_threshold(base_time) and clock_remaining >= 0.25 * _base(base_time):
        return "impulsive"
    return "normal"


def analyze_clock_psychology(moves: List[EvaluatedMove]) -> ClockPsychology:
    """
    Aggregates clock data across all analyzed moves to diagnose psychological habits.
    Relies on `psychological_tag`, set by the aggregator for each error/blunder.
    """
    serious = [m for m in moves if m.classification in ("blunder", "error")]
    good = [m for m in moves if m.classification in ("best", "good")]

    impulsive = sum(1 for m in serious if m.psychological_tag == "impulsive")
    time_trouble = sum(1 for m in serious if m.psychological_tag == "time_trouble")

    avg_blunder_time = round(sum(m.time_spent_seconds for m in serious) / len(serious), 1) if serious else 0.0
    avg_good_time = round(sum(m.time_spent_seconds for m in good) / len(good), 1) if good else 0.0
    blunder_time_ratio = round(avg_blunder_time / avg_good_time, 2) if avg_good_time > 0 else 1.0

    if impulsive >= 3 and impulsive >= time_trouble:
        primary_flaw = "impulsive_play"
    elif time_trouble >= 3 and time_trouble > impulsive:
        primary_flaw = "time_trouble_panic"
    else:
        primary_flaw = "none"

    return ClockPsychology(
        blunders_under_3s_with_ample_time=impulsive,
        blunders_in_time_trouble_under_10s=time_trouble,
        primary_flaw=primary_flaw,
        avg_time_on_blunders_seconds=avg_blunder_time,
        avg_time_on_good_moves_seconds=avg_good_time,
        blunder_time_ratio=blunder_time_ratio,
    )
