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


class ClockBucket(BaseModel):
    """Jugadas según el reloj que quedaba antes de mover, en % del tiempo inicial."""
    bucket: Literal["gt50", "25_50", "10_25", "lt10"]
    moves: int
    serious_errors: int
    error_rate: float  # % de errores graves (error + blunder)


class TimeEndings(BaseModel):
    games_with_clock: int
    games_low_clock: int  # bajaste del 10 % del tiempo inicial
    lost_on_time: int
    won_on_time: int


class TimeByPhase(BaseModel):
    """% medio del tiempo inicial gastado en cada fase, por partida."""
    opening: float
    middlegame: float
    endgame: float


class SpeedAccuracy(BaseModel):
    moves: int
    accuracy: float


class FastVsThought(BaseModel):
    fast: SpeedAccuracy
    thought: SpeedAccuracy
    fast_threshold_seconds: float
    thought_threshold_seconds: float


class ClockPsychology(BaseModel):
    blunders_under_3s_with_ample_time: int
    blunders_in_time_trouble_under_10s: int
    primary_flaw: Literal["impulsive_play", "time_trouble_panic", "none"]
    avg_time_on_blunders_seconds: float
    avg_time_on_good_moves_seconds: float
    blunder_time_ratio: float
    error_rate_by_clock: Optional[List[ClockBucket]] = None
    time_endings: Optional[TimeEndings] = None
    time_by_phase: Optional[TimeByPhase] = None
    fast_vs_thought: Optional[FastVsThought] = None


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


class GameRecap(BaseModel):
    """Una partida analizada: resultado, Elo, precisión de ambos y qué pasó con la ventaja."""
    id: str
    url: str
    end_time: int
    color: Literal["white", "black"]
    result: Literal["win", "loss", "draw"]
    termination: str
    user_rating: int
    opponent_rating: int
    opponent_username: str
    eco: str
    opening_name: str
    moves_count: int
    user_accuracy: Optional[float] = None
    opponent_accuracy: Optional[float] = None
    max_eval: float  # peones, tu perspectiva, acotado a ±10
    min_eval: float
    advantage: Optional[Literal["converted", "drawn", "thrown"]] = None
    disadvantage: Optional[Literal["saved_draw", "saved_win", "lost"]] = None
    advantage_lost_move: Optional[int] = None
    advantage_lost_puzzle_id: Optional[str] = None


class AdvantageStats(BaseModel):
    games_with_advantage: int
    converted: int
    drawn: int
    thrown: int
    games_with_disadvantage: int
    saved_draw: int
    saved_win: int
    lost: int


class VsOpponentStats(BaseModel):
    games_compared: int
    played_better: int
    played_better_lost: int
    played_worse_won: int


class RatingGapBucket(BaseModel):
    games: int
    wins: int
    draws: int
    losses: int
    win_rate: float


class GameStats(BaseModel):
    advantage: AdvantageStats
    vs_opponent: VsOpponentStats
    by_rating_gap: Dict[str, RatingGapBucket]  # stronger | similar | weaker


class PlayerDiagnosisSummary(BaseModel):
    player: PlayerMeta
    overall_metrics: OverallMetrics
    error_breakdown: ErrorBreakdown
    phase_distribution: PhaseDistribution
    tactical_motifs: Dict[str, TacticalMotifDetail]
    clock_psychology: ClockPsychology
    opening_repertoire_gaps: List[OpeningGap]
    top_3_algorithmic_flags: List[AlgorithmicFlag]
    game_stats: Optional[GameStats] = None
    # Por partida. Lleva nombres de rivales: no se envía al LLM (ver llm_service).
    games: Optional[List[GameRecap]] = None

