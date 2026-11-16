from typing import List, Optional, Tuple
import chess


def uci_line_to_san(fen: str, pv_uci: List[str], max_plies: int = 5) -> Tuple[Optional[str], List[str]]:
    """
    Convierte una variante en UCI a SAN desde la posición `fen`.
    Devuelve (primera jugada en SAN, variante en SAN). Se detiene en la primera jugada ilegal.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        return None, []

    san_line: List[str] = []
    for uci in pv_uci[:max_plies]:
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            break
        if move not in board.legal_moves:
            break
        san_line.append(board.san(move))
        board.push(move)

    return (san_line[0] if san_line else None), san_line
