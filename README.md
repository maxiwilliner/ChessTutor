# ChessTutor ♟️🤖

**Profesor Personal de Ajedrez** conectado a Chess.com con evaluación matemática determinista mediante **Stockfish 16**, análisis psicológico del reloj y entrenamiento interactivo de tus propios errores (*Blunder Replay*).

---

## 🌟 Características Principales

1. **Separación Estricta entre Cálculo y Pedagogía:**
   - **Stockfish 16 & python-chess:** Cálculo determinista de Centipawn Loss (CPL), evaluación por jugada, detección de piezas colgadas, clavadas, horquillas y mates omitidos.
   - **Tutor LLM:** Recibe un resumen estructurado JSON (`PlayerDiagnosisSummary`) sin alucinaciones de tableros, redactando un diagnóstico empático de 3 fugas de Elo y un plan de estudio semanal.
2. **Conexión Directa con Chess.com:**
   - Headers compatibles con la API pública de Chess.com (`User-Agent`).
   - Caché en SQLite con WAL para evitar descargas repetidas.
3. **Psicología del Reloj (`[%clk]`):**
   - Detección de blunders impulsivos realizados en $\le 3\text{ s}$ con abundante tiempo disponible vs. colapsos bajo apuro de tiempo ($< 15\text{ s}$).
4. **Entrenador Interactivo (Blunder Replay):**
   - Tablero táctil en DOM a 60 fps con `chessground` y `chess.js`.
   - Sistema pedagógico de 3 pistas progresivas (Conceptual $\to$ Direccional $\to$ Concreta).
   - Detección de repetición del error pasado con avisos específicos y flechas de corrección.

---

## 🚀 Inicio Rápido

### Requisitos Previos
- Python 3.12+
- Node.js 18+ / npm
- **Stockfish:** Instalado en el sistema (`sudo apt install stockfish` en Linux, `brew install stockfish` en macOS) o colocando el ejecutable en `backend/bin/stockfish`. Configurable también mediante la variable `STOCKFISH_PATH` en `.env`.

### Iniciar Toda la Aplicación (Comando Único)
Para arrancar el backend y frontend simultáneamente con apagado automático al pulsar `Ctrl+C`:
```bash
./start.sh
# o también:
make dev
```
- **Web (Frontend):** `http://localhost:3000`
- **API (Backend):** `http://localhost:8000`
- **Documentación Swagger:** `http://localhost:8000/docs`

---

### Iniciar Servicios por Separado (Opcional)

#### 1. Backend (FastAPI + Stockfish 16)
```bash
source backend/.venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

#### 2. Frontend (Next.js 15)
```bash
cd frontend
npm run dev
```

---

## 🧪 Ejecutar Pruebas Automatizadas
Para verificar el conjunto completo de 18 pruebas unitarias y de integración del backend:
```bash
./backend/.venv/bin/pytest
```

---

## 📁 Estructura del Proyecto
- `guide.md`: Especificación técnica y conceptual completa.
- `execute.md`: Plan de implementación ejecutado en 3 fases.
- `backend/`: API en FastAPI, conector Chess.com, worker pool de Stockfish 16, heurísticas y endpoints.
- `frontend/`: Aplicación en Next.js 15 (React 18), Tailwind CSS, Chessground y Recharts.

