import pytest
from backend.app.models.chesscom import NormalizedGame, MoveWithClock
from backend.app.models.engine import EvaluatedMove
from backend.app.modules.heuristics.aggregator import assemble_diagnosis_and_puzzles


def test_assemble_diagnosis_and_puzzles():
    game = NormalizedGame(
        id="test_game_1",
        url="https://chess.com/game/1",
        white_username="UserTest",
        white_rating=1500,
        white_result="0-1",
        black_username="RivalTest",
        black_rating=1520,
        black_result="1-0",
        user_color="white",
        user_result="loss",
        time_control="600",
        time_class="rapid",
        eco="B01",
        opening_name="Scandinavian Defense",
        end_time=1700000000,
        moves_count=2,
        moves=[]
    )

    # Move 1: 1. e4 (good)
    m1 = EvaluatedMove(
        ply=1,
        move_number=1,
        turn="white",
        user_move_uci="e2e4",
        user_move_san="e4",
        fen_before="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        fen_after="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        time_spent_seconds=1.5,
        clock_remaining_seconds=598.5,
        eval_before_cp=20.0,
        eval_after_cp=30.0,
        cpl=0.0,
        classification="best",
        best_move_uci="e2e4",
        best_move_san="e4",
        pv_uci=["e2e4", "e7e5"],
        pv_san=["e4", "e5"],
        phase="opening"
    )

    # Move 2: User blunders Knight on move 2 (c3b5?? hanging piece to a6 pawn)
    m2 = EvaluatedMove(
        ply=3,
        move_number=2,
        turn="white",
        user_move_uci="c3b5",
        user_move_san="Nb5??",
        fen_before="rnbqkb1r/1ppppppp/p7/8/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 2",
        fen_after="rnbqkb1r/1ppppppp/p7/1N6/8/8/PPPPPPPP/R1BQKBNR b KQkq - 1 2",
        time_spent_seconds=1.8,
        clock_remaining_seconds=550.0,
        eval_before_cp=50.0,
        eval_after_cp=-350.0,
        cpl=400.0,
        classification="blunder",
        best_move_uci="e2e4",
        best_move_san="e4",
        pv_uci=["e2e4", "e7e5"],
        pv_san=["e4", "e5"],
        phase="opening"
    )

    summary, puzzles = assemble_diagnosis_and_puzzles(
        username="UserTest",
        time_class="rapid",
        games=[game],
        evaluated_games_moves=[[m1, m2]]
    )

    # Validate schema compliance
    assert summary.player.username == "UserTest"
    assert summary.error_breakdown.blunders_total == 1
    assert summary.overall_metrics.win_rate == 0.0
    assert summary.overall_metrics.loss_rate == 1.0

    # Clock psychology: move was 1.8s with 550s remaining -> impulsive
    assert summary.clock_psychology.blunders_under_3s_with_ample_time == 1

    # Check top flags
    assert len(summary.top_3_algorithmic_flags) >= 1

    # Check puzzle generated in BlunderBank
    assert len(puzzles) == 1
    p = puzzles[0]
    assert p.user_move.san == "Nb5??"
    assert p.engine_solution.best_move_san == "e4"
    assert p.classification.theme == "hanging_piece"
    assert p.classification.psychological_tag == "impulsive"
    assert len(p.tutor_hints.level_1_conceptual) > 0
    assert len(p.tutor_hints.level_3_concrete) > 0
