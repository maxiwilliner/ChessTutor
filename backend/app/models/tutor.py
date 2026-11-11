from typing import List, Literal
from pydantic import BaseModel, Field


class TutorLeak(BaseModel):
    title: str = Field(..., description="Short title of the critical flaw, e.g. 'Fuga #1: Piezas Indefensas en Medio Juego'")
    severity: Literal["CRITICAL", "HIGH", "MEDIUM"]
    explanation: str = Field(..., description="Empathetic and precise explanation of why this error happens and how it loses Elo")
    tactical_concept: str = Field(..., description="The chess theory or motif behind it (e.g., LPDO: Loose Pieces Drop Off)")
    actionable_advice: str = Field(..., description="Clear step-by-step habit to eliminate this mistake")


class DailyPlanItem(BaseModel):
    day: str = Field(..., description="e.g. 'Día 1 (Lunes)'")
    focus: str = Field(..., description="Theme, e.g. 'Táctica de Piezas Indefensas y LPDO'")
    duration_minutes: int = Field(default=25)
    exercises_description: str = Field(..., description="Specific routine instructions (e.g., resolver 10 ejercicios de BlunderBank + 15 min de táctica)")


class TutorPedagogicalReport(BaseModel):
    greeting: str = Field(..., description="Personalized greeting addressing the player's level and rating")
    overview: str = Field(..., description="High-level evaluation of their playing style, accuracy and current level")
    top_3_leaks: List[TutorLeak] = Field(..., description="The 3 primary algorithmic flaws that cost the most Elo")
    weekly_plan: List[DailyPlanItem] = Field(..., description="Structured 7-day study plan tailored to their weaknesses")
    mental_game_tip: str = Field(..., description="Advice on clock management, emotional tilt or impulsive thinking")

