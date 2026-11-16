"""
Configuración común de pytest.

Fija una base de datos SQLite temporal ANTES de que se importe la app, para que los tests
no escriban en `backend/chess_tutor.db` (la base de datos de desarrollo).
"""
import os
import shutil
import tempfile

_TEST_DB_DIR = tempfile.mkdtemp(prefix="chesstutor-tests-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{os.path.join(_TEST_DB_DIR, 'test.db')}"


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TEST_DB_DIR, ignore_errors=True)
