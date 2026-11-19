"""
Exporta fixtures de equivalencia Python -> TypeScript para el motor de análisis del navegador.

Toma partidas reales ya cacheadas en la DB de desarrollo, anonimiza los nombres y vuelca, para cada etapa:
  PGN crudo -> NormalizedGame (parser) -> EvaluatedMove[] (evaluador, desde la caché de posiciones)
  -> PlayerDiagnosisSummary + BlunderBankItem[] (agregador) -> informe del tutor por reglas.

Los tests de `frontend/src/analysis` comparan su salida con estos datos.

Uso (desde la raíz del repo):
    PYTHONPATH=. backend/.venv/bin/python backend/scripts/export_analysis_fixtures.py macsimo1312 rapid 6
"""
import asyncio
import json
import re
import sys
from pathlib import Path

from backend.app.core.database import AsyncSessionLocal, init_db
from backend.app.modules.chesscom.client import ChessComClient
from backend.app.modules.chesscom.parser import parse_game_pgn
from backend.app.modules.engine import evaluator
from backend.app.modules.engine.evaluator import evaluate_game_smart
from backend.app.modules.engine.stockfish_pool import stockfish_pool
from backend.app.modules.heuristics.aggregator import assemble_diagnosis_and_puzzles
from backend.app.modules.tutor.llm_service import generate_deterministic_tutor_report

OUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "analysis" / "__fixtures__" / "pipeline.json"
PLAYER = "demo_player"


def anonymize(pgn: str, username: str, index: int, opponents: dict) -> str:
    def swap(match: re.Match) -> str:
        tag, name = match.group(1), match.group(2)
        if name.lower() == username.lower():
            return f'[{tag} "{PLAYER}"]'
        alias = opponents.setdefault(name.lower(), f"rival_{len(opponents) + 1}")
        return f'[{tag} "{alias}"]'

    pgn = re.sub(r'\[(White|Black) "([^"]+)"\]', swap, pgn)
    fake_url = f"https://www.chess.com/game/live/{1000000 + index}"
    pgn = re.sub(r'\[Link "[^"]*"\]', f'[Link "{fake_url}"]', pgn)
    pgn = re.sub(r'\[Site "[^"]*"\]', '[Site "Chess.com"]', pgn)
    # Termination names the winner ("x won on time"): keep the wording, swap the names for the aliases
    def swap_termination(match: re.Match) -> str:
        text = match.group(1)
        names = [(username, PLAYER)] + [(real, alias) for real, alias in opponents.items()]
        for real, alias in sorted(names, key=lambda n: -len(n[0])):
            text = re.sub(re.escape(real), alias, text, flags=re.IGNORECASE)
        return f'[Termination "{text}"]'

    pgn = re.sub(r'\[Termination "([^"]*)"\]', swap_termination, pgn)
    return pgn


async def main(username: str, time_class: str, limit: int) -> None:
    await init_db()

    # Record every position evaluation the evaluator receives, keyed by requested depth,
    # so the TS evaluator can be replayed with a fake engine and compared move by move.
    positions: dict = {}
    real_evaluate_many = evaluator.evaluate_many

    async def recording_evaluate_many(fens, depth, time_limit, db_session=None):
        out = await real_evaluate_many(fens, depth, time_limit, db_session)
        for ev in out:
            positions[f"{depth}|{ev.fen}"] = ev.model_dump(mode="json")
        return out

    evaluator.evaluate_many = recording_evaluate_many
    client = ChessComClient()
    opponents: dict = {}
    raw_games = []

    async with AsyncSessionLocal() as session:
        archives = list(reversed(await client.get_monthly_archives(username)))
        for url in archives:
            for raw in reversed(await client.get_monthly_games(username, url, session)):
                if raw.get("time_class") == time_class and raw.get("pgn") and raw.get("rules") == "chess":
                    raw_games.append(raw)
                if len(raw_games) >= limit:
                    break
            if len(raw_games) >= limit:
                break

        games, fixtures_games, evaluated = [], [], []
        for i, raw in enumerate(raw_games):
            pgn = anonymize(raw["pgn"], username, i, opponents)
            game = parse_game_pgn(pgn, PLAYER)
            game.end_time = raw.get("end_time", 0)
            moves = await evaluate_game_smart(game, session)
            games.append(game)
            evaluated.append(moves)
            fixtures_games.append({
                "pgn": pgn,
                "end_time": game.end_time,
                "time_class": raw.get("time_class"),
                "normalized": game.model_dump(mode="json"),
            })

    summary, puzzles = assemble_diagnosis_and_puzzles(PLAYER, time_class, games, evaluated)
    report = generate_deterministic_tutor_report(summary)
    await stockfish_pool.close()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "username": PLAYER,
        "time_class": time_class,
        "games": fixtures_games,
        "positions": positions,
        "evaluated": [[m.model_dump(mode="json") for m in moves] for moves in evaluated],
        "summary": summary.model_dump(mode="json"),
        "puzzles": [p.model_dump(mode="json") for p in puzzles],
        "report": report.model_dump(mode="json"),
    }, ensure_ascii=False, indent=1))
    print(f"{len(games)} partidas, {sum(len(m) for m in evaluated)} jugadas, {len(puzzles)} ejercicios -> {OUT}")


if __name__ == "__main__":
    user, tc, n = (sys.argv[1:] + ["macsimo1312", "rapid", "6"][len(sys.argv) - 1:])[:3]
    asyncio.run(main(user, tc, int(n)))
