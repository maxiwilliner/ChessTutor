import json
import logging
from typing import Optional, List

import chess.engine
import httpx
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.params import UsernamePath, UsernameQuery
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


def _event(stage: str, message: str, progress_pct: int, **extra) -> str:
    return f"data: {json.dumps({'stage': stage, 'message': message, 'progress_pct': progress_pct, **extra})}\n\n"


def describe_analysis_error(exc: Exception) -> str:
    """User-facing (Spanish) explanation of an analysis failure."""
    if isinstance(exc, httpx.HTTPStatusError):
        if exc.response.status_code == 429:
            return "Chess.com está limitando las peticiones. Espera un minuto y vuelve a intentarlo."
        return f"Chess.com respondió con un error ({exc.response.status_code}). Inténtalo de nuevo en unos minutos."
    if isinstance(exc, httpx.HTTPError):
        return "No se pudo contactar con Chess.com. Revisa tu conexión a internet."
    if isinstance(exc, (FileNotFoundError, PermissionError, chess.engine.EngineError, chess.engine.EngineTerminatedError)):
        return "No se pudo iniciar Stockfish. Instálalo o configura STOCKFISH_PATH en el archivo .env."
    return f"Error inesperado durante el análisis ({type(exc).__name__}). Revisa los logs del backend."


async def analysis_event_generator(username: str, time_class: str, limit: int):
    """
    Generator yielding Server-Sent Events (SSE) detailing the analysis progress.
    Any failure is reported as an `error` event instead of breaking the stream.
    """
    try:
        async for event in _run_analysis(username, time_class, limit):
            yield event
    except Exception as exc:  # noqa: BLE001 - every failure must reach the client
        logger.exception("Analysis failed for %s", username)
        yield _event("error", describe_analysis_error(exc), 0)


async def _run_analysis(username: str, time_class: str, limit: int):
    yield _event("fetching_games", f"Descargando partidas recientes de {username}...", 5)

    async with AsyncSessionLocal() as db_session:
        games = await client.get_recent_games(
            username=username, time_class=time_class, limit=limit, db_session=db_session
        )
        if not games:
            yield _event("error", f"No se encontraron partidas {time_class} para {username} en Chess.com.", 0)
            return

        total_games = len(games)
        yield _event("evaluating_start", f"Analizando {total_games} partidas con Stockfish...", 10, total_games=total_games)

        evaluated_games_moves = []
        for i, game in enumerate(games, 1):
            pct = 10 + int((i / total_games) * 75)
            yield _event(
                "evaluating",
                f"Evaluando partida {i} de {total_games} ({game.white_username} vs {game.black_username})...",
                pct,
                current_game=i,
                total_games=total_games,
            )
            evaluated_games_moves.append(await evaluate_game_smart(game, db_session=db_session))

    yield _event("classifying", "Clasificando errores tácticos, aperturas y psicología del reloj...", 92)

    summary, puzzles = assemble_diagnosis_and_puzzles(
        username=username, time_class=time_class, games=games, evaluated_games_moves=evaluated_games_moves
    )

    # Persist puzzles (upsert keeps the user's SRS progress)
    try:
        async with AsyncSessionLocal() as session:
            await save_puzzles_idempotent(session, username, puzzles, analyzed_game_ids=[g.id for g in games])
    except Exception as e:
        logger.error(f"Error persisting puzzles to database: {e}")

    # The tutor report is generated lazily (and once) by /tutor/report
    _LATEST_ANALYSIS[username.lower()] = {"summary": summary, "puzzles": puzzles, "report": None}

    yield _event("complete", "Análisis finalizado con éxito.", 100, summary=summary.model_dump(), puzzles_count=len(puzzles))


@router.get("/stream")
async def stream_analysis(
    username: UsernameQuery,
    time_class: str = Query("rapid", pattern="^(rapid|blitz|bullet|daily)$", description="Time control"),
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
async def get_latest_summary(username: UsernamePath):
    """
    Returns the latest computed PlayerDiagnosisSummary for the specified user.
    """
    analysis = _LATEST_ANALYSIS.get(username.lower())
    if not analysis:
        raise HTTPException(status_code=404, detail="No recent analysis found for this user. Run analysis first.")
    return analysis["summary"]


@router.get("/puzzles/{username}", response_model=List[BlunderBankItem])
async def get_latest_puzzles(
    username: UsernamePath,
    theme: Optional[str] = Query(None, description="Filter by tactical theme"),
    top_leak_only: bool = Query(False, description="Filter by user's top tactical leak"),
    status: str = Query("all", description="Filter by status: all, unsolved, mastered, review_due"),
    psych_tag: Optional[str] = Query(None, pattern="^(impulsive|time_trouble|normal)$", description="Filter by clock psychology tag"),
    limit: int = Query(200, ge=1, le=500, description="Max puzzles to return"),
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
        limit=limit,
        psych_tag=psych_tag,
    )
    if db_puzzles:
        return db_puzzles

    # Fallback to in-memory store if DB was empty (e.g. before DB migration or in mocks)
    analysis = _LATEST_ANALYSIS.get(username.lower())
    if analysis and analysis.get("puzzles"):
        puzzles = analysis["puzzles"]
        if theme:
            puzzles = [p for p in puzzles if p.classification.theme == theme]
        if psych_tag:
            puzzles = [p for p in puzzles if p.classification.psychological_tag == psych_tag]
        return puzzles[:limit]

    raise HTTPException(status_code=404, detail="No recent analysis or puzzles found for this user. Run analysis first.")

