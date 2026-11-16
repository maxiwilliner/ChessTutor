import json
from typing import List, Optional, Sequence
import chess
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.db.models import PositionEvalCache
from backend.app.models.chesscom import NormalizedGame
from backend.app.models.engine import PositionEvaluation, EvaluatedMove
from backend.app.modules.engine.notation import uci_line_to_san
from backend.app.modules.engine.scoring import centipawn_loss, classify_move
from backend.app.modules.engine.stockfish_pool import stockfish_pool


def determine_phase(board: chess.Board, move_number: int) -> str:
    """
    Classifies position into opening (move 1-12), endgame (low material), or middlegame.
    """
    if move_number <= 12:
        return "opening"

    piece_values = {chess.QUEEN: 9, chess.ROOK: 5, chess.BISHOP: 3, chess.KNIGHT: 3}
    non_pawn_material = sum(
        len(board.pieces(pt, chess.WHITE)) * val + len(board.pieces(pt, chess.BLACK)) * val
        for pt, val in piece_values.items()
    )
    if non_pawn_material <= 13:
        return "endgame"
    return "middlegame"


def get_player_eval(eval_score_cp: Optional[int], turn_is_white: bool) -> float:
    """
    Converts Centipawns (from White perspective) to the active player's perspective.
    """
    if eval_score_cp is None:
        return 0.0
    return float(eval_score_cp if turn_is_white else -eval_score_cp)


async def get_or_evaluate_fen(
    fen: str,
    depth: int,
    time_limit: Optional[float] = None,
    db_session: Optional[AsyncSession] = None
) -> PositionEvaluation:
    """
    Checks DB cache for the FEN at given depth. If missing, computes with Stockfish.
    """
    if db_session:
        stmt = (
            select(PositionEvalCache)
            .where(PositionEvalCache.fen == fen, PositionEvalCache.depth >= depth)
            .order_by(PositionEvalCache.depth.desc())
            .limit(1)
        )
        cached = (await db_session.execute(stmt)).scalars().first()
        if cached:
            pv_list = json.loads(cached.pv_uci_json) if cached.pv_uci_json else []
            # La caché solo guarda UCI: reconstruir la notación SAN desde la posición.
            best_san, pv_san = uci_line_to_san(fen, pv_list)
            return PositionEvaluation(
                fen=fen,
                depth=cached.depth,
                score_cp=cached.score_cp,
                mate_in=cached.mate_in,
                best_move_uci=cached.best_move_uci,
                best_move_san=best_san,
                pv_uci=pv_list,
                pv_san=pv_san,
            )

    evaluation = await stockfish_pool.evaluate_position(fen=fen, depth=depth, time_limit=time_limit)

    if db_session:
        try:
            check_stmt = select(PositionEvalCache.id).where(
                PositionEvalCache.fen == fen, PositionEvalCache.depth == depth
            ).limit(1)
            existing = await db_session.execute(check_stmt)
            if not existing.scalar_one_or_none():
                db_session.add(
                    PositionEvalCache(
                        fen=fen,
                        depth=depth,
                        score_cp=evaluation.score_cp,
                        mate_in=evaluation.mate_in,
                        best_move_uci=evaluation.best_move_uci,
                        pv_uci_json=json.dumps(evaluation.pv_uci) if evaluation.pv_uci else None,
                    )
                )
                await db_session.commit()
        except Exception:
            await db_session.rollback()

    return evaluation


async def evaluate_many(
    fens: Sequence[str],
    depth: int,
    time_limit: Optional[float],
    db_session: Optional[AsyncSession] = None,
) -> List[PositionEvaluation]:
    """Evaluates a list of positions, preserving order."""
    return [await get_or_evaluate_fen(fen, depth, time_limit, db_session) for fen in fens]


async def evaluate_game_smart(
    game: NormalizedGame,
    db_session: Optional[AsyncSession] = None
) -> List[EvaluatedMove]:
    """
    Evaluates a game using the Two-Pass Smart Engine strategy:
    Pass 1: fast evaluation of every position.
    Pass 2: deep evaluation of the user's inaccuracies or worse, before and after the move.
            The deep scores reclassify the move, give the best line and the opponent's refutation.
    Moves are classified by the drop in winning chances (see scoring.py), not by raw centipawns.
    """
    if not game.moves:
        return []

    user_is_white = game.user_color == "white"
    start_fen = game.moves[0].fen_before

    # Pass 1
    fast_evals = await evaluate_many(
        [start_fen] + [m.fen_after for m in game.moves],
        settings.STOCKFISH_DEPTH_FAST,
        settings.STOCKFISH_TIME_LIMIT_FAST,
        db_session,
    )

    user_indices = [i for i, m in enumerate(game.moves) if m.turn == game.user_color]
    candidates = [
        i for i in user_indices
        if classify_move(
            get_player_eval(fast_evals[i].score_cp, user_is_white),
            get_player_eval(fast_evals[i + 1].score_cp, user_is_white),
        ) in ("inaccuracy", "error", "blunder")
    ]

    # Pass 2: deep evaluation before and after each candidate move
    deep_fens: List[str] = []
    for i in candidates:
        deep_fens += [game.moves[i].fen_before, game.moves[i].fen_after]
    deep_list = await evaluate_many(
        deep_fens, settings.STOCKFISH_DEPTH_DEEP, settings.STOCKFISH_TIME_LIMIT_DEEP, db_session
    )
    deep = {i: (deep_list[2 * k], deep_list[2 * k + 1]) for k, i in enumerate(candidates)}

    evaluated_moves: List[EvaluatedMove] = []
    for i in user_indices:
        move_info = game.moves[i]
        before, after = deep.get(i, (fast_evals[i], fast_evals[i + 1]))
        eval_before = get_player_eval(before.score_cp, user_is_white)
        eval_after = get_player_eval(after.score_cp, user_is_white)
        classification = classify_move(eval_before, eval_after)
        is_mistake = classification in ("inaccuracy", "error", "blunder")

        evaluated_moves.append(
            EvaluatedMove(
                ply=move_info.ply,
                move_number=move_info.move_number,
                turn=move_info.turn,
                user_move_uci=move_info.uci,
                user_move_san=move_info.san,
                fen_before=move_info.fen_before,
                fen_after=move_info.fen_after,
                time_spent_seconds=move_info.time_spent_seconds,
                clock_remaining_seconds=move_info.clock_remaining_seconds,
                eval_before_cp=round(eval_before, 1),
                eval_after_cp=round(eval_after, 1),
                cpl=round(centipawn_loss(eval_before, eval_after), 1),
                classification=classification,
                best_move_uci=before.best_move_uci,
                best_move_san=before.best_move_san,
                pv_uci=before.pv_uci,
                pv_san=before.pv_san,
                refutation_uci=after.pv_uci[:3] if is_mistake else [],
                refutation_san=after.pv_san[:3] if is_mistake else [],
                phase=determine_phase(chess.Board(move_info.fen_before), move_info.move_number),
            )
        )

    return evaluated_moves
