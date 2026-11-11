from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.chesscom import PlayerProfile, PlayerStats, NormalizedGame, OpeningStatItem
from backend.app.modules.chesscom.client import ChessComClient
from backend.app.modules.heuristics.openings import analyze_openings

router = APIRouter(prefix="/chesscom", tags=["Chess.com"])
client = ChessComClient()


@router.get("/profile/{username}", response_model=PlayerProfile)
async def get_profile(username: str):
    """
    Returns public Chess.com profile information for a user.
    """
    profile = await client.get_player_profile(username)
    if not profile:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found on Chess.com")
    return profile


@router.get("/stats/{username}", response_model=PlayerStats)
async def get_stats(username: str):
    """
    Returns Chess.com rating stats (Rapid, Blitz, Bullet) for a user.
    """
    stats = await client.get_player_stats(username)
    if not stats:
        raise HTTPException(status_code=404, detail=f"Stats for user '{username}' not found")
    return stats


@router.get("/games/{username}", response_model=List[NormalizedGame])
async def get_recent_games(
    username: str,
    time_class: Optional[str] = Query("rapid", description="Time control filter: rapid, blitz, bullet, daily"),
    limit: int = Query(30, ge=1, le=100, description="Number of games to retrieve"),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves and parses the user's recent games with clock tracking for each move.
    """
    games = await client.get_recent_games(
        username=username,
        time_class=time_class,
        limit=limit,
        db_session=db
    )
    return games


@router.get("/openings/{username}", response_model=List[OpeningStatItem])
async def get_opening_stats(
    username: str,
    time_class: Optional[str] = Query("rapid", description="Time control filter: rapid, blitz, bullet"),
    limit: int = Query(30, ge=1, le=100, description="Number of recent games to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """
    Analyzes opening repertoire and win/draw/loss rates by ECO code from recent games.
    """
    games = await client.get_recent_games(
        username=username,
        time_class=time_class,
        limit=limit,
        db_session=db
    )
    if not games:
        return []
    return analyze_openings(games)

