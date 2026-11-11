from collections import defaultdict
from typing import List, Dict, Any
from backend.app.models.chesscom import NormalizedGame, OpeningStatItem


def analyze_openings(games: List[NormalizedGame]) -> List[OpeningStatItem]:
    """
    Groups games by ECO code, opening name, and player color.
    Calculates win rate, draw rate, loss rate, and average game length.
    """
    stats_map: Dict[tuple, Dict[str, Any]] = defaultdict(lambda: {
        "games_played": 0,
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "total_moves": 0,
        "opening_name": "Unknown Opening"
    })

    for game in games:
        key = (game.eco, game.user_color)
        entry = stats_map[key]
        entry["games_played"] += 1
        entry["total_moves"] += game.moves_count
        if game.opening_name and game.opening_name != "Unknown Opening":
            entry["opening_name"] = game.opening_name

        if game.user_result == "win":
            entry["wins"] += 1
        elif game.user_result == "draw":
            entry["draws"] += 1
        else:
            entry["losses"] += 1

    results: List[OpeningStatItem] = []
    for (eco, color), data in stats_map.items():
        played = data["games_played"]
        win_rate = round(data["wins"] / played, 3) if played > 0 else 0.0
        avg_moves = round(data["total_moves"] / played, 1) if played > 0 else 0.0

        results.append(
            OpeningStatItem(
                eco=eco,
                opening_name=data["opening_name"],
                color=color,
                games_played=played,
                wins=data["wins"],
                draws=data["draws"],
                losses=data["losses"],
                win_rate=win_rate,
                avg_game_length_moves=avg_moves
            )
        )

    # Sort descending by number of games played, then ascending by win_rate (most played with issues first)
    results.sort(key=lambda x: (x.games_played, -x.win_rate), reverse=True)
    return results

