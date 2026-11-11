from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class PlayerProfile(BaseModel):
    username: str
    title: Optional[str] = None
    status: Optional[str] = None
    avatar: Optional[str] = None
    country: Optional[str] = None
    joined: Optional[int] = None
    url: Optional[str] = None


class RatingStats(BaseModel):
    last_rating: int = 0
    best_rating: int = 0
    win: int = 0
    loss: int = 0
    draw: int = 0


class PlayerStats(BaseModel):
    username: str
    rapid: Optional[RatingStats] = None
    blitz: Optional[RatingStats] = None
    bullet: Optional[RatingStats] = None


class MoveWithClock(BaseModel):
    ply: int = Field(..., description="Ply count (1-based, 1=White move 1, 2=Black move 1, 3=White move 2, etc.)")
    move_number: int = Field(..., description="Full move number (1, 2, 3...)")
    turn: Literal["white", "black"]
    san: str = Field(..., description="Standard Algebraic Notation, e.g. e4, Nf3, O-O")
    uci: str = Field(..., description="UCI notation, e.g. e2e4, g1f3")
    fen_before: str = Field(..., description="FEN position before this move was made")
    fen_after: str = Field(..., description="FEN position after this move was made")
    clock_remaining_seconds: float = Field(..., description="Remaining clock time in seconds after the move")
    time_spent_seconds: float = Field(..., description="Time taken to make this move (delta t)")


class NormalizedGame(BaseModel):
    id: str
    url: str
    white_username: str
    white_rating: int
    white_result: str
    black_username: str
    black_rating: int
    black_result: str
    user_color: Literal["white", "black"]
    user_result: Literal["win", "loss", "draw"]
    time_control: str
    time_class: str  # rapid, blitz, bullet, daily
    eco: str = "Unknown"
    opening_name: str = "Unknown Opening"
    end_time: int
    moves_count: int
    moves: List[MoveWithClock] = []


class OpeningStatItem(BaseModel):
    eco: str
    opening_name: str
    color: Literal["white", "black"]
    games_played: int
    wins: int
    draws: int
    losses: int
    win_rate: float = Field(..., description="Win rate between 0.0 and 1.0")
    avg_game_length_moves: float

