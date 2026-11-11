from typing import List, Literal, Tuple
from backend.app.models.diagnosis import ClockPsychology
from backend.app.models.engine import EvaluatedMove


def tag_move_psychology(
    time_spent: float,
    clock_remaining: float,
    cpl: float
) -> Literal["impulsive", "time_trouble", "normal"]:
    """
    Labels a move based on clock management:
    - Impulsive: move played in <= 3 seconds with abundant clock (> 120s or > 60s) resulting in an error.
    - Time trouble: move played in critical time pressure (< 15s).
    """
    if cpl >= 100.0:
        if clock_remaining < 15.0:
            return "time_trouble"
        if time_spent <= 3.0 and clock_remaining >= 60.0:
            return "impulsive"

    return "normal"


def analyze_clock_psychology(moves: List[EvaluatedMove]) -> ClockPsychology:
    """
    Aggregates clock data across all analyzed moves to diagnose psychological habits.
    """
    blunders_under_3s = 0
    blunders_time_trouble = 0
    blunder_times: List[float] = []
    good_move_times: List[float] = []

    for m in moves:
        if m.classification in ("blunder", "error"):
            blunder_times.append(m.time_spent_seconds)
            if m.time_spent_seconds <= 3.0 and m.clock_remaining_seconds >= 60.0:
                blunders_under_3s += 1
            if m.clock_remaining_seconds < 15.0:
                blunders_time_trouble += 1
        elif m.classification in ("best", "good"):
            good_move_times.append(m.time_spent_seconds)

    avg_blunder_time = round(sum(blunder_times) / len(blunder_times), 1) if blunder_times else 0.0
    avg_good_time = round(sum(good_move_times) / len(good_move_times), 1) if good_move_times else 0.0

    blunder_time_ratio = round(avg_blunder_time / avg_good_time, 2) if avg_good_time > 0 else 1.0

    # Determine primary flaw
    if blunders_under_3s >= 3 and blunders_under_3s >= blunders_time_trouble:
        primary_flaw = "impulsive_play"
    elif blunders_time_trouble >= 3 and blunders_time_trouble > blunders_under_3s:
        primary_flaw = "time_trouble_panic"
    else:
        primary_flaw = "none"

    return ClockPsychology(
        blunders_under_3s_with_ample_time=blunders_under_3s,
        blunders_in_time_trouble_under_10s=blunders_time_trouble,
        primary_flaw=primary_flaw,
        avg_time_on_blunders_seconds=avg_blunder_time,
        avg_time_on_good_moves_seconds=avg_good_time,
        blunder_time_ratio=blunder_time_ratio
    )

