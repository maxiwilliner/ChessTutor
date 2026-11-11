import pytest
from backend.app.models.diagnosis import (
    PlayerDiagnosisSummary,
    PlayerMeta,
    OverallMetrics,
    ErrorBreakdown,
    PhaseDistribution,
    PhaseStats,
    TacticalMotifDetail,
    ClockPsychology,
    OpeningGap,
    AlgorithmicFlag
)
from backend.app.modules.tutor.llm_service import generate_tutor_report


@pytest.mark.asyncio
async def test_generate_tutor_report():
    summary = PlayerDiagnosisSummary(
        player=PlayerMeta(
            username="TestPlayer",
            elo_current=1450,
            time_class="rapid",
            games_analyzed=20,
            period="Recent"
        ),
        overall_metrics=OverallMetrics(
            win_rate=0.5,
            draw_rate=0.1,
            loss_rate=0.4,
            avg_centipawn_loss=45.0,
            accuracy_score=78.5
        ),
        error_breakdown=ErrorBreakdown(
            blunders_total=5,
            errors_total=10,
            inaccuracies_total=15,
            blunders_per_game=0.25
        ),
        phase_distribution=PhaseDistribution(
            opening=PhaseStats(blunders=1, avg_cpl=20.0, percentage_of_blunders=20.0),
            middlegame=PhaseStats(blunders=3, avg_cpl=50.0, percentage_of_blunders=60.0),
            endgame=PhaseStats(blunders=1, avg_cpl=35.0, percentage_of_blunders=20.0)
        ),
        tactical_motifs={
            "hanging_piece": TacticalMotifDetail(count=3, percentage_of_blunders=60.0, description="Piezas colgadas"),
            "pin_exploitation": TacticalMotifDetail(count=1, percentage_of_blunders=20.0, description="Clavadas"),
            "fork_overlooked": TacticalMotifDetail(count=1, percentage_of_blunders=20.0, description="Horquillas"),
            "missed_mate": TacticalMotifDetail(count=0, percentage_of_blunders=0.0, description="Mates"),
            "king_safety_collapse": TacticalMotifDetail(count=0, percentage_of_blunders=0.0, description="Rey expuesto")
        },
        clock_psychology=ClockPsychology(
            blunders_under_3s_with_ample_time=4,
            blunders_in_time_trouble_under_10s=1,
            primary_flaw="impulsive_play",
            avg_time_on_blunders_seconds=2.5,
            avg_time_on_good_moves_seconds=15.0,
            blunder_time_ratio=0.16
        ),
        opening_repertoire_gaps=[
            OpeningGap(
                eco="B01",
                name="Scandinavian Defense",
                color="black",
                games_played=5,
                win_rate=0.2,
                avg_eval_at_move_12=-1.8,
                dominant_blunder_motif="hanging_piece"
            )
        ],
        top_3_algorithmic_flags=[
            AlgorithmicFlag(code="HANGING_PIECES", severity="CRITICAL", metric_reference="60% de blunders son piezas colgadas"),
            AlgorithmicFlag(code="IMPULSIVE_MOVE_SELECTION", severity="HIGH", metric_reference="4 blunders en menos de 3s"),
            AlgorithmicFlag(code="REPERTOIRE_LEAK_B01", severity="HIGH", metric_reference="20% win rate en B01")
        ]
    )

    report = await generate_tutor_report(summary)

    assert report is not None
    assert "TestPlayer" in report.greeting
    assert len(report.top_3_leaks) == 3
    assert len(report.weekly_plan) == 7
    assert len(report.mental_game_tip) > 0
    assert report.top_3_leaks[0].severity == "CRITICAL"

