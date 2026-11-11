from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, UniqueConstraint
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

