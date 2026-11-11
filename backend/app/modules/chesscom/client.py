import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.db.models import MonthlyGamesCache
from backend.app.models.chesscom import PlayerProfile, PlayerStats, RatingStats, NormalizedGame
from backend.app.modules.chesscom.parser import parse_game_pgn


class ChessComClient:
    BASE_URL = "https://api.chess.com/pub"

    def __init__(self, user_agent: Optional[str] = None):
        self.headers = {
            "User-Agent": user_agent or settings.CHESSCOM_USER_AGENT,
            "Accept": "application/json",
        }

    async def get_player_profile(self, username: str) -> Optional[PlayerProfile]:
        url = f"{self.BASE_URL}/player/{username.lower()}"
        async with httpx.AsyncClient(headers=self.headers, timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
            return PlayerProfile(
                username=data.get("username", username),
                title=data.get("title"),
                status=data.get("status"),
                avatar=data.get("avatar"),
                country=data.get("country"),
                joined=data.get("joined"),
                url=data.get("url")
            )

    async def get_player_stats(self, username: str) -> Optional[PlayerStats]:
        url = f"{self.BASE_URL}/player/{username.lower()}/stats"
        async with httpx.AsyncClient(headers=self.headers, timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()

            def extract_stats(section_name: str) -> Optional[RatingStats]:
                sec = data.get(section_name)
                if not sec:
                    return None
                last = sec.get("last", {}).get("rating", 0)
                best = sec.get("best", {}).get("rating", 0)
                record = sec.get("record", {})
                return RatingStats(
                    last_rating=last,
                    best_rating=best,
                    win=record.get("win", 0),
                    loss=record.get("loss", 0),
                    draw=record.get("draw", 0)
                )

            return PlayerStats(
                username=username,
                rapid=extract_stats("chess_rapid"),
                blitz=extract_stats("chess_blitz"),
                bullet=extract_stats("chess_bullet")
            )

    async def get_monthly_archives(self, username: str) -> List[str]:
        url = f"{self.BASE_URL}/player/{username.lower()}/games/archives"
        async with httpx.AsyncClient(headers=self.headers, timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
            return data.get("archives", [])

    async def get_monthly_games(
        self,
        username: str,
        archive_url: str,
        db_session: Optional[AsyncSession] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetches games from a monthly archive URL (e.g. .../games/2026/09).
        Caches past months permanently and current month with TTL.
        """
        parts = archive_url.rstrip("/").split("/")
        year = int(parts[-2])
        month = int(parts[-1])

        now = datetime.now(timezone.utc)
        is_current_month = (year == now.year and month == now.month)

        if db_session:
            stmt = select(MonthlyGamesCache).where(
                MonthlyGamesCache.username == username.lower(),
                MonthlyGamesCache.year == year,
                MonthlyGamesCache.month == month
            )
            res = await db_session.execute(stmt)
            cached = res.scalar_one_or_none()

            if cached:
                if cached.is_completed_month:
                    return json.loads(cached.data_json)
                # Check TTL for current month
                elapsed_hours = (now.replace(tzinfo=None) - cached.fetched_at).total_seconds() / 3600.0
                if elapsed_hours < settings.CACHE_EXPIRATION_HOURS:
                    return json.loads(cached.data_json)

        # Fetch from Chess.com API
        async with httpx.AsyncClient(headers=self.headers, timeout=15.0) as client:
            resp = await client.get(archive_url)
            if resp.status_code == 404:
                return []
            resp.raise_for_status()
            data = resp.json()
            games_raw = data.get("games", [])

        # Save to DB cache
        if db_session:
            is_completed = not is_current_month
            if cached:
                cached.data_json = json.dumps(games_raw)
                cached.fetched_at = datetime.utcnow()
                cached.is_completed_month = is_completed
            else:
                new_cache = MonthlyGamesCache(
                    username=username.lower(),
                    year=year,
                    month=month,
                    archive_url=archive_url,
                    data_json=json.dumps(games_raw),
                    is_completed_month=is_completed,
                    fetched_at=datetime.utcnow()
                )
                db_session.add(new_cache)
            await db_session.commit()

        return games_raw

    async def get_recent_games(
        self,
        username: str,
        time_class: Optional[str] = "rapid",
        limit: int = 30,
        db_session: Optional[AsyncSession] = None
    ) -> List[NormalizedGame]:
        """
        Retrieves the most recent N games for a user, traversing monthly archives
        in reverse chronological order.
        """
        archives = await self.get_monthly_archives(username)
        if not archives:
            return []

        # Most recent first
        archives.reverse()

        normalized_games: List[NormalizedGame] = []

        for archive_url in archives:
            raw_games = await self.get_monthly_games(username, archive_url, db_session)
            # Most recent games within month are at the end, so inspect in reverse
            for raw_game in reversed(raw_games):
                # Filter by time_class if provided
                if time_class and raw_game.get("time_class") != time_class:
                    continue

                pgn_text = raw_game.get("pgn")
                if not pgn_text:
                    continue

                game_norm = parse_game_pgn(pgn_text, username)
                if game_norm:
                    normalized_games.append(game_norm)
                    if len(normalized_games) >= limit:
                        return normalized_games

        return normalized_games

