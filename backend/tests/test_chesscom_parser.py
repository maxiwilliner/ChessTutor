import pytest
from backend.app.modules.chesscom.parser import (
    parse_clock_string,
    extract_clock_from_comment,
    parse_time_control,
    parse_game_pgn
)


def test_parse_clock_string():
    assert parse_clock_string("0:10:00") == 600.0
    assert parse_clock_string("0:09:55.5") == 595.5
    assert parse_clock_string("1:30:00") == 5400.0
    assert parse_clock_string("5:00") == 300.0
    assert parse_clock_string("0:02") == 2.0
    assert parse_clock_string("invalid") is None


def test_extract_clock_from_comment():
    comment = "{[%clk 0:09:58.2]}"
    assert extract_clock_from_comment(comment) == 598.2

    comment_with_text = "{Interesting move [%clk 0:05:30] Played fast}"
    assert extract_clock_from_comment(comment_with_text) == 330.0

    assert extract_clock_from_comment("{No clock comment here}") is None


def test_parse_time_control():
    assert parse_time_control("600") == (600.0, 0.0)
    assert parse_time_control("180+2") == (180.0, 2.0)
    assert parse_time_control("900+10") == (900.0, 10.0)
    assert parse_time_control("1/86400") == (0.0, 0.0)


def test_parse_game_pgn_with_clocks():
    sample_pgn = """[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.15"]
[Round "-"]
[White "MagnusCarlsen"]
[WhiteElo "2830"]
[Black "Hikaru"]
[BlackElo "2800"]
[Result "1-0"]
[TimeControl "180+2"]
[EndTime "1697380000"]
[Termination "MagnusCarlsen won by resignation"]
[ECO "B01"]
[ECOUrl "https://www.chess.com/openings/Scandinavian-Defense"]

1. e4 {[%clk 0:03:00]} 1... d5 {[%clk 0:02:59]} 2. exd5 {[%clk 0:03:01]} 2... Qxd5 {[%clk 0:02:58]} 3. Nc3 {[%clk 0:03:00]} 3... Qa5 {[%clk 0:02:55]} 1-0"""

    # Test as White
    game_white = parse_game_pgn(sample_pgn, "MagnusCarlsen")
    assert game_white is not None
    assert game_white.user_color == "white"
    assert game_white.user_result == "win"
    assert game_white.eco == "B01"
    assert "Scandinavian Defense" in game_white.opening_name
    assert game_white.moves_count == 6

    # Verify first White move (1. e4):
    # Base: 180s. Remaining: 180s. Inc: 2s. Time spent = 180 - 180 + 2 = 2s
    move_1 = game_white.moves[0]
    assert move_1.ply == 1
    assert move_1.move_number == 1
    assert move_1.turn == "white"
    assert move_1.san == "e4"
    assert move_1.uci == "e2e4"
    assert move_1.clock_remaining_seconds == 180.0
    assert move_1.time_spent_seconds == 2.0

    # Verify first Black move (1... d5):
    # Base: 180s. Remaining: 179s. Inc: 2s. Time spent = 180 - 179 + 2 = 3s
    move_2 = game_white.moves[1]
    assert move_2.ply == 2
    assert move_2.turn == "black"
    assert move_2.san == "d5"
    assert move_2.uci == "d7d5"
    assert move_2.clock_remaining_seconds == 179.0
    assert move_2.time_spent_seconds == 3.0

    # Test as Black
    game_black = parse_game_pgn(sample_pgn, "Hikaru")
    assert game_black is not None
    assert game_black.user_color == "black"
    assert game_black.user_result == "loss"

