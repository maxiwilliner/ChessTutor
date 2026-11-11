import asyncio
import logging
from typing import Optional, List
import chess
import chess.engine

from backend.app.core.config import settings
from backend.app.models.engine import PositionEvaluation

logger = logging.getLogger(__name__)


class StockfishWorker:
    def __init__(self, binary_path: str):
        self.binary_path = binary_path
        self.transport: Optional[asyncio.SubprocessTransport] = None
        self.engine: Optional[chess.engine.UciProtocol] = None

    async def start(self):
        try:
            self.transport, self.engine = await chess.engine.popen_uci(self.binary_path)
            # Configure engine parameters for fast analysis
            await self.engine.configure({"Threads": 1, "Hash": 16})
        except Exception as e:
            logger.error(f"Failed to start Stockfish worker: {e}")
            raise

    async def quit(self):
        if self.engine:
            try:
                await self.engine.quit()
            except Exception:
                pass
            self.engine = None
            self.transport = None


class StockfishPool:
    def __init__(self, binary_path: Optional[str] = None, pool_size: Optional[int] = None):
        self.binary_path = binary_path or str(settings.STOCKFISH_PATH)
        self.pool_size = pool_size or settings.STOCKFISH_CONCURRENCY
        self._queue: asyncio.Queue[StockfishWorker] = asyncio.Queue()
        self._workers: List[StockfishWorker] = []
        self._is_initialized = False
        self._lock = asyncio.Lock()

    async def initialize(self):
        async with self._lock:
            if self._is_initialized:
                return
            logger.info(f"Initializing StockfishPool with {self.pool_size} workers...")
            for _ in range(self.pool_size):
                worker = StockfishWorker(self.binary_path)
                await worker.start()
                self._workers.append(worker)
                await self._queue.put(worker)
            self._is_initialized = True
            logger.info("StockfishPool initialized successfully.")

    async def close(self):
        async with self._lock:
            if not self._is_initialized:
                return
            logger.info("Closing StockfishPool...")
            while not self._queue.empty():
                try:
                    self._queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
            for worker in self._workers:
                await worker.quit()
            self._workers.clear()
            self._is_initialized = False
            logger.info("StockfishPool closed.")

    async def evaluate_position(
        self,
        fen: str,
        depth: int = 12,
        time_limit: Optional[float] = None,
        multipv: int = 1
    ) -> PositionEvaluation:
        if not self._is_initialized:
            await self.initialize()

        worker = await self._queue.get()
        try:
            board = chess.Board(fen)
            limit = chess.engine.Limit(depth=depth, time=time_limit)

            info = await worker.engine.analyse(board, limit, multipv=multipv)

            # info may be a single dict or list of dicts if multipv > 1
            primary = info[0] if isinstance(info, list) else info
            score_obj = primary.get("score")

            score_cp: Optional[int] = None
            mate_in: Optional[int] = None

            if score_obj:
                score_white = score_obj.white()
                if score_white.is_mate():
                    mate_in = score_white.mate()
                    # Assign a large centipawn value preserving direction
                    score_cp = 10000 - abs(mate_in) * 100 if mate_in > 0 else -10000 + abs(mate_in) * 100
                else:
                    score_cp = score_white.score()

            pv_moves = primary.get("pv", [])
            best_move = pv_moves[0] if pv_moves else None
            best_move_uci = best_move.uci() if best_move else None
            best_move_san = board.san(best_move) if best_move and best_move in board.legal_moves else None

            # Generate SAN for PV line
            pv_uci = [m.uci() for m in pv_moves[:5]]
            pv_san: List[str] = []
            temp_board = board.copy()
            for m in pv_moves[:5]:
                if m in temp_board.legal_moves:
                    pv_san.append(temp_board.san(m))
                    temp_board.push(m)
                else:
                    break

            return PositionEvaluation(
                fen=fen,
                depth=depth,
                score_cp=score_cp,
                mate_in=mate_in,
                best_move_uci=best_move_uci,
                best_move_san=best_move_san,
                pv_uci=pv_uci,
                pv_san=pv_san
            )
        except Exception as e:
            logger.error(f"Error evaluating position {fen}: {e}")
            # Restart faulty worker
            try:
                await worker.quit()
            except Exception:
                pass
            new_worker = StockfishWorker(self.binary_path)
            await new_worker.start()
            worker = new_worker
            raise
        finally:
            await self._queue.put(worker)


# Global singleton instance
stockfish_pool = StockfishPool()

