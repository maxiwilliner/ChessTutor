"""
Resumen por partida (sin LLM): Elo de ambos, precisión tuya y del rival, y qué pasó con la ventaja.

La precisión del rival sale de las evaluaciones que ya tenemos: entre dos jugadas tuyas consecutivas,
`eval_after` de la primera y `eval_before` de la segunda encierran la jugada del rival.
"""
from typing import Dict, List, Optional, Set

from backend.app.models.chesscom import NormalizedGame
from backend.app.models.diagnosis import (
    AdvantageStats,
    GameRecap,
    GameStats,
    RatingGapBucket,
    VsOpponentStats,
)
from backend.app.models.engine import EvaluatedMove
from backend.app.modules.engine.scoring import clamp_cp, move_accuracy

ADVANTAGE_CP = 300  # ventaja ganadora (≈ +3)
LOST_BELOW_CP = 100  # la ventaja se considera perdida por debajo de +1
SIMILAR_RATING = 50  # rival "similar": ±50 de Elo


def combine_accuracies(acc: List[float]) -> float:
    """Precisión de partida (estilo Lichess): media de la aritmética y la armónica de las precisiones por jugada."""
    if not acc:
        return 0.0
    arithmetic = sum(acc) / len(acc)
    harmonic = len(acc) / sum(1.0 / max(a, 1.0) for a in acc)
    return (arithmetic + harmonic) / 2


def opponent_move_accuracies(moves: List[EvaluatedMove]) -> List[float]:
    out = []
    for a, b in zip(moves, moves[1:]):
        if b.ply != a.ply + 2:
            continue
        # Desde la perspectiva del rival: signo contrario
        out.append(move_accuracy(-a.eval_after_cp, -b.eval_before_cp))
    return out


def build_game_recap(game: NormalizedGame, moves: List[EvaluatedMove], puzzle_ids: Set[str]) -> GameRecap:
    white = game.user_color == "white"
    user_rating = game.white_rating if white else game.black_rating
    opp_rating = game.black_rating if white else game.white_rating
    opponent = game.black_username if white else game.white_username

    user_acc = round(combine_accuracies([move_accuracy(m.eval_before_cp, m.eval_after_cp) for m in moves]), 1) if moves else None
    opp_list = opponent_move_accuracies(moves)
    opp_acc = round(combine_accuracies(opp_list), 1) if opp_list else None

    series = [clamp_cp(m.eval_before_cp) for m in moves] + ([clamp_cp(moves[-1].eval_after_cp)] if moves else [])
    max_eval = round(max(series) / 100.0, 2) if series else 0.0
    min_eval = round(min(series) / 100.0, 2) if series else 0.0

    had_adv = any(clamp_cp(m.eval_before_cp) >= ADVANTAGE_CP for m in moves)
    had_disadv = any(clamp_cp(m.eval_before_cp) <= -ADVANTAGE_CP for m in moves)
    advantage = None
    if had_adv:
        advantage = {"win": "converted", "draw": "drawn", "loss": "thrown"}[game.user_result]
    disadvantage = None
    if had_disadv:
        disadvantage = {"win": "saved_win", "draw": "saved_draw", "loss": "lost"}[game.user_result]

    lost_move: Optional[int] = None
    lost_puzzle: Optional[str] = None
    if advantage in ("drawn", "thrown"):
        seen = False
        for m in moves:
            if clamp_cp(m.eval_before_cp) >= ADVANTAGE_CP:
                seen = True
            if seen and clamp_cp(m.eval_after_cp) < LOST_BELOW_CP:
                lost_move = m.move_number
                pid = f"bb_{game.id}_m{m.move_number}_{m.turn}"
                lost_puzzle = pid if pid in puzzle_ids else None
                break

    return GameRecap(
        id=game.id,
        url=game.url,
        end_time=game.end_time,
        color=game.user_color,
        result=game.user_result,
        termination=game.termination,
        user_rating=user_rating,
        opponent_rating=opp_rating,
        opponent_username=opponent,
        eco=game.eco,
        opening_name=game.opening_name,
        moves_count=game.moves_count,
        user_accuracy=user_acc,
        opponent_accuracy=opp_acc,
        max_eval=max_eval,
        min_eval=min_eval,
        advantage=advantage,
        disadvantage=disadvantage,
        advantage_lost_move=lost_move,
        advantage_lost_puzzle_id=lost_puzzle,
    )


def rating_gap_key(recap: GameRecap) -> str:
    gap = recap.opponent_rating - recap.user_rating
    if gap > SIMILAR_RATING:
        return "stronger"
    if gap < -SIMILAR_RATING:
        return "weaker"
    return "similar"


def build_game_stats(recaps: List[GameRecap]) -> GameStats:
    adv = [r for r in recaps if r.advantage]
    dis = [r for r in recaps if r.disadvantage]
    compared = [r for r in recaps if r.user_accuracy is not None and r.opponent_accuracy is not None]
    better = [r for r in compared if r.user_accuracy > r.opponent_accuracy]
    worse = [r for r in compared if r.user_accuracy < r.opponent_accuracy]

    by_gap: Dict[str, RatingGapBucket] = {}
    for key in ("stronger", "similar", "weaker"):
        rs = [r for r in recaps if rating_gap_key(r) == key]
        wins = sum(1 for r in rs if r.result == "win")
        draws = sum(1 for r in rs if r.result == "draw")
        by_gap[key] = RatingGapBucket(
            games=len(rs),
            wins=wins,
            draws=draws,
            losses=len(rs) - wins - draws,
            win_rate=round(wins / len(rs), 2) if rs else 0.0,
        )

    return GameStats(
        advantage=AdvantageStats(
            games_with_advantage=len(adv),
            converted=sum(1 for r in adv if r.advantage == "converted"),
            drawn=sum(1 for r in adv if r.advantage == "drawn"),
            thrown=sum(1 for r in adv if r.advantage == "thrown"),
            games_with_disadvantage=len(dis),
            saved_draw=sum(1 for r in dis if r.disadvantage == "saved_draw"),
            saved_win=sum(1 for r in dis if r.disadvantage == "saved_win"),
            lost=sum(1 for r in dis if r.disadvantage == "lost"),
        ),
        vs_opponent=VsOpponentStats(
            games_compared=len(compared),
            played_better=len(better),
            played_better_lost=sum(1 for r in better if r.result == "loss"),
            played_worse_won=sum(1 for r in worse if r.result == "win"),
        ),
        by_rating_gap=by_gap,
    )
