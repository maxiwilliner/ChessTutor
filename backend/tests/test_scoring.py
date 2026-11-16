import json
import pytest
from sqlalchemy import create_engine, text

from backend.app.core.database import add_missing_columns, init_db, AsyncSessionLocal
from backend.app.db.models import PositionEvalCache
from backend.app.modules.engine.evaluator import get_or_evaluate_fen
from backend.app.modules.engine.notation import uci_line_to_san
from backend.app.modules.engine.scoring import centipawn_loss, classify_move, move_accuracy, win_percent
from backend.app.modules.heuristics.tactical import classify_tactical_motif

import chess

MATE_IN_2 = 10000 - 200


def test_decided_position_is_not_an_error():
    # +12 -> +6: still totally winning. At most an inaccuracy (as in Lichess), never a puzzle-worthy error
    assert classify_move(1200, 600) not in ("error", "blunder")
    assert classify_move(1500, 900) in ("best", "good")
    # Already lost and still lost
    assert classify_move(-900, -1500) in ("best", "good")


def test_real_blunders_are_detected():
    assert classify_move(50, -350) == "blunder"   # equal -> losing
    assert classify_move(MATE_IN_2, 0) == "blunder"  # threw away a forced mate
    assert classify_move(100, 0) == "inaccuracy"
    assert classify_move(100, -60) == "error"
    assert classify_move(30, 20) == "best"


def test_cpl_is_capped_for_mate_scores():
    assert centipawn_loss(MATE_IN_2, -MATE_IN_2) == 2000.0
    assert centipawn_loss(20, 40) == 0.0


def test_move_accuracy_and_win_percent():
    assert win_percent(0) == pytest.approx(50.0)
    assert move_accuracy(100, 100) == 100.0
    assert move_accuracy(100, 300) == 100.0  # improving is never penalised
    assert move_accuracy(0, -500) < 30.0
    assert 0.0 <= move_accuracy(MATE_IN_2, -MATE_IN_2) <= 1.0


def test_uci_line_to_san():
    start = chess.STARTING_FEN
    assert uci_line_to_san(start, ["e2e4", "e7e5", "g1f3"]) == ("e4", ["e4", "e5", "Nf3"])
    # stops at the first illegal move
    assert uci_line_to_san(start, ["e2e4", "e2e4"]) == ("e4", ["e4"])
    assert uci_line_to_san(start, []) == (None, [])


@pytest.mark.asyncio
async def test_cached_evaluation_has_san():
    await init_db()
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    async with AsyncSessionLocal() as session:
        session.add(PositionEvalCache(fen=fen, depth=99, score_cp=30, best_move_uci="g1f3",
                                      pv_uci_json=json.dumps(["g1f3", "d7d5"])))
        await session.commit()
        ev = await get_or_evaluate_fen(fen, depth=99, db_session=session)
    assert ev.best_move_san == "Nf3"
    assert ev.pv_san == ["Nf3", "d5"]


def test_fork_is_detected_from_opponent_refutation():
    board_before = chess.Board("r3k3/8/8/8/1n6/8/8/R3K2Q w - - 0 1")
    user_move = chess.Move.from_uci("h1h3")  # careless queen move that ignores the knight
    # Opponent's best reply after the user's move: Nc2+ forking king (e1) and rook (a1)
    theme = classify_tactical_motif(board_before, user_move, eval_before_cp=300, eval_after_cp=-200,
                                    cpl=500, opponent_pv=["b4c2"], move_number=30)
    assert theme == "fork_overlooked"


def test_add_missing_columns_migrates_old_schema():
    from backend.app.core.database import Base
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        # Simulate a database created before the refutation columns existed
        Base.metadata.tables["blunder_bank"].create(conn)
        conn.exec_driver_sql("ALTER TABLE blunder_bank DROP COLUMN refutation_uci_json")
        conn.exec_driver_sql("ALTER TABLE blunder_bank DROP COLUMN refutation_san_json")
        added = add_missing_columns(conn)
        cols = {r[1] for r in conn.execute(text("PRAGMA table_info(blunder_bank)"))}
    assert "blunder_bank.refutation_uci_json" in added
    assert {"refutation_uci_json", "refutation_san_json", "theme"} <= cols


def test_game_accuracy_punishes_blunders():
    from backend.app.models.engine import EvaluatedMove
    from backend.app.modules.heuristics.aggregator import game_accuracy

    def mv(before, after):
        return EvaluatedMove(ply=1, move_number=1, turn="white", user_move_uci="e2e4", user_move_san="e4",
                             fen_before=chess.STARTING_FEN, fen_after=chess.STARTING_FEN, time_spent_seconds=1,
                             clock_remaining_seconds=100, eval_before_cp=before, eval_after_cp=after, cpl=0,
                             classification="best")

    clean = [mv(20, 20)] * 20
    one_blunder = [mv(20, 20)] * 19 + [mv(0, -600)]
    assert game_accuracy(clean) == pytest.approx(100.0)
    plain_mean = sum(move_accuracy(m.eval_before_cp, m.eval_after_cp) for m in one_blunder) / len(one_blunder)
    assert plain_mean > 95.0
    assert game_accuracy(one_blunder) < plain_mean - 5.0
