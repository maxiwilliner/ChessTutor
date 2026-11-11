import pytest
from backend.app.models.chesscom import NormalizedGame, MoveWithClock
from backend.app.modules.heuristics.openings import analyze_openings


def create_dummy_game(eco: str, opening_name: str, color: str, result: str, moves_count: int) -> NormalizedGame:
    return NormalizedGame(
        id=f"game_{eco}_{color}_{result}",
        url="https://chess.com/game/1",
        white_username="User" if color == "white" else "Opponent",
        white_rating=1500,
        white_result="1-0" if result == "win" and color == "white" else "0-1",
        black_username="Opponent" if color == "white" else "User",
        black_rating=1500,
        black_result="0-1" if result == "win" and color == "white" else "1-0",
        user_color=color,
        user_result=result,
        time_control="600",
        time_class="rapid",
        eco=eco,
        opening_name=opening_name,
        end_time=1700000000,
        moves_count=moves_count,
        moves=[]
    )


def test_analyze_openings():
    games = [
        create_dummy_game("B01", "Scandinavian Defense", "black", "loss", 20),
        create_dummy_game("B01", "Scandinavian Defense", "black", "loss", 30),
        create_dummy_game("B01", "Scandinavian Defense", "black", "win", 40),
        create_dummy_game("C50", "Italian Game", "white", "win", 25),
        create_dummy_game("C50", "Italian Game", "white", "win", 35),
    ]

    stats = analyze_openings(games)
    assert len(stats) == 2

    # First item should be B01 (3 games played)
    b01_stat = next(s for s in stats if s.eco == "B01" and s.color == "black")
    assert b01_stat.games_played == 3
    assert b01_stat.wins == 1
    assert b01_stat.losses == 2
    assert b01_stat.draws == 0
    assert b01_stat.win_rate == pytest.approx(0.333, abs=0.01)
    assert b01_stat.avg_game_length_moves == 30.0

    # Second item C50 (2 games played, 2 wins)
    c50_stat = next(s for s in stats if s.eco == "C50" and s.color == "white")
    assert c50_stat.games_played == 2
    assert c50_stat.wins == 2
    assert c50_stat.losses == 0
    assert c50_stat.win_rate == 1.0
    assert c50_stat.avg_game_length_moves == 30.0

