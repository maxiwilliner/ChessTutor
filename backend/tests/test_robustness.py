import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.api.v1.endpoints import analysis as analysis_module
from backend.app.main import app
from backend.app.modules.chesscom.client import ChessComClient


async def _get(path: str):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        return await ac.get(path)


@pytest.mark.asyncio
@pytest.mark.parametrize("path", [
    "/api/v1/chesscom/profile/..%2Fleaderboards",
    "/api/v1/chesscom/profile/a",
    "/api/v1/analysis/summary/bad$name",
    "/api/v1/trainer/stats/" + "x" * 30,
    "/api/v1/analysis/stream?username=..%2F..%2Fclubs",
])
async def test_invalid_usernames_are_rejected(path):
    # 422 from validation; an encoded "/" never matches a route (404). Either way Chess.com is not called.
    with patch.object(ChessComClient, "_get_json", AsyncMock()) as remote:
        status = (await _get(path)).status_code
    assert status in (404, 422)
    remote.assert_not_called()


def _events(body: str):
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


@pytest.mark.asyncio
async def test_stream_reports_chesscom_rate_limit_as_error_event():
    request = httpx.Request("GET", "https://api.chess.com/pub/player/x/games/archives")
    error = httpx.HTTPStatusError("429", request=request, response=httpx.Response(429, request=request))
    with patch.object(analysis_module.client, "get_recent_games", AsyncMock(side_effect=error)):
        res = await _get("/api/v1/analysis/stream?username=someone&limit=1")
    events = _events(res.text)
    assert events[-1]["stage"] == "error"
    assert "limitando" in events[-1]["message"]


@pytest.mark.asyncio
async def test_stream_reports_missing_stockfish():
    with patch.object(analysis_module.client, "get_recent_games", AsyncMock(side_effect=FileNotFoundError("stockfish"))):
        res = await _get("/api/v1/analysis/stream?username=someone&limit=1")
    assert "Stockfish" in _events(res.text)[-1]["message"]


@pytest.mark.asyncio
async def test_chesscom_client_retries_on_429(monkeypatch):
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"archives": ["a", "b"]})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        "backend.app.modules.chesscom.client.httpx.AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    assert await ChessComClient().get_monthly_archives("someone") == ["a", "b"]
    assert calls["n"] == 3


@pytest.mark.asyncio
async def test_tutor_report_is_generated_once_per_analysis():
    from backend.app.api.v1.endpoints import tutor as tutor_module

    sentinel = {"greeting": "hola", "overview": "o", "top_3_leaks": [], "weekly_plan": [], "mental_game_tip": "t"}
    analysis_module._LATEST_ANALYSIS["cacheuser"] = {"summary": object(), "puzzles": [], "report": None}
    fake = AsyncMock(return_value=sentinel)
    try:
        with patch.object(tutor_module, "generate_tutor_report", fake):
            first = await _get("/api/v1/tutor/report/cacheuser")
            second = await _get("/api/v1/tutor/report/cacheuser")
    finally:
        analysis_module._LATEST_ANALYSIS.pop("cacheuser", None)
    assert first.status_code == second.status_code == 200
    assert fake.await_count == 1
