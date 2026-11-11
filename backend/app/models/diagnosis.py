from typing import List, Dict, Optional, Literal
from pydantic import BaseModel, Field


class PlayerMeta(BaseModel):
    username: str
    elo_current: int
    time_class: str
    games_analyzed: int
    period: str


class OverallMetrics(BaseModel):
    win_rate: float
    draw_rate: float
    loss_rate: float
    avg_centipawn_loss: float
    accuracy_score: float


class ErrorBreakdown(BaseModel):
    blunders_total: int
    errors_total: int
    inaccuracies_total: int
    blunders_per_game: float


class PhaseStats(BaseModel):
    blunders: int
    avg_cpl: float
    percentage_of_blunders: float


class PhaseDistribution(BaseModel):
    opening: PhaseStats
    middlegame: PhaseStats
    endgame: PhaseStats


class TacticalMotifDetail(BaseModel):
    count: int
    percentage_of_blunders: float
    description: str


class ClockPsychology(BaseModel):
    blunders_under_3s_with_ample_time: int
    blunders_in_time_trouble_under_10s: int
    primary_flaw: Literal["impulsive_play", "time_trouble_panic", "none"]
    avg_time_on_blunders_seconds: float
    avg_time_on_good_moves_seconds: float
    blunder_time_ratio: float


class OpeningGap(BaseModel):
    eco: str
    name: str
    color: Literal["white", "black"]
    games_played: int
    win_rate: float
    avg_eval_at_move_12: float
    dominant_blunder_motif: str


class AlgorithmicFlag(BaseModel):
    code: str
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    metric_reference: str


class PlayerDiagnosisSummary(BaseModel):
    player: PlayerMeta
    overall_metrics: OverallMetrics
    error_breakdown: ErrorBreakdown
    phase_distribution: PhaseDistribution
    tactical_motifs: Dict[str, TacticalMotifDetail]
    clock_psychology: ClockPsychology
    opening_repertoire_gaps: List[OpeningGap]
    top_3_algorithmic_flags: List[AlgorithmicFlag]

