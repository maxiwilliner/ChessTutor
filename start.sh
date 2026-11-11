#!/usr/bin/env bash
set -e

# Directorio base del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "============================================="
echo "   ♟️  Iniciando ChessTutor en Local  🤖"
echo "============================================="

# 1. Verificar entorno virtual del Backend
VENV_PYTHON="$PROJECT_ROOT/backend/.venv/bin/python"
VENV_UVICORN="$PROJECT_ROOT/backend/.venv/bin/uvicorn"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "❌ Error: No se encontró el entorno virtual en backend/.venv"
    echo "👉 Crea el entorno con: python3 -m venv backend/.venv && ./backend/.venv/bin/pip install -r backend/requirements.txt"
    exit 1
fi

# 2. Verificar dependencias del Frontend
if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    echo "⚠️  node_modules no encontrado en frontend/. Instalando dependencias..."
    (cd "$PROJECT_ROOT/frontend" && npm install)
fi

# 3. Limpiar puertos previos si estuvieran ocupados
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# Manejo de señales para apagado limpio (Ctrl+C)
cleanup() {
    trap - SIGINT SIGTERM EXIT
    echo ""
    echo "🛑 Apagando servidores..."
    
    if [ -n "$BACKEND_PID" ]; then
        pkill -P "$BACKEND_PID" 2>/dev/null || true
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        pkill -P "$FRONTEND_PID" 2>/dev/null || true
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 3000/tcp 2>/dev/null || true
    
    echo "✅ Servidores detenidos. ¡Hasta luego!"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 4. Iniciar Backend
echo "🚀 Iniciando Backend (FastAPI + Stockfish 16) en puerto 8000..."
"$VENV_UVICORN" backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 5. Iniciar Frontend
echo "🚀 Iniciando Frontend (Next.js 15) en puerto 3000..."
(cd "$PROJECT_ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

# Mensaje informativo
echo ""
echo "============================================="
echo "  🌐 Web:          http://localhost:3000"
echo "  ⚙️  API:          http://localhost:8000"
echo "  📖 Swagger Docs: http://localhost:8000/docs"
echo "============================================="
echo "Presiona Ctrl+C para detener ambos servidores."
echo ""

# Esperar a los procesos
wait

