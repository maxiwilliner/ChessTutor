from unittest.mock import patch
import json
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.database import init_db
from backend.app.models.chesscom import NormalizedGame, MoveWithClock


@pytest.mark.asyncio
async def test_stream_analysis_flow():
    await init_db()
    # Sample game with a few moves
    sample_game = NormalizedGame(
        id="test_stream_game",
        url="https://chess.com/game/100",
        white_username="StreamUser",
        white_rating=1600,
        white_result="1-0",
        black_username="Rival",
        black_rating=1580,
        black_result="0-1",
        user_color="white",
        user_result="win",
        time_control="600",
        time_class="rapid",
        eco="C50",
        opening_name="Italian Game",
        end_time=1700000000,
        moves_count=2,
        moves=[
            MoveWithClock(
                ply=1,
                move_number=1,
                turn="white",
                san="e4",
                uci="e2e4",
                fen_before="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                fen_after="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
                clock_remaining_seconds=598.0,
                time_spent_seconds=2.0
            ),
            MoveWithClock(
                ply=2,
                move_number=1,
                turn="black",
                san="e5",
                uci="e7e5",
                fen_before="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
                fen_after="rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
                clock_remaining_seconds=597.0,
                time_spent_seconds=3.0
            )
        ]
    )

    with patch("backend.app.api.v1.endpoints.analysis.client.get_recent_games", return_value=[sample_game]):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            async with ac.stream("GET", "/api/v1/analysis/stream?username=StreamUser&limit=1") as response:
                assert response.status_code == 200
                events = []
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        event_json = json.loads(line[6:])
                        events.append(event_json)

    stages = [e["stage"] for e in events]
    assert "fetching_games" in stages
    assert "evaluating_start" in stages
    assert "evaluating" in stages
    assert "classifying" in stages
    assert "complete" in stages

    final_event = next(e for e in events if e["stage"] == "complete")
    assert final_event["progress_pct"] == 100
    assert "summary" in final_event
    assert final_event["summary"]["player"]["username"] == "StreamUser"
    assert final_event["summary"]["player"]["elo_current"] == 1600
