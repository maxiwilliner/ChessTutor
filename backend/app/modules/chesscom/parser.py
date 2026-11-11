import io
import re
from typing import Optional, Tuple, List
import chess
import chess.pgn
from backend.app.models.chesscom import NormalizedGame, MoveWithClock


CLK_PATTERN = re.compile(r"\[%clk\s+([0-9]+:)?([0-9]+):([0-9]+(?:\.[0-9]+)?)\]")


def parse_clock_string(clock_str: str) -> Optional[float]:
    """
    Parses strings like '0:09:58', '1:29:45.3', '9:58.2' into total seconds.
    """
    try:
        parts = clock_str.strip().split(":")
        if len(parts) == 3:
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])
            return hours * 3600.0 + minutes * 60.0 + seconds
        elif len(parts) == 2:
            minutes = float(parts[0])
            seconds = float(parts[1])
            return minutes * 60.0 + seconds
        elif len(parts) == 1:
            return float(parts[0])
    except (ValueError, IndexError):
        return None
    return None


def extract_clock_from_comment(comment: str) -> Optional[float]:
    """
    Extracts the remaining clock in seconds from a PGN comment like '{[%clk 0:09:58.2]}'.
    """
    if not comment:
        return None
    match = CLK_PATTERN.search(comment)
    if match:
        full_clock_str = match.group(0).replace("[%clk", "").replace("]", "").strip()
        return parse_clock_string(full_clock_str)
    return None


def parse_time_control(time_control_str: str) -> Tuple[float, float]:
    """
    Extracts base seconds and increment from headers like '600', '180+2', '900+10'.
    Returns (base_seconds, increment_seconds).
    If unknown/daily (e.g. '1/86400'), returns (0.0, 0.0).
    """
    if not time_control_str or "/" in time_control_str:
        return (0.0, 0.0)
    try:
        if "+" in time_control_str:
            base_s, inc_s = time_control_str.split("+", 1)
            return (float(base_s), float(inc_s))
        else:
            return (float(time_control_str), 0.0)
    except ValueError:
        return (0.0, 0.0)


def format_opening_from_url(eco_url: Optional[str]) -> str:
    """
    Converts 'https://www.chess.com/openings/Scandinavian-Defense-Mieses-Kotroc-Variation'
    into 'Scandinavian Defense: Mieses Kotroc Variation'.
    """
    if not eco_url:
        return ""
    slug = eco_url.rstrip("/").split("/")[-1]
    name = slug.replace("-", " ")
    return name


def parse_game_pgn(pgn_text: str, target_username: str) -> Optional[NormalizedGame]:
    """
    Parses a single PGN string from Chess.com into a NormalizedGame model,
    including board positions (FEN) and clock deltas per move.
    """
    pgn_io = io.StringIO(pgn_text)
    game = chess.pgn.read_game(pgn_io)
    if not game:
        return None

    headers = game.headers
    white_user = headers.get("White", "Unknown")
    black_user = headers.get("Black", "Unknown")

    is_user_white = white_user.lower() == target_username.lower()
    is_user_black = black_user.lower() == target_username.lower()

    if not is_user_white and not is_user_black:
        # User not participant in this game
        return None

    user_color = "white" if is_user_white else "black"
    result_str = headers.get("Result", "*")

    if result_str == "1-0":
        user_result = "win" if is_user_white else "loss"
    elif result_str == "0-1":
        user_result = "loss" if is_user_white else "win"
    elif result_str == "1/2-1/2":
        user_result = "draw"
    else:
        user_result = "draw"

    time_control = headers.get("TimeControl", "")
    base_time, increment = parse_time_control(time_control)

    white_rating = 0
    black_rating = 0
    try:
        white_rating = int(headers.get("WhiteElo", "0"))
    except ValueError:
        pass
    try:
        black_rating = int(headers.get("BlackElo", "0"))
    except ValueError:
        pass

    eco = headers.get("ECO", "Unknown")
    eco_url = headers.get("ECOUrl", "")
    opening_name = format_opening_from_url(eco_url) or headers.get("Opening", "Unknown Opening")

    # Time tracking initialization
    prev_clocks = {
        "white": base_time if base_time > 0 else 600.0,
        "black": base_time if base_time > 0 else 600.0
    }

    board = game.board()
    moves_list: List[MoveWithClock] = []
    ply = 0

    for node in game.mainline():
        ply += 1
        turn_str = "white" if board.turn == chess.WHITE else "black"
        move_number = (ply + 1) // 2

        fen_before = board.fen()
        move = node.move
        san = board.san(move)
        uci = move.uci()

        # Update board
        board.push(move)
        fen_after = board.fen()

        # Extract clock
        remaining_clock = extract_clock_from_comment(node.comment)
        if remaining_clock is None:
            # Fallback if no [%clk] tag is present
            remaining_clock = prev_clocks[turn_str]
            time_spent = 0.0
        else:
            time_spent = prev_clocks[turn_str] - remaining_clock + increment
            if time_spent < 0.0:
                # Lag compensation or small synchronization drift
                time_spent = 0.0
            prev_clocks[turn_str] = remaining_clock

        moves_list.append(
            MoveWithClock(
                ply=ply,
                move_number=move_number,
                turn=turn_str,
                san=san,
                uci=uci,
                fen_before=fen_before,
                fen_after=fen_after,
                clock_remaining_seconds=round(remaining_clock, 2),
                time_spent_seconds=round(time_spent, 2)
            )
        )

    end_time_int = 0
    try:
        end_time_int = int(headers.get("EndTime", headers.get("UTCDate", "0").replace(".", "")))
    except ValueError:
        pass

    game_id = headers.get("Link", headers.get("Site", "")).rstrip("/").split("/")[-1]
    if not game_id or game_id == "chess.com":
        game_id = f"game_{end_time_int}_{white_user}_{black_user}"

    return NormalizedGame(
        id=game_id,
        url=headers.get("Link", f"https://www.chess.com/game/live/{game_id}"),
        white_username=white_user,
        white_rating=white_rating,
        white_result=headers.get("WhiteResult", result_str),
        black_username=black_user,
        black_rating=black_rating,
        black_result=headers.get("BlackResult", result_str),
        user_color=user_color,
        user_result=user_result,
        time_control=time_control,
        time_class=headers.get("TimeClass", "rapid"),
        eco=eco,
        opening_name=opening_name,
        end_time=end_time_int,
        moves_count=len(moves_list),
        moves=moves_list
    )

