import asyncio
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


MAX_RETRIES = 3
# Chess.com asks API clients to avoid parallel requests; allow at most two in flight.
_REQUEST_SLOTS = asyncio.Semaphore(2)


class ChessComClient:
    BASE_URL = "https://api.chess.com/pub"

    def __init__(self, user_agent: Optional[str] = None):
        self.headers = {
            "User-Agent": user_agent or settings.CHESSCOM_USER_AGENT,
            "Accept": "application/json",
        }

    async def _get_json(self, url: str, timeout: float = 10.0) -> Optional[Dict[str, Any]]:
        """
        GET a Chess.com endpoint. Returns None on 404. Requests are serialised through a shared
        semaphore (Chess.com rate-limits parallel requests) and retried on 429/5xx, honouring Retry-After.
        Raises httpx.HTTPStatusError if it still fails after the retries.
        """
        async with _REQUEST_SLOTS:
            async with httpx.AsyncClient(headers=self.headers, timeout=timeout) as client:
                for attempt in range(MAX_RETRIES + 1):
                    resp = await client.get(url)
                    if resp.status_code == 404:
                        return None
                    retryable = resp.status_code == 429 or resp.status_code >= 500
                    if retryable and attempt < MAX_RETRIES:
                        retry_after = resp.headers.get("Retry-After", "")
                        delay = float(retry_after) if retry_after.isdigit() else 2 ** attempt
                        await asyncio.sleep(min(delay, 10.0))
                        continue
                    resp.raise_for_status()
                    return resp.json()
        return None

    async def get_player_profile(self, username: str) -> Optional[PlayerProfile]:
        url = f"{self.BASE_URL}/player/{username.lower()}"
        data = await self._get_json(url)
        if data is None:
            return None
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
        data = await self._get_json(url)
        if data is None:
            return None

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
        data = await self._get_json(url)
        return data.get("archives", []) if data else []

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
        data = await self._get_json(archive_url, timeout=15.0)
        if data is None:
            return []
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
                # Solo ajedrez estándar: Chess960 y otras variantes comparten ritmo pero no aperturas
                if raw_game.get("rules", "chess") != "chess":
                    continue

                pgn_text = raw_game.get("pgn")
                if not pgn_text:
                    continue

                game_norm = parse_game_pgn(pgn_text, username)
                if game_norm:
                    if isinstance(raw_game.get("end_time"), int):
                        game_norm.end_time = raw_game["end_time"]
                    normalized_games.append(game_norm)
                    if len(normalized_games) >= limit:
                        return normalized_games

        return normalized_games

