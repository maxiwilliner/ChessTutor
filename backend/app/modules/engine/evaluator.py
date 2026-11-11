import json
from typing import List, Optional, Tuple
import chess
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.db.models import PositionEvalCache
from backend.app.models.chesscom import NormalizedGame
from backend.app.models.engine import PositionEvaluation, EvaluatedMove
from backend.app.modules.engine.stockfish_pool import stockfish_pool


def determine_phase(board: chess.Board, move_number: int) -> str:
    """
    Classifies position into opening (move 1-12), endgame (low material), or middlegame.
    """
    if move_number <= 12:
        return "opening"

    # Count material (excluding kings and pawns)
    piece_values = {
        chess.QUEEN: 9,
        chess.ROOK: 5,
        chess.BISHOP: 3,
        chess.KNIGHT: 3,
    }
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
            .where(
                PositionEvalCache.fen == fen,
                PositionEvalCache.depth >= depth
            )
            .order_by(PositionEvalCache.depth.desc())
            .limit(1)
        )
        res = await db_session.execute(stmt)
        cached = res.scalars().first()
        if cached:
            pv_list = json.loads(cached.pv_uci_json) if cached.pv_uci_json else []
            return PositionEvaluation(
                fen=fen,
                depth=cached.depth,
                score_cp=cached.score_cp,
                mate_in=cached.mate_in,
                best_move_uci=cached.best_move_uci,
                best_move_san=None,
                pv_uci=pv_list,
                pv_san=[]
            )

    evaluation = await stockfish_pool.evaluate_position(
        fen=fen,
        depth=depth,
        time_limit=time_limit
    )

    if db_session:
        try:
            check_stmt = select(PositionEvalCache.id).where(
                PositionEvalCache.fen == fen,
                PositionEvalCache.depth == depth
            ).limit(1)
            existing = await db_session.execute(check_stmt)
            if not existing.scalar_one_or_none():
                cache_entry = PositionEvalCache(
                    fen=fen,
                    depth=depth,
                    score_cp=evaluation.score_cp,
                    mate_in=evaluation.mate_in,
                    best_move_uci=evaluation.best_move_uci,
                    pv_uci_json=json.dumps(evaluation.pv_uci) if evaluation.pv_uci else None
                )
                db_session.add(cache_entry)
                await db_session.commit()
        except Exception:
            await db_session.rollback()

    return evaluation


async def evaluate_game_smart(
    game: NormalizedGame,
    db_session: Optional[AsyncSession] = None
) -> List[EvaluatedMove]:
    """
    Evaluates a game using the Two-Pass Smart Engine strategy:
    Pass 1: Fast depth evaluation for all moves.
    Pass 2: Deep evaluation only on candidate mistakes (CPL > 50).
    """
    evaluated_moves: List[EvaluatedMove] = []
    user_is_white = (game.user_color == "white")

    # Initial position evaluation
    starting_board = chess.Board()
    curr_eval = await get_or_evaluate_fen(
        fen=starting_board.fen(),
        depth=settings.STOCKFISH_DEPTH_FAST,
        time_limit=settings.STOCKFISH_TIME_LIMIT_FAST,
        db_session=db_session
    )

    for move_info in game.moves:
        is_user_turn = (move_info.turn == game.user_color)

        # Evaluate position after this move (Pass 1)
        next_eval = await get_or_evaluate_fen(
            fen=move_info.fen_after,
            depth=settings.STOCKFISH_DEPTH_FAST,
            time_limit=settings.STOCKFISH_TIME_LIMIT_FAST,
            db_session=db_session
        )

        board_before = chess.Board(move_info.fen_before)
        phase = determine_phase(board_before, move_info.move_number)

        # We primarily analyze and classify the USER's moves
        if is_user_turn:
            eval_before_player = get_player_eval(curr_eval.score_cp, user_is_white)
            eval_after_player = get_player_eval(next_eval.score_cp, user_is_white)

            # Centipawn loss is how much the player degraded their own position
            raw_cpl = eval_before_player - eval_after_player
            cpl = max(0.0, raw_cpl)

            # Classify move
            if cpl < 25.0:
                classification = "best"
            elif cpl < 50.0:
                classification = "good"
            elif cpl < 100.0:
                classification = "inaccuracy"
            elif cpl < 200.0:
                classification = "error"
            else:
                classification = "blunder"

            best_move_uci = curr_eval.best_move_uci
            best_move_san = curr_eval.best_move_san
            pv_uci = curr_eval.pv_uci
            pv_san = curr_eval.pv_san

            # Pass 2: Deep search if CPL >= 50 (Inaccuracy, Error, or Blunder)
            if cpl >= 50.0:
                deep_eval = await get_or_evaluate_fen(
                    fen=move_info.fen_before,
                    depth=settings.STOCKFISH_DEPTH_DEEP,
                    time_limit=settings.STOCKFISH_TIME_LIMIT_DEEP,
                    db_session=db_session
                )
                if deep_eval.best_move_uci:
                    best_move_uci = deep_eval.best_move_uci
                    best_move_san = deep_eval.best_move_san
                    pv_uci = deep_eval.pv_uci
                    pv_san = deep_eval.pv_san

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
                    eval_before_cp=round(eval_before_player, 1),
                    eval_after_cp=round(eval_after_player, 1),
                    cpl=round(cpl, 1),
                    classification=classification,
                    best_move_uci=best_move_uci,
                    best_move_san=best_move_san,
                    pv_uci=pv_uci,
                    pv_san=pv_san,
                    phase=phase
                )
            )

        curr_eval = next_eval

    return evaluated_moves

