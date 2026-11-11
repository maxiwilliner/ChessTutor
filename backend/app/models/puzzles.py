from typing import List, Literal, Optional
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

