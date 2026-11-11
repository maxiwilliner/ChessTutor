from typing import Optional, List
import chess

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}


def is_piece_hanging(board: chess.Board, square: chess.Square, piece_color: chess.Color) -> bool:
    """
    Checks if a piece at square is undefended while under attack,
    or if it is attacked by a lesser-valued piece (e.g. pawn attacking rook/queen).
    """
    piece = board.piece_at(square)
    if not piece or piece.color != piece_color:
        return False

    opponent_color = not piece_color
    attackers = board.attackers(opponent_color, square)
    if not attackers:
        return False

    defenders = board.attackers(piece_color, square)
    piece_val = PIECE_VALUES.get(piece.piece_type, 0)

    # Completely undefended under attack
    if not defenders:
        return True

    # Attacked by a lower-value enemy piece (e.g. pawn attacking knight/queen)
    min_attacker_val = min(
        PIECE_VALUES.get(board.piece_at(sq).piece_type, 10)
        for sq in attackers if board.piece_at(sq)
    )
    if min_attacker_val < piece_val:
        return True

    # More attackers than defenders
    if len(attackers) > len(defenders):
        return True

    return False


def detect_hanging_piece(board_before: chess.Board, user_move: chess.Move) -> bool:
    """
    Detects if the user moved a piece into an undefended attack, or left a piece hanging.
    """
    user_color = board_before.turn
    board_after = board_before.copy()
    if user_move not in board_after.legal_moves:
        return False
    board_after.push(user_move)

    # 1. Did the user move their piece to an unprotected hanging square?
    if is_piece_hanging(board_after, user_move.to_square, user_color):
        return True

    # 2. Did this move leave any other friendly piece hanging that wasn't hanging before?
    for sq in chess.SQUARES:
        p = board_after.piece_at(sq)
        if p and p.color == user_color and sq != user_move.to_square:
            was_hanging = is_piece_hanging(board_before, sq, user_color)
            is_hanging_now = is_piece_hanging(board_after, sq, user_color)
            if is_hanging_now and not was_hanging:
                return True

    return False


def detect_pin_exploitation(board_before: chess.Board, user_move: chess.Move) -> bool:
    """
    Detects if the user moved an absolute or relative pinned piece,
    exposing a higher-value piece behind it.
    """
    user_color = board_before.turn
    from_sq = user_move.from_square

    # Absolute pin to the king
    if board_before.is_pinned(user_color, from_sq):
        return True

    # Relative pin check: was the piece shielding a queen or rook from an enemy slider?
    opponent_color = not user_color
    board_after = board_before.copy()
    if user_move in board_after.legal_moves:
        board_after.push(user_move)
        # Check if enemy sliders now directly attack our Queen or Rook through from_sq
        for enemy_sq in board_after.pieces(chess.BISHOP, opponent_color) | \
                        board_after.pieces(chess.ROOK, opponent_color) | \
                        board_after.pieces(chess.QUEEN, opponent_color):
            attacks = board_after.attacks(enemy_sq)
            for high_val_sq in board_after.pieces(chess.QUEEN, user_color) | board_after.pieces(chess.ROOK, user_color):
                if high_val_sq in attacks:
                    # Check if enemy attacked it before user moved
                    if high_val_sq not in board_before.attacks(enemy_sq):
                        return True

    return False


def detect_fork(board_after_user_move: chess.Board, opponent_best_reply: Optional[chess.Move]) -> bool:
    """
    Detects if the opponent's best reply executes a tactical fork
    (attacking 2+ friendly valuable pieces simultaneously).
    """
    if not opponent_best_reply:
        return False

    temp_board = board_after_user_move.copy()
    if opponent_best_reply not in temp_board.legal_moves:
        return False
    temp_board.push(opponent_best_reply)

    forking_sq = opponent_best_reply.to_square
    opponent_color = temp_board.turn  # After push, temp_board.turn is user's turn
    user_color = temp_board.turn

    targets = []
    attacks = temp_board.attacks(forking_sq)
    for attacked_sq in attacks:
        piece = temp_board.piece_at(attacked_sq)
        if piece and piece.color == user_color:
            # King, Queen, Rook, Bishop, Knight
            if piece.piece_type in (chess.KING, chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT):
                targets.append(piece)

    return len(targets) >= 2


def detect_missed_mate(eval_before_cp: float, eval_after_cp: float, cpl: float) -> bool:
    """
    Detects if the position before was a decisive forced mate (eval >= +9000),
    and after the move the mate was missed (eval dropped below +300 or CPL > 500).
    """
    return eval_before_cp >= 8000.0 and eval_after_cp < 2000.0


def detect_king_safety(board: chess.Board, user_color: chess.Color, move_number: int) -> bool:
    """
    Detects king exposure: king uncastled after move 15 with center files open,
    or destroyed pawn shield around the king.
    """
    king_sq = board.king(user_color)
    if king_sq is None:
        return False

    # King in center after move 15
    if move_number > 15 and chess.square_file(king_sq) in (3, 4):  # d or e file
        # Check if e or d file is open (no pawns on file)
        e_pawns = len([sq for sq in chess.SQUARES if chess.square_file(sq) == 4 and board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN])
        d_pawns = len([sq for sq in chess.SQUARES if chess.square_file(sq) == 3 and board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN])
        if e_pawns == 0 or d_pawns == 0:
            return True

    return False


def classify_tactical_motif(
    board_before: chess.Board,
    user_move: chess.Move,
    eval_before_cp: float,
    eval_after_cp: float,
    cpl: float,
    opponent_pv: List[str],
    move_number: int
) -> str:
    """
    Identifies the primary tactical theme of an error in priority order.
    """
    # 1. Missed mate
    if detect_missed_mate(eval_before_cp, eval_after_cp, cpl):
        return "missed_mate"

    # 2. Hanging piece
    if detect_hanging_piece(board_before, user_move):
        return "hanging_piece"

    # 3. Pin exploitation
    if detect_pin_exploitation(board_before, user_move):
        return "pin_exploitation"

    # 4. Fork
    board_after = board_before.copy()
    if user_move in board_after.legal_moves:
        board_after.push(user_move)
        opponent_reply = None
        if opponent_pv:
            try:
                opponent_reply = chess.Move.from_uci(opponent_pv[0])
            except ValueError:
                pass
        if opponent_reply and detect_fork(board_after, opponent_reply):
            return "fork_overlooked"

    # 5. King safety
    if detect_king_safety(board_before, board_before.turn, move_number):
        return "king_safety_collapse"

    return "tactical_inaccuracy"

