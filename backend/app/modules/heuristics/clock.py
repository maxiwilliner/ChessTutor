from typing import List, Literal
from backend.app.models.chesscom import NormalizedGame
from backend.app.models.diagnosis import (
    ClockBucket,
    ClockPsychology,
    FastVsThought,
    SpeedAccuracy,
    TimeByPhase,
    TimeEndings,
)
from backend.app.models.engine import EvaluatedMove
from backend.app.modules.chesscom.parser import parse_time_control
from backend.app.modules.engine.scoring import move_accuracy

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


# Tramos del reloj antes de mover (fracción del tiempo inicial): (código, mínimo incluido)
CLOCK_BUCKETS = [("gt50", 0.5), ("25_50", 0.25), ("10_25", 0.10), ("lt10", 0.0)]
LOW_CLOCK_FRACTION = 0.10
# Las primeras jugadas son teoría: rápidas y buenas, sesgarían "rápidas vs pensadas".
SKIP_OPENING_MOVES = 8


def thought_move_threshold(base_time: float) -> float:
    """Jugada "pensada": al menos el 3 % del tiempo inicial (entre 5 y 60 s)."""
    return min(60.0, max(5.0, 0.03 * _base(base_time)))


def _mean_or_zero(xs: List[float], digits: int = 1) -> float:
    return round(sum(xs) / len(xs), digits) if xs else 0.0


def analyze_clock_usage(games: List[NormalizedGame], evaluated_games_moves: List[List[EvaluatedMove]]) -> dict:
    """
    Cifras del reloj que necesitan el tiempo inicial de cada partida (se ignoran las que no lo tienen, p. ej. diarias):
    errores por tramo de reloj, finales por tiempo, tiempo por fase y precisión de jugadas rápidas frente a pensadas.
    """
    buckets = {code: [0, 0] for code, _ in CLOCK_BUCKETS}  # [jugadas, errores graves]
    phase_pct = {"opening": [], "middlegame": [], "endgame": []}
    fast_acc: List[float] = []
    thought_acc: List[float] = []
    games_with_clock = games_low = lost_on_time = won_on_time = 0
    fast_limit = thought_limit = None

    for game, moves in zip(games, evaluated_games_moves):
        base, inc = parse_time_control(game.time_control)
        if base <= 0 or not moves:
            continue
        games_with_clock += 1
        if game.termination == "timeout":
            if game.user_result == "loss":
                lost_on_time += 1
            elif game.user_result == "win":
                won_on_time += 1
        if any(m.clock_remaining_seconds < LOW_CLOCK_FRACTION * base for m in moves):
            games_low += 1

        spent = {"opening": 0.0, "middlegame": 0.0, "endgame": 0.0}
        f_lim, t_lim = impulsive_move_threshold(base), thought_move_threshold(base)
        fast_limit = f_lim if fast_limit is None else fast_limit
        thought_limit = t_lim if thought_limit is None else thought_limit
        for m in moves:
            spent[m.phase] += m.time_spent_seconds
            before = (m.clock_remaining_seconds + m.time_spent_seconds - inc) / base
            for code, low in CLOCK_BUCKETS:
                if before >= low:
                    buckets[code][0] += 1
                    if m.classification in ("blunder", "error"):
                        buckets[code][1] += 1
                    break
            if m.move_number > SKIP_OPENING_MOVES:
                acc = move_accuracy(m.eval_before_cp, m.eval_after_cp)
                if m.time_spent_seconds <= f_lim:
                    fast_acc.append(acc)
                elif m.time_spent_seconds >= t_lim:
                    thought_acc.append(acc)
        for ph in spent:
            phase_pct[ph].append(spent[ph] / base * 100.0)

    if not games_with_clock:
        return {}

    return {
        "error_rate_by_clock": [
            ClockBucket(
                bucket=code,
                moves=buckets[code][0],
                serious_errors=buckets[code][1],
                error_rate=round(buckets[code][1] / buckets[code][0] * 100.0, 1) if buckets[code][0] else 0.0,
            )
            for code, _ in CLOCK_BUCKETS
        ],
        "time_endings": TimeEndings(
            games_with_clock=games_with_clock,
            games_low_clock=games_low,
            lost_on_time=lost_on_time,
            won_on_time=won_on_time,
        ),
        "time_by_phase": TimeByPhase(**{ph: _mean_or_zero(v) for ph, v in phase_pct.items()}),
        "fast_vs_thought": FastVsThought(
            fast=SpeedAccuracy(moves=len(fast_acc), accuracy=_mean_or_zero(fast_acc)),
            thought=SpeedAccuracy(moves=len(thought_acc), accuracy=_mean_or_zero(thought_acc)),
            fast_threshold_seconds=round(fast_limit or 0.0, 1),
            thought_threshold_seconds=round(thought_limit or 0.0, 1),
        ),
    }
