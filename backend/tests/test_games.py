"""Resumen por partida, conversión de ventaja, uso del reloj y cómo terminó la partida."""
import json

from backend.app.models.chesscom import NormalizedGame
from backend.app.models.engine import EvaluatedMove
from backend.app.modules.chesscom.parser import parse_termination
from backend.app.modules.heuristics.aggregator import assemble_diagnosis_and_puzzles
from backend.app.modules.heuristics.clock import analyze_clock_usage
from backend.app.modules.heuristics.games import build_game_recap, build_game_stats
from backend.app.modules.tutor.llm_service import llm_payload

FEN = "8/8/8/8/8/8/8/8 w - - 0 1"


def game(result="win", termination="checkmate", color="white", tc="600", user_elo=1500, opp_elo=1500, gid="g1"):
    white = color == "white"
    return NormalizedGame(
        id=gid, url=f"https://www.chess.com/game/live/{gid}",
        white_username="yo" if white else "opp_zq", white_rating=user_elo if white else opp_elo, white_result="",
        black_username="opp_zq" if white else "yo", black_rating=opp_elo if white else user_elo, black_result="",
        user_color=color, user_result=result, time_control=tc, time_class="rapid",
        end_time=1700000000, moves_count=0, termination=termination,
    )


def move(n, before, after, spent=5.0, remaining=500.0, classification="good", phase="middlegame", turn="white"):
    return EvaluatedMove(
        ply=2 * n - 1 if turn == "white" else 2 * n, move_number=n, turn=turn,
        user_move_uci="a1a2", user_move_san="Ra2", fen_before=FEN, fen_after=FEN,
        time_spent_seconds=spent, clock_remaining_seconds=remaining,
        eval_before_cp=before, eval_after_cp=after, cpl=max(0.0, before - after),
        classification=classification, best_move_uci=None, best_move_san=None, pv_uci=[], pv_san=[], phase=phase,
    )


def test_parse_termination():
    cases = {
        "rival won on time": "timeout",
        "yo won by checkmate": "checkmate",
        "rival won by resignation": "resignation",
        "yo won - game abandoned": "abandoned",
        "Game drawn by agreement": "agreement",
        "Game drawn by repetition": "repetition",
        "Game drawn by stalemate": "stalemate",
        "Game drawn by insufficient material": "insufficient",
        "Game drawn by timeout vs insufficient material": "timeout_vs_insufficient",
        "Game drawn by 50-move rule": "fifty_moves",
        "": "other",
    }
    for text, code in cases.items():
        assert parse_termination(text) == code, text


def test_thrown_advantage_records_the_move_and_its_puzzle():
    g = game(result="loss")
    moves = [
        move(10, 50, 320),    # el rival falla: +3.2
        move(11, 350, 340),
        move(12, 340, 40, classification="blunder"),  # se escapa aquí
        move(13, -200, -400),
    ]
    r = build_game_recap(g, moves, {"bb_g1_m12_white"})
    assert r.advantage == "thrown"
    assert r.advantage_lost_move == 12
    assert r.advantage_lost_puzzle_id == "bb_g1_m12_white"
    assert r.disadvantage is None  # -2 antes de su última jugada; -4 solo después
    assert r.max_eval == 3.5 and r.min_eval == -4.0
    assert r.opponent_accuracy is not None and r.user_accuracy is not None


def test_converted_and_comeback():
    g = game(result="win", color="black")
    moves = [
        move(5, -350, -330, turn="black"),
        move(6, -100, -90, turn="black"),
        move(7, 400, 420, turn="black"),
    ]
    r = build_game_recap(g, moves, set())
    assert r.advantage == "converted" and r.advantage_lost_move is None
    assert r.disadvantage == "saved_win"
    assert r.user_rating == 1500 and r.opponent_username == "opp_zq"


def test_opponent_accuracy_comes_from_the_gap_between_my_moves():
    # Tras mi jugada quedo en 0; el rival mueve y quedo en +500: su jugada fue un blunder.
    moves = [move(1, 0, 0), move(2, 500, 500)]
    r = build_game_recap(game(), moves, set())
    assert r.user_accuracy == 100.0
    assert r.opponent_accuracy < 20


def test_game_stats():
    recaps = [
        build_game_recap(game(result="win", opp_elo=1600, gid="a"), [move(1, 0, 0), move(2, 400, 400)], set()),
        build_game_recap(game(result="loss", opp_elo=1400, gid="b"), [move(1, 400, 0), move(2, 0, -50)], set()),
        build_game_recap(game(result="draw", opp_elo=1520, gid="c"), [move(1, -400, -400), move(2, -10, 0)], set()),
    ]
    s = build_game_stats(recaps)
    assert (s.advantage.games_with_advantage, s.advantage.converted, s.advantage.thrown) == (2, 1, 1)
    assert (s.advantage.games_with_disadvantage, s.advantage.saved_draw) == (1, 1)
    assert s.by_rating_gap["stronger"].games == 1 and s.by_rating_gap["stronger"].win_rate == 1.0
    assert s.by_rating_gap["weaker"].losses == 1
    assert s.by_rating_gap["similar"].draws == 1
    assert s.vs_opponent.games_compared == 3


def test_clock_usage():
    g1 = game(result="loss", termination="timeout", tc="600")
    m1 = [
        move(5, 0, 0, spent=2, remaining=550, phase="opening"),                          # >50 %
        move(9, 0, 0, spent=1, remaining=400, classification="good"),                    # rápida
        move(10, 0, -300, spent=30, remaining=200, classification="blunder"),            # 25-50 %, pensada
        move(11, 0, -300, spent=10, remaining=100, classification="error", phase="endgame"),  # 10-25 % antes de mover
        move(12, 0, 0, spent=2, remaining=30, phase="endgame"),                          # <10 %, rápida
    ]
    daily = game(tc="1/86400", gid="d")
    out = analyze_clock_usage([g1, daily], [m1, [move(1, 0, 0)]])
    buckets = {b.bucket: (b.moves, b.serious_errors) for b in out["error_rate_by_clock"]}
    assert buckets == {"gt50": (2, 0), "25_50": (1, 1), "10_25": (1, 1), "lt10": (1, 0)}
    e = out["time_endings"]
    assert (e.games_with_clock, e.games_low_clock, e.lost_on_time, e.won_on_time) == (1, 1, 1, 0)
    assert out["time_by_phase"].opening == round(2 / 600 * 100, 1)
    f = out["fast_vs_thought"]
    assert (f.fast.moves, f.thought.moves) == (2, 1)
    assert f.fast.accuracy == 100.0 and f.thought.accuracy < 50
    assert (f.fast_threshold_seconds, f.thought_threshold_seconds) == (3.0, 18.0)


def test_summary_has_games_but_llm_payload_does_not():
    g = game(result="win")
    summary, _ = assemble_diagnosis_and_puzzles("yo", "rapid", [g], [[move(1, 0, 0), move(2, 400, 400)]])
    assert summary.games and summary.games[0].opponent_username == "opp_zq"
    assert summary.game_stats.advantage.converted == 1
    payload = json.loads(llm_payload(summary))
    assert "games" not in payload and "opp_zq" not in json.dumps(payload)
    assert payload["game_stats"]["advantage"]["converted"] == 1
