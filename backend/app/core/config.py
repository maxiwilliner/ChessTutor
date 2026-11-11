from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from pathlib import Path
import shutil


class Settings(BaseSettings):
    PROJECT_NAME: str = "Chess Tutor API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Golden Rule: Must specify contact and app name in User-Agent for Chess.com
    CHESSCOM_USER_AGENT: str = "ChessTutor/1.0 (contact@chesstutor.local)"

    # Database
    DATABASE_PATH: Path = Path(__file__).resolve().parent.parent.parent / "chess_tutor.db"
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DATABASE_PATH}"

    # Default limits and cache TTL
    DEFAULT_GAMES_LIMIT: int = 30
    CACHE_EXPIRATION_HOURS: int = 24

    # Stockfish Settings
    STOCKFISH_PATH: Path = Path(__file__).resolve().parent.parent.parent / "bin" / "stockfish"
    STOCKFISH_CONCURRENCY: int = 2
    STOCKFISH_DEPTH_FAST: int = 11
    STOCKFISH_DEPTH_DEEP: int = 15
    STOCKFISH_TIME_LIMIT_FAST: float = 0.04
    STOCKFISH_TIME_LIMIT_DEEP: float = 0.20

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @model_validator(mode="after")
    def resolve_stockfish(self) -> "Settings":
        if not self.STOCKFISH_PATH.exists():
            sys_path = shutil.which("stockfish")
            if sys_path:
                self.STOCKFISH_PATH = Path(sys_path)
        return self


settings = Settings()


