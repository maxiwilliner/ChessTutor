import pytest
import chess
from backend.app.modules.engine.stockfish_pool import StockfishPool
from backend.app.core.config import settings


@pytest.mark.asyncio
async def test_stockfish_pool_evaluation():
    pool = StockfishPool(pool_size=1)
    try:
        await pool.initialize()
        # Initial position
        board = chess.Board()
        eval_result = await pool.evaluate_position(board.fen(), depth=10)
        assert eval_result is not None
        assert eval_result.fen == board.fen()
        assert eval_result.best_move_uci is not None
        assert eval_result.score_cp is not None
        assert len(eval_result.pv_uci) > 0

        # Tactical position: Scholar's mate delivery (Qxf7#)
        # 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6?? 4. Qxf7#
        scholars_fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"
        tactical_eval = await pool.evaluate_position(scholars_fen, depth=10)
        assert tactical_eval.best_move_uci == "h5f7"
        assert tactical_eval.mate_in == 1 or (tactical_eval.score_cp and tactical_eval.score_cp > 9000)
    finally:
        await pool.close()

