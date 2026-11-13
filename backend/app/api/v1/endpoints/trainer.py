import chess
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.db.models import BlunderBankEntity
from backend.app.db.puzzle_service import (
    record_puzzle_attempt,
    get_user_trainer_stats
)
from backend.app.models.puzzles import (
    PuzzleAttemptRequest,
    PuzzleAttemptResponse,
    TrainerStatsResponse,
    EvaluateMoveRequest,
    EvaluateMoveResponse
)
from backend.app.modules.engine.stockfish_pool import stockfish_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trainer", tags=["Trainer"])


@router.post("/attempt", response_model=PuzzleAttemptResponse)
async def submit_puzzle_attempt(
    req: PuzzleAttemptRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a user puzzle attempt, updating Spaced Repetition (SRS) mastery state.
    """
    return await record_puzzle_attempt(db, req)


@router.get("/stats/{username}", response_model=TrainerStatsResponse)
async def get_trainer_stats(
    username: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns aggregated practice statistics, mastery percentage and theme breakdown.
    """
    return await get_user_trainer_stats(db, username)


@router.post("/evaluate-move", response_model=EvaluateMoveResponse)
async def evaluate_alternative_move(
    req: EvaluateMoveRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Evaluates an alternative move played by the user with Stockfish (fast depth=10, time=0.1s).
    Validates legality and marks move as valid if it maintains a winning advantage or CPL <= 35.
    """
    # 1. Retrieve puzzle metadata
    puzzle = None
    if req.puzzle_id:
        res = await db.execute(
            select(BlunderBankEntity).where(BlunderBankEntity.id == req.puzzle_id)
        )
        puzzle = res.scalar_one_or_none()

    fen = puzzle.fen_before if puzzle else req.fen
    if not fen:
        raise HTTPException(status_code=400, detail="FEN or valid puzzle_id is required.")

    try:
        board = chess.Board(fen)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid FEN string.")

    # 2. Check move legality
    try:
        played_move = chess.Move.from_uci(req.played_uci)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid UCI move format: {req.played_uci}")

    if played_move not in board.legal_moves:
        raise HTTPException(status_code=400, detail="Movimiento ilegal en esta posición.")

    best_uci = (puzzle.best_move_uci if puzzle else "").lower()
    user_blunder_uci = (puzzle.user_move_uci if puzzle else "").lower()
    played_uci_clean = req.played_uci.lower()

    # 3. Exact Best Move match
    if best_uci and (played_uci_clean == best_uci or played_uci_clean.startswith(best_uci[:4])):
        return EvaluateMoveResponse(
            is_valid=True,
            is_best=True,
            is_historical_blunder=False,
            cpl_diff=0.0,
            message="¡Excelente! Has encontrado la mejor jugada del motor.",
            opponent_reply_uci=None,
            opponent_reply_san=None
        )

    # 4. Exact Historical Blunder match
    if user_blunder_uci and (played_uci_clean == user_blunder_uci or played_uci_clean.startswith(user_blunder_uci[:4])):
        san = puzzle.user_move_san if puzzle else played_uci_clean
        cpl_val = puzzle.cpl if puzzle else 200.0
        return EvaluateMoveResponse(
            is_valid=False,
            is_best=False,
            is_historical_blunder=True,
            cpl_diff=cpl_val,
            message=f"¡Cuidado! Esta fue la jugada que hiciste en tu partida ({san}) y te costó {int(cpl_val)} centipeones.",
            opponent_reply_uci=None,
            opponent_reply_san=None
        )

    # 5. Evaluate alternative move with Stockfish (depth 10, limit 0.1s)
    board_after_played = board.copy()
    board_after_played.push(played_move)
    eval_played = await stockfish_pool.evaluate_position(
        board_after_played.fen(),
        depth=10,
        time_limit=0.10
    )

    # Best move evaluation
    if best_uci:
        best_move_obj = chess.Move.from_uci(best_uci)
        board_after_best = board.copy()
        board_after_best.push(best_move_obj)
        eval_best = await stockfish_pool.evaluate_position(
            board_after_best.fen(),
            depth=10,
            time_limit=0.10
        )
    else:
        eval_best = eval_played

    # Score comparison from player's perspective
    player_is_white = (board.turn == chess.WHITE)
    score_best_raw = eval_best.score_cp if eval_best.score_cp is not None else 0
    score_played_raw = eval_played.score_cp if eval_played.score_cp is not None else 0

    player_score_best = score_best_raw if player_is_white else -score_best_raw
    player_score_played = score_played_raw if player_is_white else -score_played_raw

    cpl_diff = max(0.0, float(player_score_best - player_score_played))
    is_winning_advantage = player_score_played >= 250  # Decisive advantage

    opponent_reply_uci = eval_played.best_move_uci
    opponent_reply_san = eval_played.best_move_san

    if cpl_diff <= 35.0 or is_winning_advantage:
        return EvaluateMoveResponse(
            is_valid=True,
            is_best=False,
            is_historical_blunder=False,
            cpl_diff=round(cpl_diff, 1),
            message="¡Buena jugada! También gana y mantiene la ventaja, aunque había una opción más precisa del motor.",
            opponent_reply_uci=opponent_reply_uci,
            opponent_reply_san=opponent_reply_san
        )
    else:
        return EvaluateMoveResponse(
            is_valid=False,
            is_best=False,
            is_historical_blunder=False,
            cpl_diff=round(cpl_diff, 1),
            message=f"Jugada legal, pero pierde {int(cpl_diff)} centipeones respecto a la mejor opción táctica.",
            opponent_reply_uci=opponent_reply_uci,
            opponent_reply_san=opponent_reply_san
        )

