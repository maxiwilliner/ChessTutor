import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Iterable, List, Optional
from sqlalchemy import select, func, and_, or_, delete, exists, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

from backend.app.modules.engine.notation import uci_line_to_san


# Catch-all motif: never the "top leak", it says nothing about what to train.
GENERIC_THEME = "tactical_inaccuracy"


def utc_now_naive() -> datetime:
    """Returns naive UTC datetime matching SQLite timestamp storage."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

from backend.app.db.models import (
    BlunderBankEntity,
    UserPuzzleProgressEntity,
    UserPuzzleAttemptEntity
)
from backend.app.models.puzzles import (
    BlunderBankItem,
    BlunderGameMetadata,
    BlunderUserMove,
    BlunderEngineSolution,
    BlunderClassification,
    TutorHints,
    PuzzleAttemptRequest,
    PuzzleAttemptResponse,
    TrainerStatsResponse,
    TrainerThemeStats
)


async def save_puzzles_idempotent(
    session: AsyncSession,
    username: str,
    puzzles: List[BlunderBankItem],
    analyzed_game_ids: Optional[Iterable[str]] = None,
) -> int:
    """
    Persists puzzles with an upsert keyed on the deterministic id.
    Re-analysing refreshes the content (engine line, theme, hints...) while the user's SRS
    progress, stored in `user_puzzle_progress`, is untouched.
    If `analyzed_game_ids` is given, puzzles from those games that no longer qualify
    (e.g. after a classification change) are deleted, unless the user already practised them.
    Returns the number of puzzles written.
    """
    clean_username = username.strip().lower()

    for item in puzzles:
        values = dict(
            username=clean_username,
            game_url=item.game_url,
            white=item.metadata.white,
            black=item.metadata.black,
            user_color=item.metadata.user_color,
            eco=item.metadata.eco,
            opening_name=item.metadata.opening_name,
            time_control=item.metadata.time_control,
            move_number=item.move_number,
            turn=item.turn,
            fen_before=item.fen_before,
            user_move_uci=item.user_move.uci,
            user_move_san=item.user_move.san,
            time_spent_seconds=item.user_move.time_spent_seconds,
            clock_remaining_seconds=item.user_move.clock_remaining_seconds,
            best_move_uci=item.engine_solution.best_move_uci,
            best_move_san=item.engine_solution.best_move_san,
            eval_before=item.engine_solution.eval_before,
            eval_after_user_move=item.engine_solution.eval_after_user_move,
            cpl=item.engine_solution.cpl,
            pv_uci_json=json.dumps(item.engine_solution.pv_uci),
            pv_san_json=json.dumps(item.engine_solution.pv_san),
            refutation_uci_json=json.dumps(item.engine_solution.refutation_uci),
            refutation_san_json=json.dumps(item.engine_solution.refutation_san),
            phase=item.classification.phase,
            theme=item.classification.theme,
            psychological_tag=item.classification.psychological_tag,
            hints_json=json.dumps(item.tutor_hints.model_dump()),
        )
        stmt = sqlite_upsert(BlunderBankEntity).values(id=item.id, created_at=utc_now_naive(), **values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["id"],
            set_={key: stmt.excluded[key] for key in values if key != "username"},
        )
        await session.execute(stmt)

    if analyzed_game_ids:
        keep_ids = [p.id for p in puzzles]
        has_progress = exists().where(UserPuzzleProgressEntity.puzzle_id == BlunderBankEntity.id)
        for game_id in analyzed_game_ids:
            conditions = [
                BlunderBankEntity.username == clean_username,
                BlunderBankEntity.id.startswith(f"bb_{game_id}_m", autoescape=True),
                ~has_progress,
            ]
            if keep_ids:
                conditions.append(BlunderBankEntity.id.not_in(keep_ids))
            await session.execute(delete(BlunderBankEntity).where(*conditions))

    await session.commit()
    return len(puzzles)


async def get_user_puzzles(
    session: AsyncSession,
    username: str,
    theme: Optional[str] = None,
    top_leak_only: bool = False,
    status: str = "all",
    limit: int = 50,
    psych_tag: Optional[str] = None,
) -> List[BlunderBankItem]:
    """
    Retrieves puzzles for the specified user, enriched with user's SRS progress.
    Supports filtering by tactical theme, top leak, and mastery status.
    """
    clean_username = username.strip().lower()

    # Determine top leak if requested
    target_theme = theme
    if top_leak_only and not target_theme:
        top_theme_query = (
            select(BlunderBankEntity.theme, func.count(BlunderBankEntity.id).label("cnt"))
            .where(BlunderBankEntity.username == clean_username, BlunderBankEntity.theme != GENERIC_THEME)
            .group_by(BlunderBankEntity.theme)
            .order_by(func.count(BlunderBankEntity.id).desc())
            .limit(1)
        )
        top_theme_res = (await session.execute(top_theme_query)).first()
        if top_theme_res:
            target_theme = top_theme_res[0]

    # Query puzzles with left join on progress
    query = (
        select(BlunderBankEntity, UserPuzzleProgressEntity)
        .outerjoin(
            UserPuzzleProgressEntity,
            and_(
                UserPuzzleProgressEntity.puzzle_id == BlunderBankEntity.id,
                UserPuzzleProgressEntity.username == clean_username
            )
        )
        .where(BlunderBankEntity.username == clean_username)
    )

    if target_theme:
        query = query.where(BlunderBankEntity.theme == target_theme)
    if psych_tag:
        query = query.where(BlunderBankEntity.psychological_tag == psych_tag)

    now = utc_now_naive()
    if status == "unsolved":
        query = query.where(
            or_(
                UserPuzzleProgressEntity.id.is_(None),
                UserPuzzleProgressEntity.is_mastered == False
            )
        )
    elif status == "mastered":
        query = query.where(UserPuzzleProgressEntity.is_mastered == True)
    elif status == "review_due":
        query = query.where(
            and_(
                UserPuzzleProgressEntity.next_review_at.is_not(None),
                UserPuzzleProgressEntity.next_review_at <= now
            )
        )

    # Training order: reviews due -> never seen -> in progress -> mastered; worst mistakes first.
    priority = case(
        (and_(UserPuzzleProgressEntity.next_review_at.is_not(None), UserPuzzleProgressEntity.next_review_at <= now), 0),
        (UserPuzzleProgressEntity.id.is_(None), 1),
        (UserPuzzleProgressEntity.is_mastered == True, 3),  # noqa: E712
        else_=2,
    )
    query = query.order_by(priority, BlunderBankEntity.cpl.desc(), BlunderBankEntity.id).limit(limit)
    rows = (await session.execute(query)).all()

    items: List[BlunderBankItem] = []
    for entity, progress in rows:
        hints_dict = json.loads(entity.hints_json) if entity.hints_json else {}
        pv_uci = json.loads(entity.pv_uci_json) if entity.pv_uci_json else []
        pv_san = json.loads(entity.pv_san_json) if entity.pv_san_json else []
        best_san = entity.best_move_san
        if not pv_san or best_san == entity.best_move_uci:
            # Ejercicios guardados desde la caché antigua: notación UCI sin SAN.
            san, line = uci_line_to_san(entity.fen_before, pv_uci or [entity.best_move_uci])
            best_san, pv_san = san or best_san, line or pv_san

        hints = TutorHints(
            level_1_conceptual=hints_dict.get("level_1_conceptual", ""),
            level_2_directional=hints_dict.get("level_2_directional", ""),
            level_3_concrete=hints_dict.get("level_3_concrete", "")
        )

        item = BlunderBankItem(
            id=entity.id,
            game_url=entity.game_url or "",
            metadata=BlunderGameMetadata(
                white=entity.white or "White",
                black=entity.black or "Black",
                user_color=entity.user_color,  # type: ignore
                eco=entity.eco or "A00",
                opening_name=entity.opening_name or "Unknown",
                time_control=entity.time_control or "standard"
            ),
            move_number=entity.move_number,
            turn=entity.turn,  # type: ignore
            fen_before=entity.fen_before,
            user_move=BlunderUserMove(
                uci=entity.user_move_uci,
                san=entity.user_move_san,
                time_spent_seconds=entity.time_spent_seconds or 0.0,
                clock_remaining_seconds=entity.clock_remaining_seconds or 0.0
            ),
            engine_solution=BlunderEngineSolution(
                best_move_uci=entity.best_move_uci,
                best_move_san=best_san,
                eval_before=entity.eval_before or 0.0,
                eval_after_user_move=entity.eval_after_user_move or 0.0,
                cpl=entity.cpl or 0.0,
                pv_uci=pv_uci,
                pv_san=pv_san,
                refutation_uci=json.loads(entity.refutation_uci_json) if entity.refutation_uci_json else [],
                refutation_san=json.loads(entity.refutation_san_json) if entity.refutation_san_json else [],
            ),
            classification=BlunderClassification(
                phase=entity.phase,  # type: ignore
                theme=entity.theme,
                psychological_tag=entity.psychological_tag  # type: ignore
            ),
            tutor_hints=hints,
            is_mastered=progress.is_mastered if progress else False,
            consecutive_correct=progress.consecutive_correct if progress else 0,
            next_review_at=progress.next_review_at if progress else None,
            attempts_count=progress.attempts_count if progress else 0,
            repeated_blunder_count=progress.repeated_old_blunder_count if progress else 0
        )
        items.append(item)

    return items


async def record_puzzle_attempt(
    session: AsyncSession,
    req: PuzzleAttemptRequest
) -> PuzzleAttemptResponse:
    """
    Logs an attempt and updates the Spaced Repetition (SRS) state for the user/puzzle.
    """
    clean_username = req.username.strip().lower()
    now = utc_now_naive()

    # 1. Log attempt
    attempt = UserPuzzleAttemptEntity(
        username=clean_username,
        puzzle_id=req.puzzle_id,
        played_uci=req.played_uci,
        is_solved=req.is_solved,
        repeated_old_blunder=req.repeated_old_blunder,
        hints_used=req.hints_used,
        time_spent_seconds=req.time_spent_seconds,
        created_at=now
    )
    session.add(attempt)

    # 2. Update or create progress
    prog_query = select(UserPuzzleProgressEntity).where(
        UserPuzzleProgressEntity.username == clean_username,
        UserPuzzleProgressEntity.puzzle_id == req.puzzle_id
    )
    progress = (await session.execute(prog_query)).scalar_one_or_none()

    if not progress:
        progress = UserPuzzleProgressEntity(
            username=clean_username,
            puzzle_id=req.puzzle_id,
            attempts_count=0,
            consecutive_correct=0,
            is_mastered=False,
            repeated_old_blunder_count=0
        )
        session.add(progress)

    progress.attempts_count += 1
    progress.last_attempt_at = now
    progress.last_solved = req.is_solved
    progress.last_hints_used = req.hints_used

    if req.repeated_old_blunder:
        progress.repeated_old_blunder_count += 1

    # Spaced Repetition Logic
    if req.is_solved and (req.hints_used > 0 or req.mistakes > 0):
        # Solved with help: not a clean recall. The streak restarts and it comes back tomorrow.
        progress.consecutive_correct = 0
        progress.is_mastered = False
        progress.next_review_at = now + timedelta(days=1)
        msg = "Resuelto con ayuda. Lo repasamos mañana para fijarlo sin pistas."
    elif req.is_solved:
        progress.consecutive_correct += 1

        if progress.consecutive_correct >= 3:
            progress.is_mastered = True
            progress.next_review_at = now + timedelta(days=7)
            msg = "¡Posición dominada! Repaso programado en 7 días."
        elif progress.consecutive_correct == 2:
            progress.is_mastered = False
            progress.next_review_at = now + timedelta(days=3)
            msg = "¡Gran avance! Segundo acierto consecutivo. Repaso en 3 días."
        else:
            progress.is_mastered = False
            progress.next_review_at = now + timedelta(days=1)
            msg = "¡Correcto! Repaso programado para mañana."
    else:
        progress.consecutive_correct = 0
        progress.is_mastered = False
        progress.next_review_at = now + timedelta(minutes=15)
        if req.repeated_old_blunder:
            msg = "Has repetido tu error de la partida. Repaso programado en 15 minutos."
        else:
            msg = "Intento no resuelto. Repaso programado en 15 minutos."

    await session.commit()

    return PuzzleAttemptResponse(
        puzzle_id=req.puzzle_id,
        username=clean_username,
        is_solved=req.is_solved,
        consecutive_correct=progress.consecutive_correct,
        is_mastered=progress.is_mastered,
        next_review_at=progress.next_review_at,
        message=msg
    )


async def get_user_trainer_stats(
    session: AsyncSession,
    username: str
) -> TrainerStatsResponse:
    """
    Computes aggregated practice and mastery statistics for the user.
    """
    clean_username = username.strip().lower()
    now = utc_now_naive()

    # Query all puzzles for user with progress
    query = (
        select(BlunderBankEntity, UserPuzzleProgressEntity)
        .outerjoin(
            UserPuzzleProgressEntity,
            and_(
                UserPuzzleProgressEntity.puzzle_id == BlunderBankEntity.id,
                UserPuzzleProgressEntity.username == clean_username
            )
        )
        .where(BlunderBankEntity.username == clean_username)
    )

    rows = (await session.execute(query)).all()

    total_puzzles = len(rows)
    solved_puzzles = 0
    mastered_puzzles = 0
    review_due_puzzles = 0
    repeated_blunders = 0

    theme_counts: Dict[str, Dict[str, int]] = {}

    for entity, progress in rows:
        th = entity.theme or "general"
        if th not in theme_counts:
            theme_counts[th] = {"total": 0, "solved": 0, "mastered": 0}
        theme_counts[th]["total"] += 1

        if progress:
            repeated_blunders += progress.repeated_old_blunder_count
            if progress.last_solved or progress.consecutive_correct > 0:
                solved_puzzles += 1
                theme_counts[th]["solved"] += 1
            if progress.is_mastered:
                mastered_puzzles += 1
                theme_counts[th]["mastered"] += 1
            if progress.next_review_at and progress.next_review_at <= now:
                review_due_puzzles += 1

    mastery_pct = round((mastered_puzzles / total_puzzles) * 100.0, 1) if total_puzzles > 0 else 0.0

    # Top leak theme
    top_leak_theme = None
    specific = {t: c for t, c in theme_counts.items() if t != GENERIC_THEME} or theme_counts
    if specific:
        top_leak_theme = max(specific.keys(), key=lambda t: specific[t]["total"])

    themes_breakdown: Dict[str, TrainerThemeStats] = {}
    for th, counts in theme_counts.items():
        tot = counts["total"]
        solv = counts["solved"]
        rate = round((solv / tot) * 100.0, 1) if tot > 0 else 0.0
        themes_breakdown[th] = TrainerThemeStats(
            theme=th,
            total_puzzles=tot,
            solved_puzzles=solv,
            mastered_puzzles=counts["mastered"],
            success_rate=rate
        )

    return TrainerStatsResponse(
        username=clean_username,
        total_puzzles=total_puzzles,
        solved_puzzles=solved_puzzles,
        mastered_puzzles=mastered_puzzles,
        review_due_puzzles=review_due_puzzles,
        repeated_blunders_count=repeated_blunders,
        mastery_percentage=mastery_pct,
        top_leak_theme=top_leak_theme,
        themes_breakdown=themes_breakdown
    )
