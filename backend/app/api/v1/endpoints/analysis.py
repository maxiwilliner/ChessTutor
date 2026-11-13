import json
import asyncio
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db, AsyncSessionLocal
from backend.app.models.diagnosis import PlayerDiagnosisSummary
from backend.app.models.puzzles import BlunderBankItem
from backend.app.modules.chesscom.client import ChessComClient
from backend.app.modules.engine.evaluator import evaluate_game_smart
from backend.app.modules.heuristics.aggregator import assemble_diagnosis_and_puzzles
from backend.app.db.puzzle_service import save_puzzles_idempotent, get_user_puzzles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["Analysis"])
client = ChessComClient()

# In-memory session cache for recent analyses (can be backed by DB)
_LATEST_ANALYSIS: dict = {}


async def analysis_event_generator(username: str, time_class: str, limit: int):
    """
    Generator yielding Server-Sent Events (SSE) detailing the analysis progress.
    """
    yield f"data: {json.dumps({'stage': 'fetching_games', 'message': f'Descargando partidas recientes de {username}...', 'progress_pct': 5})}\n\n"

    async with AsyncSessionLocal() as db_session:
        games = await client.get_recent_games(
            username=username,
            time_class=time_class,
            limit=limit,
            db_session=db_session
        )

        if not games:
            yield f"data: {json.dumps({'stage': 'error', 'message': f'No se encontraron partidas {time_class} para {username}.', 'progress_pct': 0})}\n\n"
            return

        total_games = len(games)
        yield f"data: {json.dumps({'stage': 'evaluating_start', 'total_games': total_games, 'message': f'Analizando {total_games} partidas con Stockfish...', 'progress_pct': 10})}\n\n"

        evaluated_games_moves = []
        for i, game in enumerate(games, 1):
            pct = 10 + int((i / total_games) * 75)
            yield f"data: {json.dumps({'stage': 'evaluating', 'current_game': i, 'total_games': total_games, 'message': f'Evaluando partida {i} de {total_games} ({game.white_username} vs {game.black_username})...', 'progress_pct': pct})}\n\n"
            
            # Evaluate with Stockfish (Pass 1 & Pass 2)
            moves_evaluated = await evaluate_game_smart(game, db_session=db_session)
            evaluated_games_moves.append(moves_evaluated)

        yield f"data: {json.dumps({'stage': 'classifying', 'message': 'Clasificando errores tácticos, aperturas y psicología del reloj...', 'progress_pct': 92})}\n\n"

        summary, puzzles = assemble_diagnosis_and_puzzles(
            username=username,
            time_class=time_class,
            games=games,
            evaluated_games_moves=evaluated_games_moves
        )

        # Persist puzzles in SQLite idempotently (preserving any prior user SRS progress)
        try:
            async with AsyncSessionLocal() as session:
                await save_puzzles_idempotent(session, username, puzzles)
        except Exception as e:
            logger.error(f"Error persisting puzzles to database: {e}")

        # Store latest analysis in memory cache
        _LATEST_ANALYSIS[username.lower()] = {
            "summary": summary,
            "puzzles": puzzles
        }

        yield f"data: {json.dumps({'stage': 'complete', 'message': 'Análisis finalizado con éxito.', 'progress_pct': 100, 'summary': summary.model_dump(), 'puzzles_count': len(puzzles)})}\n\n"


@router.get("/stream")
async def stream_analysis(
    username: str = Query(..., description="Chess.com username"),
    time_class: Optional[str] = Query("rapid", description="Time control (rapid, blitz, bullet)"),
    limit: int = Query(15, ge=1, le=50, description="Number of games to analyze")
):
    """
    Server-Sent Events endpoint streaming the progress of the Stockfish & Heuristic analysis.
    """
    return StreamingResponse(
        analysis_event_generator(username, time_class, limit),
        media_type="text/event-stream"
    )


@router.get("/summary/{username}", response_model=PlayerDiagnosisSummary)
async def get_latest_summary(username: str):
    """
    Returns the latest computed PlayerDiagnosisSummary for the specified user.
    """
    analysis = _LATEST_ANALYSIS.get(username.lower())
    if not analysis:
        raise HTTPException(status_code=404, detail="No recent analysis found for this user. Run analysis first.")
    return analysis["summary"]


@router.get("/puzzles/{username}", response_model=List[BlunderBankItem])
async def get_latest_puzzles(
    username: str,
    theme: Optional[str] = Query(None, description="Filter by tactical theme"),
    top_leak_only: bool = Query(False, description="Filter by user's top tactical leak"),
    status: str = Query("all", description="Filter by status: all, unsolved, mastered, review_due"),
    limit: int = Query(50, ge=1, le=100, description="Max puzzles to return"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the interactive exercises (BlunderBank) generated from the user's mistakes.
    Pulls from SQLite with Spaced Repetition status, falling back to memory if DB has none.
    """
    db_puzzles = await get_user_puzzles(
        session=db,
        username=username,
        theme=theme,
        top_leak_only=top_leak_only,
        status=status,
        limit=limit
    )
    if db_puzzles:
        return db_puzzles

    # Fallback to in-memory store if DB was empty (e.g. before DB migration or in mocks)
    analysis = _LATEST_ANALYSIS.get(username.lower())
    if analysis and analysis.get("puzzles"):
        puzzles = analysis["puzzles"]
        if theme:
            puzzles = [p for p in puzzles if p.classification.theme == theme]
        return puzzles[:limit]

    raise HTTPException(status_code=404, detail="No recent analysis or puzzles found for this user. Run analysis first.")

