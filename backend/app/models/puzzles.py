from datetime import datetime
from typing import List, Literal, Optional, Dict
from pydantic import BaseModel, Field


class BlunderGameMetadata(BaseModel):
    white: str
    black: str
    user_color: Literal["white", "black"]
    eco: str
    opening_name: str
    time_control: str


class BlunderUserMove(BaseModel):
    uci: str
    san: str
    time_spent_seconds: float
    clock_remaining_seconds: float


class BlunderEngineSolution(BaseModel):
    best_move_uci: str
    best_move_san: str
    eval_before: float
    eval_after_user_move: float
    cpl: float
    pv_uci: List[str] = []
    pv_san: List[str] = []


class BlunderClassification(BaseModel):
    phase: Literal["opening", "middlegame", "endgame"]
    theme: str
    psychological_tag: Literal["impulsive", "time_trouble", "normal"]


class TutorHints(BaseModel):
    level_1_conceptual: str = Field(..., description="High-level strategic question without naming pieces")
    level_2_directional: str = Field(..., description="Target area, critical square or tactical device")
    level_3_concrete: str = Field(..., description="Exact move and tactical continuation")


class BlunderBankItem(BaseModel):
    id: str
    game_url: str
    metadata: BlunderGameMetadata
    move_number: int
    turn: Literal["white", "black"]
    fen_before: str
    user_move: BlunderUserMove
    engine_solution: BlunderEngineSolution
    classification: BlunderClassification
    tutor_hints: TutorHints
    is_mastered: bool = False
    consecutive_correct: int = 0
    next_review_at: Optional[datetime] = None
    attempts_count: int = 0
    repeated_blunder_count: int = 0


# Trainer Request/Response Models

class PuzzleAttemptRequest(BaseModel):
    username: str
    puzzle_id: str
    played_uci: str
    is_solved: bool
    repeated_old_blunder: bool = False
    hints_used: int = 0
    time_spent_seconds: float = 0.0


class PuzzleAttemptResponse(BaseModel):
    puzzle_id: str
    username: str
    is_solved: bool
    consecutive_correct: int
    is_mastered: bool
    next_review_at: Optional[datetime] = None
    message: str


class EvaluateMoveRequest(BaseModel):
    puzzle_id: str
    played_uci: str
    fen: Optional[str] = None


class EvaluateMoveResponse(BaseModel):
    is_valid: bool
    is_best: bool
    is_historical_blunder: bool
    cpl_diff: float
    message: str
    opponent_reply_uci: Optional[str] = None
    opponent_reply_san: Optional[str] = None


class TrainerThemeStats(BaseModel):
    theme: str
    total_puzzles: int
    solved_puzzles: int
    mastered_puzzles: int
    success_rate: float


class TrainerStatsResponse(BaseModel):
    username: str
    total_puzzles: int
    solved_puzzles: int
    mastered_puzzles: int
    review_due_puzzles: int
    repeated_blunders_count: int
    mastery_percentage: float
    top_leak_theme: Optional[str] = None
    themes_breakdown: Dict[str, TrainerThemeStats] = {}


