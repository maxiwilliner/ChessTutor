from unittest.mock import patch
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.models.chesscom import PlayerProfile, PlayerStats, RatingStats


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


@pytest.mark.asyncio
async def test_profile_success():
    mock_profile = PlayerProfile(
        username="hikaru",
        title="GM",
        status="premium",
        avatar="https://images.chesscomfiles.com/hikaru.jpg",
        country="https://api.chess.com/pub/country/US",
        joined=123456789,
        url="https://www.chess.com/member/hikaru"
    )

    with patch("backend.app.api.v1.endpoints.chesscom.client.get_player_profile", return_value=mock_profile):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/v1/chesscom/profile/hikaru")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "hikaru"
    assert data["title"] == "GM"


@pytest.mark.asyncio
async def test_profile_not_found():
    with patch("backend.app.api.v1.endpoints.chesscom.client.get_player_profile", return_value=None):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/v1/chesscom/profile/unknown_user")

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"]


@pytest.mark.asyncio
async def test_stats_success():
    mock_stats = PlayerStats(
        username="hikaru",
        rapid=RatingStats(last_rating=2800, best_rating=2850, win=100, loss=10, draw=20),
        blitz=RatingStats(last_rating=3200, best_rating=3350, win=5000, loss=500, draw=400)
    )

    with patch("backend.app.api.v1.endpoints.chesscom.client.get_player_stats", return_value=mock_stats):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/api/v1/chesscom/stats/hikaru")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "hikaru"
    assert data["blitz"]["last_rating"] == 3200
