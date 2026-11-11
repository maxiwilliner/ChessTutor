import json
import asyncio
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
async def get_latest_puzzles(username: str):
    """
    Returns the interactive exercises (BlunderBank) generated from the user's mistakes.
    """
    analysis = _LATEST_ANALYSIS.get(username.lower())
    if not analysis:
        raise HTTPException(status_code=404, detail="No recent analysis found for this user. Run analysis first.")
    return analysis["puzzles"]

