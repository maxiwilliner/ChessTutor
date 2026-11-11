from collections import defaultdict
from typing import List, Dict, Tuple, Any
import math
import chess

from backend.app.models.chesscom import NormalizedGame
from backend.app.models.engine import EvaluatedMove
from backend.app.models.diagnosis import (
    PlayerDiagnosisSummary,
    PlayerMeta,
    OverallMetrics,
    ErrorBreakdown,
    PhaseDistribution,
    PhaseStats,
    TacticalMotifDetail,
    OpeningGap,
    AlgorithmicFlag
)
from backend.app.models.puzzles import (
    BlunderBankItem,
    BlunderGameMetadata,
    BlunderUserMove,
    BlunderEngineSolution,
    BlunderClassification,
    TutorHints
)
from backend.app.modules.heuristics.tactical import classify_tactical_motif
from backend.app.modules.heuristics.clock import tag_move_psychology, analyze_clock_psychology


THEME_DESCRIPTIONS = {
    "hanging_piece": "Piezas propias dejadas sin defensa táctica o captura de piezas rivales envenenadas",
    "pin_exploitation": "Fallo al detectar piezas clavadas al rey o a piezas de mayor valor",
    "fork_overlooked": "Ataques dobles de caballo o dama desatendidos",
    "missed_mate": "Omisión de secuencias forzadas de mate en 1 a 3 jugadas",
    "king_safety_collapse": "Rey atrapado en el centro o apertura de líneas frente al enroque",
    "tactical_inaccuracy": "Imprecisión en el cálculo posicional o intercambio desventajoso de material"
}


def generate_hints_for_blunder(
    theme: str,
    fen_before: str,
    best_move_san: str,
    best_move_uci: str,
    user_move_san: str
) -> TutorHints:
    """
    Generates 3 tiers of pedagogical hints based on the tactical motif and engine solution.
    """
    board = chess.Board(fen_before)
    user_color_str = "blancas" if board.turn == chess.WHITE else "negras"
    best_move = chess.Move.from_uci(best_move_uci) if best_move_uci else None
    target_square_name = chess.square_name(best_move.to_square) if best_move else "la casilla clave"

    if theme == "hanging_piece":
        level_1 = "¿Hay alguna pieza indefensa en el tablero o tu última jugada dejó algo desprotegido?"
        level_2 = f"Evalúa la actividad y seguridad alrededor de {target_square_name}."
        level_3 = f"La mejor jugada es {best_move_san}, asegurando la pieza o castigando la falta de defensa."
    elif theme == "pin_exploitation":
        level_1 = "Observa las piezas alineadas con el rey o la dama rival."
        level_2 = f"Hay una clavada táctica que puedes explotar en la zona de {target_square_name}."
        level_3 = f"Juega {best_move_san}, aprovechando la inmovilidad de la pieza rival clavada."
    elif theme == "fork_overlooked":
        level_1 = "¿Puede una sola pieza atacar dos objetivos simultáneamente?"
        level_2 = f"Busca una bifurcación táctica colocando tu pieza en {target_square_name}."
        level_3 = f"Ejecuta {best_move_san}, logrando un ataque doble decisivo."
    elif theme == "missed_mate":
        level_1 = "El rey rival está en una red de mate. ¡Calcula jugadas forzadas!"
        level_2 = f"Da un jaque implacable llevando tu pieza a {target_square_name}."
        level_3 = f"La jugada ganadora es {best_move_san}, conduciendo al mate inevitable."
    elif theme == "king_safety_collapse":
        level_1 = "Evalúa la seguridad del rey: diagonales y columnas abiertas."
        level_2 = f"Fíjate en las debilidades del enroque y la casilla {target_square_name}."
        level_3 = f"Juega {best_move_san} para neutralizar las amenazas sobre el monarca."
    else:
        level_1 = "¿Cuál es la debilidad más evidente en la posición rival?"
        level_2 = f"Busca la jugada más activa hacia {target_square_name}."
        level_3 = f"La continuación recomendada por el motor es {best_move_san}."

    return TutorHints(
        level_1_conceptual=level_1,
        level_2_directional=level_2,
        level_3_concrete=level_3
    )


def assemble_diagnosis_and_puzzles(
    username: str,
    time_class: str,
    games: List[NormalizedGame],
    evaluated_games_moves: List[List[EvaluatedMove]]
) -> Tuple[PlayerDiagnosisSummary, List[BlunderBankItem]]:
    """
    Aggregates all evaluation results across games into a PlayerDiagnosisSummary JSON
    and populates the BlunderBank with interactive puzzle items.
    """
    total_games = len(games)
    wins = sum(1 for g in games if g.user_result == "win")
    draws = sum(1 for g in games if g.user_result == "draw")
    losses = total_games - wins - draws

    win_rate = round(wins / total_games, 2) if total_games > 0 else 0.0
    draw_rate = round(draws / total_games, 2) if total_games > 0 else 0.0
    loss_rate = round(losses / total_games, 2) if total_games > 0 else 0.0

    all_user_moves: List[EvaluatedMove] = []
    blunder_items: List[BlunderBankItem] = []

    # Tag and classify every user move
    for game, moves in zip(games, evaluated_games_moves):
        # Track opening eval at move 12
        eval_at_12 = 0.0
        for m in moves:
            if m.move_number <= 12:
                eval_at_12 = m.eval_after_cp

        for m in moves:
            all_user_moves.append(m)

            # Heuristics classification for errors/blunders
            if m.classification in ("blunder", "error", "inaccuracy"):
                board_before = chess.Board(m.fen_before)
                user_move = chess.Move.from_uci(m.user_move_uci)
                theme = classify_tactical_motif(
                    board_before=board_before,
                    user_move=user_move,
                    eval_before_cp=m.eval_before_cp,
                    eval_after_cp=m.eval_after_cp,
                    cpl=m.cpl,
                    opponent_pv=m.pv_uci,
                    move_number=m.move_number
                )
                psy_tag = tag_move_psychology(
                    time_spent=m.time_spent_seconds,
                    clock_remaining=m.clock_remaining_seconds,
                    cpl=m.cpl
                )
                m.tactical_theme = theme
                m.psychological_tag = psy_tag

                # Add to BlunderBank if it's a critical blunder or error
                if m.classification in ("blunder", "error") and m.best_move_uci:
                    hints = generate_hints_for_blunder(
                        theme=theme,
                        fen_before=m.fen_before,
                        best_move_san=m.best_move_san or m.best_move_uci,
                        best_move_uci=m.best_move_uci,
                        user_move_san=m.user_move_san
                    )
                    blunder_item = BlunderBankItem(
                        id=f"bb_{game.id}_m{m.move_number}_{m.turn}",
                        game_url=game.url,
                        metadata=BlunderGameMetadata(
                            white=game.white_username,
                            black=game.black_username,
                            user_color=game.user_color,
                            eco=game.eco,
                            opening_name=game.opening_name,
                            time_control=game.time_control
                        ),
                        move_number=m.move_number,
                        turn=m.turn,
                        fen_before=m.fen_before,
                        user_move=BlunderUserMove(
                            uci=m.user_move_uci,
                            san=m.user_move_san,
                            time_spent_seconds=m.time_spent_seconds,
                            clock_remaining_seconds=m.clock_remaining_seconds
                        ),
                        engine_solution=BlunderEngineSolution(
                            best_move_uci=m.best_move_uci,
                            best_move_san=m.best_move_san or m.best_move_uci,
                            eval_before=round(m.eval_before_cp / 100.0, 2),
                            eval_after_user_move=round(m.eval_after_cp / 100.0, 2),
                            cpl=m.cpl,
                            pv_uci=m.pv_uci,
                            pv_san=m.pv_san
                        ),
                        classification=BlunderClassification(
                            phase=m.phase,
                            theme=theme,
                            psychological_tag=psy_tag
                        ),
                        tutor_hints=hints
                    )
                    blunder_items.append(blunder_item)

    # 1. Error breakdown
    blunders_total = sum(1 for m in all_user_moves if m.classification == "blunder")
    errors_total = sum(1 for m in all_user_moves if m.classification == "error")
    inaccuracies_total = sum(1 for m in all_user_moves if m.classification == "inaccuracy")
    blunders_per_game = round(blunders_total / total_games, 2) if total_games > 0 else 0.0

    avg_cpl = round(sum(m.cpl for m in all_user_moves) / len(all_user_moves), 1) if all_user_moves else 0.0
    # Accuracy score (0-100) based on average centipawn loss
    accuracy_score = round(max(10.0, min(99.0, 100.0 * math.exp(-0.005 * avg_cpl))), 1)

    # 2. Phase distribution
    phase_moves = {"opening": [], "middlegame": [], "endgame": []}
    for m in all_user_moves:
        phase_moves[m.phase].append(m)

    def compute_phase_stats(moves_phase: List[EvaluatedMove]) -> PhaseStats:
        b_count = sum(1 for m in moves_phase if m.classification == "blunder")
        avg = round(sum(m.cpl for m in moves_phase) / len(moves_phase), 1) if moves_phase else 0.0
        pct = round((b_count / blunders_total) * 100.0, 1) if blunders_total > 0 else 0.0
        return PhaseStats(blunders=b_count, avg_cpl=avg, percentage_of_blunders=pct)

    phase_dist = PhaseDistribution(
        opening=compute_phase_stats(phase_moves["opening"]),
        middlegame=compute_phase_stats(phase_moves["middlegame"]),
        endgame=compute_phase_stats(phase_moves["endgame"])
    )

    # 3. Tactical motifs
    blunder_moves = [m for m in all_user_moves if m.classification in ("blunder", "error")]
    motif_counts = defaultdict(int)
    for m in blunder_moves:
        t = m.tactical_theme or "tactical_inaccuracy"
        motif_counts[t] += 1

    tactical_motifs: Dict[str, TacticalMotifDetail] = {}
    for theme_key, desc in THEME_DESCRIPTIONS.items():
        cnt = motif_counts[theme_key]
        pct = round((cnt / len(blunder_moves)) * 100.0, 1) if blunder_moves else 0.0
        tactical_motifs[theme_key] = TacticalMotifDetail(
            count=cnt,
            percentage_of_blunders=pct,
            description=desc
        )

    # 4. Clock psychology
    clock_stats = analyze_clock_psychology(all_user_moves)

    # 5. Opening repertoire gaps
    eco_games = defaultdict(list)
    for g, moves in zip(games, evaluated_games_moves):
        eco_games[(g.eco, g.opening_name, g.user_color)].append((g, moves))

    opening_gaps: List[OpeningGap] = []
    for (eco, name, color), g_list in eco_games.items():
        op_games_count = len(g_list)
        op_wins = sum(1 for g, _ in g_list if g.user_result == "win")
        op_win_rate = round(op_wins / op_games_count, 2)

        # Average eval at move 12
        evals_at_12 = []
        blunder_themes_in_op = []
        for g, moves in g_list:
            m12_eval = 0.0
            for m in moves:
                if m.move_number <= 12:
                    m12_eval = m.eval_after_cp
                if m.classification in ("blunder", "error") and m.tactical_theme:
                    blunder_themes_in_op.append(m.tactical_theme)
            evals_at_12.append(m12_eval)

        avg_m12 = round((sum(evals_at_12) / len(evals_at_12)) / 100.0, 2) if evals_at_12 else 0.0
        dominant_motif = "none"
        if blunder_themes_in_op:
            dominant_motif = max(set(blunder_themes_in_op), key=blunder_themes_in_op.count)

        opening_gaps.append(
            OpeningGap(
                eco=eco,
                name=name,
                color=color,
                games_played=op_games_count,
                win_rate=op_win_rate,
                avg_eval_at_move_12=avg_m12,
                dominant_blunder_motif=dominant_motif
            )
        )

    # Sort openings: most played first
    opening_gaps.sort(key=lambda o: (o.games_played, -o.win_rate), reverse=True)

    # 6. Top 3 Algorithmic Flags
    flags: List[AlgorithmicFlag] = []
    # Check hanging pieces
    hp_pct = tactical_motifs.get("hanging_piece", TacticalMotifDetail(count=0, percentage_of_blunders=0, description="")).percentage_of_blunders
    if hp_pct >= 25.0:
        flags.append(
            AlgorithmicFlag(
                code="HANGING_PIECES",
                severity="CRITICAL" if hp_pct >= 40.0 else "HIGH",
                metric_reference=f"{hp_pct}% de tus errores graves provienen de piezas colgadas o desprotegidas."
            )
        )

    # Check clock psychology
    if clock_stats.primary_flaw == "impulsive_play":
        flags.append(
            AlgorithmicFlag(
                code="IMPULSIVE_MOVE_SELECTION",
                severity="HIGH",
                metric_reference=f"{clock_stats.blunders_under_3s_with_ample_time} errores cometidos en menos de 3 segundos con abundancia de tiempo en el reloj."
            )
        )
    elif clock_stats.primary_flaw == "time_trouble_panic":
        flags.append(
            AlgorithmicFlag(
                code="TIME_TROUBLE_PANIC",
                severity="HIGH",
                metric_reference=f"{clock_stats.blunders_in_time_trouble_under_10s} errores graves cometidos con menos de 10 segundos en el reloj."
            )
        )

    # Check opening gaps with low win rate
    problem_openings = [o for o in opening_gaps if o.games_played >= 2 and o.win_rate <= 0.35]
    if problem_openings:
        worst_op = problem_openings[0]
        flags.append(
            AlgorithmicFlag(
                code=f"REPERTOIRE_LEAK_{worst_op.eco}",
                severity="HIGH" if worst_op.avg_eval_at_move_12 <= -1.5 else "MEDIUM",
                metric_reference=f"En {worst_op.name} ({worst_op.eco}) obtienes solo un {worst_op.win_rate*100:.0f}% de victorias con una evaluación media de {worst_op.avg_eval_at_move_12} en la jugada 12."
            )
        )

    # Fallback flags if less than 3
    if len(flags) < 3 and phase_dist.middlegame.percentage_of_blunders >= 50.0:
        flags.append(
            AlgorithmicFlag(
                code="MIDDLEGAME_COLLAPSE",
                severity="MEDIUM",
                metric_reference=f"{phase_dist.middlegame.percentage_of_blunders}% de los errores ocurren durante la fase de medio juego."
            )
        )
    if len(flags) < 3:
        flags.append(
            AlgorithmicFlag(
                code="GENERAL_TACTICAL_CALCULATION",
                severity="MEDIUM",
                metric_reference=f"Pérdida media de centipeones de {avg_cpl} CPL por jugada."
            )
        )

    # Take top 3 flags
    top_3_flags = flags[:3]

    current_elo = games[0].white_rating if games[0].user_color == "white" else games[0].black_rating

    summary = PlayerDiagnosisSummary(
        player=PlayerMeta(
            username=username,
            elo_current=current_elo,
            time_class=time_class,
            games_analyzed=total_games,
            period="Recent Archives"
        ),
        overall_metrics=OverallMetrics(
            win_rate=win_rate,
            draw_rate=draw_rate,
            loss_rate=loss_rate,
            avg_centipawn_loss=avg_cpl,
            accuracy_score=accuracy_score
        ),
        error_breakdown=ErrorBreakdown(
            blunders_total=blunders_total,
            errors_total=errors_total,
            inaccuracies_total=inaccuracies_total,
            blunders_per_game=blunders_per_game
        ),
        phase_distribution=phase_dist,
        tactical_motifs=tactical_motifs,
        clock_psychology=clock_stats,
        opening_repertoire_gaps=opening_gaps,
        top_3_algorithmic_flags=top_3_flags
    )

    return summary, blunder_items

