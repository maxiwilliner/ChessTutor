.PHONY: dev backend frontend test clean

dev:
	@./start.sh

backend:
	@./backend/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

frontend:
	@cd frontend && npm run dev

test:
	@./backend/.venv/bin/pytest

