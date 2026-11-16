"""Validated request parameters shared by the endpoints."""
from typing import Annotated

from fastapi import Path, Query

# Chess.com usernames: 3-25 letters, digits, "_" or "-". Validating them also prevents
# path injection into the api.chess.com URLs built from the username.
USERNAME_PATTERN = r"^[A-Za-z0-9_-]{3,25}$"

UsernamePath = Annotated[str, Path(pattern=USERNAME_PATTERN, description="Chess.com username")]
UsernameQuery = Annotated[str, Query(pattern=USERNAME_PATTERN, description="Chess.com username")]
