import uuid
import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from backend.app.main import app
from backend.app.core.database import AsyncSessionLocal, init_db
from backend.app.db.models import (
    BlunderBankEntity,
    UserPuzzleProgressEntity,
    UserPuzzleAttemptEntity
)
from backend.app.db.puzzle_service import (
    save_puzzles_idempotent,
    get_user_puzzles,
    record_puzzle_attempt,
    get_user_trainer_stats
)
from backend.app.models.puzzles import (
    BlunderBankItem,
    BlunderGameMetadata,
    BlunderUserMove,
    BlunderEngineSolution,
    BlunderClassification,
    TutorHints,
    PuzzleAttemptRequest
)
from backend.app.models.engine import PositionEvaluation


def sample_puzzle(
    puzzle_id: str = "bb_testgame_m15_white",
    username: str = "carlsen",
    theme: str = "hanging_piece",
    best_move_uci: str = "d1d8",
    best_move_san: str = "Qd8#",
    user_move_uci: str = "c1g5",
    user_move_san: str = "Bg5??"
) -> BlunderBankItem:
    return BlunderBankItem(
        id=puzzle_id,
        game_url="https://chess.com/game/live/123",
        metadata=BlunderGameMetadata(
            white=username,
            black="opponent",
            user_color="white",
            eco="B01",
            opening_name="Scandinavian Defense",
            time_control="600"
        ),
        move_number=15,
        turn="white",
        fen_before="r1bqk2r/pp1nbppp/2p1pn2/8/2B5/2NP1N2/PPP2PPP/R1BQR1K1 w kq - 3 10",
        user_move=BlunderUserMove(
            uci=user_move_uci,
            san=user_move_san,
            time_spent_seconds=2.1,
            clock_remaining_seconds=350.0
        ),
        engine_solution=BlunderEngineSolution(
            best_move_uci=best_move_uci,
            best_move_san=best_move_san,
            eval_before=2.5,
            eval_after_user_move=-1.2,
            cpl=270.0,
            pv_uci=[best_move_uci, "e8e7", "e1e6"],
            pv_san=[best_move_san, "Ke7", "Rxe6+"]
        ),
        classification=BlunderClassification(
            phase="middlegame",
            theme=theme,
            psychological_tag="impulsive"
        ),
        tutor_hints=TutorHints(
            level_1_conceptual="¿Qué pieza rival está desprotegida?",
            level_2_directional="Mira hacia la octava fila.",
            level_3_concrete="Juega Qd8# aprovechando la falta de defensa."
        )
    )


@pytest.mark.asyncio
async def test_idempotent_puzzle_save_and_retrieval():
    await init_db()
    uid = uuid.uuid4().hex[:8]
    user = f"user_{uid}"

    p1 = sample_puzzle(puzzle_id=f"bb_g1_{uid}_m10", username=user, theme="hanging_piece")
    p2 = sample_puzzle(puzzle_id=f"bb_g1_{uid}_m20", username=user, theme="pin_exploitation")

    async with AsyncSessionLocal() as session:
        # 1. First insert
        count1 = await save_puzzles_idempotent(session, user, [p1, p2])
        assert count1 == 2

        # 2. Re-analysis / duplicate insert -> 0 inserted, no errors
        count2 = await save_puzzles_idempotent(session, user, [p1, p2])
        assert count2 == 0

        # 3. Retrieve all
        puzzles = await get_user_puzzles(session, user)
        ids = [p.id for p in puzzles]
        assert p1.id in ids
        assert p2.id in ids

        # 4. Filter by theme
        hp_puzzles = await get_user_puzzles(session, user, theme="hanging_piece")
        assert len(hp_puzzles) == 1
        assert hp_puzzles[0].classification.theme == "hanging_piece"


@pytest.mark.asyncio
async def test_spaced_repetition_workflow():
    await init_db()
    uid = uuid.uuid4().hex[:8]
    test_user = f"srs_{uid}"
    p = sample_puzzle(puzzle_id=f"bb_srs_{uid}_m12", username=test_user)

    async with AsyncSessionLocal() as session:
        await save_puzzles_idempotent(session, test_user, [p])

        # Attempt 1: Correct without hints -> consecutive_correct=1, mastered=False, next review in ~1 day
        att1 = PuzzleAttemptRequest(
            username=test_user,
            puzzle_id=p.id,
            played_uci=p.engine_solution.best_move_uci,
            is_solved=True,
            repeated_old_blunder=False,
            hints_used=0,
            time_spent_seconds=5.0
        )
        res1 = await record_puzzle_attempt(session, att1)
        assert res1.is_solved is True
        assert res1.consecutive_correct == 1
        assert res1.is_mastered is False
        assert res1.next_review_at is not None

        # Attempt 2: Correct without hints -> consecutive_correct=2, next review in ~3 days
        att2 = PuzzleAttemptRequest(
            username=test_user,
            puzzle_id=p.id,
            played_uci=p.engine_solution.best_move_uci,
            is_solved=True,
            repeated_old_blunder=False,
            hints_used=0,
            time_spent_seconds=4.0
        )
        res2 = await record_puzzle_attempt(session, att2)
        assert res2.consecutive_correct == 2
        assert res2.is_mastered is False

        # Attempt 3: Correct without hints -> consecutive_correct=3, mastered=True, next review in ~7 days
        att3 = PuzzleAttemptRequest(
            username=test_user,
            puzzle_id=p.id,
            played_uci=p.engine_solution.best_move_uci,
            is_solved=True,
            repeated_old_blunder=False,
            hints_used=0,
            time_spent_seconds=3.0
        )
        res3 = await record_puzzle_attempt(session, att3)
        assert res3.consecutive_correct == 3
        assert res3.is_mastered is True

        # Check retrieval with status='mastered'
        mastered = await get_user_puzzles(session, test_user, status="mastered")
        assert any(item.id == p.id for item in mastered)

        # Attempt 4: Player repeats their old blunder! -> consecutive_correct resets to 0, mastered=False
        att4 = PuzzleAttemptRequest(
            username=test_user,
            puzzle_id=p.id,
            played_uci=p.user_move.uci,
            is_solved=False,
            repeated_old_blunder=True,
            hints_used=0,
            time_spent_seconds=1.5
        )
        res4 = await record_puzzle_attempt(session, att4)
        assert res4.is_solved is False
        assert res4.consecutive_correct == 0
        assert res4.is_mastered is False


@pytest.mark.asyncio
async def test_trainer_stats_endpoint():
    await init_db()
    uid = uuid.uuid4().hex[:8]
    test_user = f"stats_{uid}"
    p1 = sample_puzzle(puzzle_id=f"bb_st1_{uid}", username=test_user, theme="fork_overlooked")
    p2 = sample_puzzle(puzzle_id=f"bb_st2_{uid}", username=test_user, theme="fork_overlooked")

    async with AsyncSessionLocal() as session:
        await save_puzzles_idempotent(session, test_user, [p1, p2])

        # Record a solved attempt on p1
        await record_puzzle_attempt(session, PuzzleAttemptRequest(
            username=test_user,
            puzzle_id=p1.id,
            played_uci=p1.engine_solution.best_move_uci,
            is_solved=True,
            repeated_old_blunder=False,
            hints_used=0,
            time_spent_seconds=6.0
        ))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(f"/api/v1/trainer/stats/{test_user}")

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == test_user
    assert data["total_puzzles"] == 2
    assert data["solved_puzzles"] == 1
    assert data["top_leak_theme"] == "fork_overlooked"
    assert "fork_overlooked" in data["themes_breakdown"]


@pytest.mark.asyncio
async def test_evaluate_move_endpoint_logic():
    await init_db()
    uid = uuid.uuid4().hex[:8]
    test_user = f"eval_{uid}"
    p = sample_puzzle(
        puzzle_id=f"bb_eval_{uid}",
        username=test_user,
        best_move_uci="c4e6",
        best_move_san="Bxe6",
        user_move_uci="c1g5",
        user_move_san="Bg5"
    )

    async with AsyncSessionLocal() as session:
        await save_puzzles_idempotent(session, test_user, [p])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Case 1: Best Move
        res_best = await ac.post("/api/v1/trainer/evaluate-move", json={
            "puzzle_id": p.id,
            "played_uci": "c4e6"
        })
        assert res_best.status_code == 200
        data_best = res_best.json()
        assert data_best["is_valid"] is True
        assert data_best["is_best"] is True

        # Case 2: Historical Blunder
        res_blunder = await ac.post("/api/v1/trainer/evaluate-move", json={
            "puzzle_id": p.id,
            "played_uci": "c1g5"
        })
        assert res_blunder.status_code == 200
        data_blunder = res_blunder.json()
        assert data_blunder["is_valid"] is False
        assert data_blunder["is_historical_blunder"] is True
        assert "cuidado" in data_blunder["message"].lower()

        # Case 3: Alternative move with CPL <= 35 or winning advantage
        mock_eval = PositionEvaluation(
            fen="test_fen",
            depth=10,
            score_cp=240,
            best_move_uci="e8e7",
            best_move_san="Ke7",
            pv_uci=["e8e7"],
            pv_san=["Ke7"]
        )

        with patch("backend.app.api.v1.endpoints.trainer.stockfish_pool.evaluate_position", new_callable=AsyncMock) as mock_sf:
            mock_sf.return_value = mock_eval
            res_alt = await ac.post("/api/v1/trainer/evaluate-move", json={
                "puzzle_id": p.id,
                "played_uci": "d3d4"  # legal move
            })
            assert res_alt.status_code == 200
            data_alt = res_alt.json()
            assert data_alt["is_valid"] is True
            assert data_alt["is_best"] is False
            assert "también gana" in data_alt["message"].lower() or "buena jugada" in data_alt["message"].lower()


@pytest.mark.asyncio
async def test_get_puzzles_endpoint_with_filters():
    await init_db()
    uid = uuid.uuid4().hex[:8]
    test_user = f"filter_{uid}"
    p1 = sample_puzzle(puzzle_id=f"bb_f1_{uid}", username=test_user, theme="missed_mate")
    p2 = sample_puzzle(puzzle_id=f"bb_f2_{uid}", username=test_user, theme="king_safety_collapse")

    async with AsyncSessionLocal() as session:
        await save_puzzles_idempotent(session, test_user, [p1, p2])

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Filter by theme
        res = await ac.get(f"/api/v1/analysis/puzzles/{test_user}?theme=missed_mate")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["classification"]["theme"] == "missed_mate"

        # Filter by top leak
        res_leak = await ac.get(f"/api/v1/analysis/puzzles/{test_user}?top_leak_only=true")
        assert res_leak.status_code == 200
        leak_items = res_leak.json()
        assert len(leak_items) >= 1

