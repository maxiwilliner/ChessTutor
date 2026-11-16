import pytest
import chess
from backend.app.modules.heuristics.tactical import (
    detect_hanging_piece,
    detect_pin_exploitation,
    detect_fork,
    detect_missed_mate
)
from backend.app.modules.heuristics.clock import tag_move_psychology, analyze_clock_psychology
from backend.app.models.engine import EvaluatedMove


def test_detect_hanging_piece():
    # White has a Knight on c3. Moves it to b5 where Black has a pawn on a6 attacking b5 with NO white defender.
    board = chess.Board("rnbqkb1r/1ppppppp/p7/8/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1")
    safe_move = chess.Move.from_uci("e2e4")  # Safe move
    assert not detect_hanging_piece(board, safe_move)

    # Move Knight to b5 (hanging to a6 pawn)
    hanging_move = chess.Move.from_uci("c3b5")
    assert detect_hanging_piece(board, hanging_move)


def test_detect_pin_exploitation():
    # Black King on e8, Black Knight on e7. White Rook on e1 pins Knight to King.
    # Relative pin check: Black Queen on e8, Knight on e7, White Rook on e1
    board_rel = chess.Board("4q3/4n3/8/8/8/8/8/4R1K1 b - - 0 1")
    user_move = chess.Move.from_uci("e7g6")  # Moves knight, uncovering Rook attacks Queen!
    assert detect_pin_exploitation(board_rel, user_move)


def test_detect_fork():
    # White Knight moves to c7, forking Black King on e8 and Black Rook on a8.
    # Position after Black moved: White to move (w - - 0 1)
    board = chess.Board("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1")
    # Opponent reply is Nc7+
    reply_fork = chess.Move.from_uci("d5c7")
    assert detect_fork(board, reply_fork)


def test_detect_missed_mate():
    # Position before had mate in 1 (eval 9900), move played dropped eval to 100
    assert detect_missed_mate(eval_before_cp=9900.0, eval_after_cp=150.0, cpl=9750.0)
    assert not detect_missed_mate(eval_before_cp=150.0, eval_after_cp=100.0, cpl=50.0)


def test_clock_psychology_tagging():
    # Rapid 10+0: blunder in 2 s with 180 s left -> impulsive
    assert tag_move_psychology(time_spent=2.0, clock_remaining=180.0, is_serious_error=True, base_time=600) == "impulsive"
    # Rapid 10+0: 25 s left is time trouble (threshold 30 s)
    assert tag_move_psychology(time_spent=4.0, clock_remaining=25.0, is_serious_error=True, base_time=600) == "time_trouble"
    # Slow, deliberate blunder -> normal
    assert tag_move_psychology(time_spent=15.0, clock_remaining=120.0, is_serious_error=True, base_time=600) == "normal"
    # Not a serious error -> never tagged
    assert tag_move_psychology(time_spent=1.0, clock_remaining=500.0, is_serious_error=False, base_time=600) == "normal"


def test_clock_thresholds_are_relative_to_time_control():
    # Bullet 1+0: 2 s per move is normal speed, not impulsive
    assert tag_move_psychology(time_spent=2.0, clock_remaining=40.0, is_serious_error=True, base_time=60) == "normal"
    # Bullet 1+0: an instant move (0.8 s) with 40 s left is impulsive
    assert tag_move_psychology(time_spent=0.8, clock_remaining=40.0, is_serious_error=True, base_time=60) == "impulsive"
    # Bullet: 15 s left is not panic yet (threshold 10 s); 8 s is
    assert tag_move_psychology(time_spent=1.5, clock_remaining=15.0, is_serious_error=True, base_time=60) == "normal"
    assert tag_move_psychology(time_spent=1.5, clock_remaining=8.0, is_serious_error=True, base_time=60) == "time_trouble"
