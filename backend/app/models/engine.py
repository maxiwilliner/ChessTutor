from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class PositionEvaluation(BaseModel):
    fen: str
    depth: int
    score_cp: Optional[int] = None  # centipawns from White's perspective (+ positive for White, - for Black)
    mate_in: Optional[int] = None   # + if White has forced mate in N, - if Black has forced mate in N
    best_move_uci: Optional[str] = None
    best_move_san: Optional[str] = None
    pv_uci: List[str] = []
    pv_san: List[str] = []


class EvaluatedMove(BaseModel):
    ply: int
    move_number: int
    turn: Literal["white", "black"]
    user_move_uci: str
    user_move_san: str
    fen_before: str
    fen_after: str
    time_spent_seconds: float
    clock_remaining_seconds: float
    
    # Engine evaluation metrics
    eval_before_cp: float = Field(..., description="Evaluation before move from moving player's perspective")
    eval_after_cp: float = Field(..., description="Evaluation after move from moving player's perspective")
    cpl: float = Field(..., description="Centipawn Loss (loss in advantage for the player)")
    classification: Literal["best", "excellent", "good", "inaccuracy", "error", "blunder"]
    
    # Solution
    best_move_uci: Optional[str] = None
    best_move_san: Optional[str] = None
    pv_uci: List[str] = []
    pv_san: List[str] = []
    
    # Heuristics tags
    phase: Literal["opening", "middlegame", "endgame"] = "middlegame"
    tactical_theme: Optional[str] = None
    psychological_tag: Optional[Literal["impulsive", "time_trouble", "normal"]] = "normal"

