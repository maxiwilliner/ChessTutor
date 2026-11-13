from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, UniqueConstraint
from backend.app.core.database import Base


class MonthlyGamesCache(Base):
    """
    Cache for Chess.com monthly archives: /pub/player/{username}/games/{YYYY}/{MM}
    Past months are immutable (is_completed_month = True) and never expire.
    The current ongoing month expires according to CACHE_EXPIRATION_HOURS.
    """
    __tablename__ = "monthly_games_cache"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), index=True, nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    archive_url = Column(String(255), index=True, nullable=False)
    data_json = Column(Text, nullable=False)  # JSON-serialized list of games
    is_completed_month = Column(Boolean, default=False, nullable=False)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("username", "year", "month", name="uq_user_year_month"),
    )


class PositionEvalCache(Base):
    """
    Cache for evaluated FEN positions to prevent recomputing common openings
    and transpositions.
    """
    __tablename__ = "position_eval_cache"

    id = Column(Integer, primary_key=True, index=True)
    fen = Column(String(128), index=True, nullable=False)
    depth = Column(Integer, nullable=False)
    score_cp = Column(Integer, nullable=True)  # in centipawns
    mate_in = Column(Integer, nullable=True)   # positive if white mates, negative if black mates
    best_move_uci = Column(String(10), nullable=True)
    pv_uci_json = Column(Text, nullable=True)  # JSON list of UCI moves
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("fen", "depth", name="uq_fen_depth"),
    )


class BlunderBankEntity(Base):
    """
    Persisted blunder positions extracted from actual user games.
    Uses deterministic ID: bb_{game_id}_m{move_number}_{turn}
    """
    __tablename__ = "blunder_bank"

    id = Column(String(128), primary_key=True, index=True)
    username = Column(String(100), index=True, nullable=False)
    game_url = Column(String(255), nullable=True)
    white = Column(String(100), nullable=True)
    black = Column(String(100), nullable=True)
    user_color = Column(String(10), nullable=False)
    eco = Column(String(10), nullable=True)
    opening_name = Column(String(255), nullable=True)
    time_control = Column(String(50), nullable=True)
    move_number = Column(Integer, nullable=False)
    turn = Column(String(10), nullable=False)
    fen_before = Column(String(128), nullable=False)
    user_move_uci = Column(String(10), nullable=False)
    user_move_san = Column(String(20), nullable=False)
    time_spent_seconds = Column(Float, default=0.0)
    clock_remaining_seconds = Column(Float, default=0.0)
    best_move_uci = Column(String(10), nullable=False)
    best_move_san = Column(String(20), nullable=False)
    eval_before = Column(Float, default=0.0)
    eval_after_user_move = Column(Float, default=0.0)
    cpl = Column(Float, default=0.0)
    pv_uci_json = Column(Text, nullable=True)
    pv_san_json = Column(Text, nullable=True)
    phase = Column(String(20), index=True, nullable=False)
    theme = Column(String(50), index=True, nullable=False)
    psychological_tag = Column(String(30), index=True, nullable=False)
    hints_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserPuzzleProgressEntity(Base):
    """
    Tracks Spaced Repetition (SRS) state and mastery for a user on a specific puzzle.
    """
    __tablename__ = "user_puzzle_progress"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), index=True, nullable=False)
    puzzle_id = Column(String(128), ForeignKey("blunder_bank.id", ondelete="CASCADE"), index=True, nullable=False)
    attempts_count = Column(Integer, default=0, nullable=False)
    consecutive_correct = Column(Integer, default=0, nullable=False)
    is_mastered = Column(Boolean, default=False, nullable=False)
    next_review_at = Column(DateTime, nullable=True)
    last_attempt_at = Column(DateTime, nullable=True)
    last_solved = Column(Boolean, default=False, nullable=False)
    last_hints_used = Column(Integer, default=0, nullable=False)
    repeated_old_blunder_count = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("username", "puzzle_id", name="uq_user_puzzle_progress"),
    )


class UserPuzzleAttemptEntity(Base):
    """
    Audit log of each individual attempt made by a user.
    """
    __tablename__ = "user_puzzle_attempts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), index=True, nullable=False)
    puzzle_id = Column(String(128), index=True, nullable=False)
    played_uci = Column(String(10), nullable=False)
    is_solved = Column(Boolean, nullable=False)
    repeated_old_blunder = Column(Boolean, default=False, nullable=False)
    hints_used = Column(Integer, default=0, nullable=False)
    time_spent_seconds = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


