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
    # Impulsive: blunder done in 2.0s with 180s left
    assert tag_move_psychology(time_spent=2.0, clock_remaining=180.0, cpl=250.0) == "impulsive"

    # Time trouble: blunder done with 8.0s left
    assert tag_move_psychology(time_spent=4.0, clock_remaining=8.0, cpl=150.0) == "time_trouble"

    # Normal move
    assert tag_move_psychology(time_spent=15.0, clock_remaining=120.0, cpl=150.0) == "normal"
