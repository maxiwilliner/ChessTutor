# Plan de Ejecución e Implementación Paso a Paso: Profesor Personal de Ajedrez

Este documento detalla la hoja de ruta técnica completa dividida en 3 fases para construir el Profesor Personal de Ajedrez, con criterios de aceptación y comandos de verificación para cada tarea.

---

## Estructura de Directorios a Crear

```
cheesTutor/
├── guide.md                      # Guía conceptual y técnica del proyecto
├── execute.md                    # Plan de implementación y tareas
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── chesscom.py       # Perfil, partidas y aperturas
│   │   │       │   ├── analysis.py       # Análisis y streaming SSE
│   │   │       │   ├── diagnosis.py      # Diagnóstico generado por LLM
│   │   │       │   └── puzzles.py        # BlunderBank interactivo
│   │   │       └── router.py             # Router unificado
│   │   ├── core/
│   │   │   ├── config.py                 # Settings (User-Agent, API Keys)
│   │   │   └── database.py               # Sesión SQLite con WAL
│   │   ├── db/
│   │   │   └── models.py                 # Tablas de caché de PGNs y FENs
│   │   ├── models/
│   │   │   ├── chesscom.py               # Pydantic: Games, Clocks, Stats
│   │   │   ├── engine.py                 # Pydantic: Evals, CPL, BestMove
│   │   │   ├── diagnosis.py              # Pydantic: PlayerDiagnosisSummary
│   │   │   └── puzzles.py                # Pydantic: BlunderBankItem
│   │   ├── modules/
│   │   │   ├── chesscom/
│   │   │   │   ├── client.py             # Cliente HTTP con headers y reintentos
│   │   │   │   └── parser.py             # Extractor de PGN y comentarios [%clk]
│   │   │   ├── engine/
│   │   │   │   ├── stockfish_pool.py     # Pool de trabajadores UCI asíncronos
│   │   │   │   └── evaluator.py          # Two-Pass smart evaluation
│   │   │   ├── heuristics/
│   │   │   │   ├── tactical.py           # Reglas: piezas colgadas, clavadas, horquillas
│   │   │   │   ├── clock.py              # Impulsividad vs apuro de tiempo
│   │   │   │   ├── openings.py           # Métricas por código ECO y mov 12
│   │   │   │   └── aggregator.py         # Ensamblador de PlayerDiagnosisSummary
│   │   │   └── tutor/
│   │   │       ├── prompts.py            # Prompts pedagógicos estructurados
│   │   │       └── llm_service.py        # Integración de LLM con salidas tipadas
│   │   └── main.py                       # App FastAPI con CORS y middleware
│   ├── tests/
│   │   ├── test_chesscom_parser.py       # Pruebas de reloj y PGN
│   │   ├── test_heuristics.py            # Pruebas de reglas tácticas con FENs
│   │   └── test_stockfish_pool.py        # Pruebas del motor Stockfish
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                  # Home: Búsqueda de usuario y selección de ritmo
    │   │   ├── dashboard/
    │   │   │   └── page.tsx              # Diagnóstico global, radar y aperturas
    │   │   └── trainer/
    │   │       └── page.tsx              # Replayer interactivo de errores propios
    │   ├── components/
    │   │   ├── board/
    │   │   │   ├── ChessgroundBoard.tsx  # Tablero con soporte de flechas
    │   │   │   ├── BlunderReplay.tsx     # Controlador de ejercicios con pistas
    │   │   │   └── EvaluationBar.tsx     # Barra vertical de centipeones
    │   │   ├── charts/
    │   │   │   ├── ClockVsErrorChart.tsx # Dispersión tiempo vs. CPL
    │   │   │   └── OpeningStatsTable.tsx # Rendimiento por apertura ECO
    │   │   └── tutor/
    │   │       ├── DiagnosisCard.tsx     # Top 3 problemas críticos del tutor
    │   │       └── StudyPlanCard.tsx     # Plan de estudio semanal
    │   ├── lib/
    │   │   └── api.ts                    # Cliente HTTP/SSE hacia FastAPI
    │   └── types/
    │       └── api.ts                    # Tipos TypeScript sincronizados
    ├── package.json
    └── tailwind.config.ts
```

---

## Fase 1: MVP - Ingesta de Chess.com, Normalización y Estadísticas de Apertura

El objetivo de esta fase es conectar de forma robusta con Chess.com, extraer el historial del jugador, parsear cada partida extrayendo los tiempos exactos de reloj de cada jugada y calcular estadísticas base de aperturas.

### Tarea 1.1: Entorno Backend y Configuración Base
- Crear estructura de directorios de backend.
- Configurar entorno virtual Python 3.12 y `requirements.txt` (`fastapi`, `uvicorn`, `httpx`, `python-chess`, `pydantic`, `pydantic-settings`, `sqlalchemy`, `pytest`, `pytest-asyncio`).
- Crear `backend/app/core/config.py` con settings validados (`CHESSCOM_USER_AGENT`, límites de peticiones, ruta de base de datos SQLite).
- Configurar base de datos SQLite local en modo WAL para caché.

### Tarea 1.2: Cliente API de Chess.com (`backend/app/modules/chesscom/client.py`)
- Implementar cliente asíncrono con `httpx.AsyncClient`.
- Inyectar de manera obligatoria el header:
  `User-Agent: ChessTutor/1.0 (contacto@tuapp.com)`
- Métodos implementados:
  - `get_player_profile(username)`: Retorna estado de la cuenta, fecha de registro y país.
  - `get_player_stats(username)`: Retorna rating actual y récord por ritmo (`rapid`, `blitz`, `bullet`).
  - `get_player_games(username, time_class, limit)`: Descarga archivos mensuales (`/games/YYYY/MM`) priorizando los meses más recientes hasta alcanzar $N$ partidas.
  - Integrar almacenamiento en caché SQLite para evitar re-descargas de meses anteriores inmutables.

### Tarea 1.3: Parser de PGN y Extractor de Reloj (`backend/app/modules/chesscom/parser.py`)
- Uso de `python-chess.pgn` para recorrer el árbol de jugadas.
- Extraer metadatos: White, Black, Elo, Result, ECO, TimeControl.
- Parsear comentarios `[%clk H:MM:SS]` en cada nodo:
  - Convertir `H:MM:SS` a segundos flotantes.
  - Calcular $\Delta t$ (tiempo consumido en la jugada):
    $$\Delta t = \text{Clock}_{\text{anterior}} - \text{Clock}_{\text{actual}} + \text{Incremento}$$
- Retornar objeto estructurado `NormalizedGame` con lista de `MoveWithClock`.

### Tarea 1.4: Módulo de Estadísticas de Apertura (`backend/app/modules/heuristics/openings.py`)
- Agrupar partidas analizadas por código ECO y color jugado (blancas/negras).
- Calcular para cada apertura:
  - Total de partidas jugadas y porcentaje del repertorio.
  - Victorias, tablas y derrotas (% de win rate).
  - Promedio de jugadas de la partida en esa apertura.

### Tarea 1.5: Endpoints FastAPI y Pruebas Automatizadas de Fase 1
- Exponer endpoints en `/api/v1/chesscom`:
  - `GET /api/v1/chesscom/profile/{username}`
  - `GET /api/v1/chesscom/games/{username}?time_class=rapid&limit=30`
  - `GET /api/v1/chesscom/openings/{username}?time_class=rapid&limit=30`
- Crear suite de tests `backend/tests/test_chesscom_parser.py`:
  - Prueba de extracción de reloj con ejemplos PGN sintéticos con incremento y sin incremento.
  - Prueba de formateo de cabeceras y manejo de errores cuando el usuario no existe.

**Criterio de Aceptación Fase 1:**
Ejecutar `pytest backend/tests/test_chesscom_parser.py` con 100% de éxito y consultar la API local obteniendo el listado de partidas parseadas con sus marcas de tiempo por jugada sin bloqueos 403.

---

## Fase 2: Motor Stockfish, Clasificación Heurística y Generación de Datos

El objetivo de esta fase es evaluar las partidas con Stockfish mediante un pool asíncrono optimizado y clasificar de forma algorítmica y determinista los errores tácticos y psicológicos.

### Tarea 2.1: Instalación de Stockfish y Pool Asíncrono (`stockfish_pool.py`)
- Detección o descarga del binario de Stockfish en el entorno.
- Crear clase `StockfishPool`:
  - Mantiene $K$ procesos UCI de Stockfish (`python-chess.engine.popen_uci`).
  - Control de concurrencia con `asyncio.Semaphore(max_workers)`.
  - Mecanismo seguro de ciclo de vida (startup y shutdown limpios de procesos del motor).

### Tarea 2.2: Algoritmo de Evaluación en Dos Fases (*Two-Pass Smart Engine*)
- Crear `backend/app/modules/engine/evaluator.py`:
  - **Pase 1 (Barrido Rápido):** Evalúa todas las posiciones a `depth=11` o `nodes=30000` (~30ms) registrando la curva de centipeones.
  - **Pase 2 (Focalizado Profundo):** Si la pérdida de centipeones (CPL) entre la jugada previa y la jugada del usuario supera los 50 centipeones:
    - Se evalúa a `depth=16` con `multipv=2`.
    - Se extrae la mejor jugada (Best Move), la variante principal (PV) y el FEN exacto antes del error.
  - Clasificación de la jugada:
    - *Inexactitud:* $50 \le \text{CPL} < 100$
    - *Error:* $100 \le \text{CPL} < 200$
    - *Blunder:* $\text{CPL} \ge 200$ o pérdida de mate forzado.
- Caché de evaluaciones FEN en SQLite para reutilizar posiciones comunes de apertura.

### Tarea 2.3: Motor de Reglas Heurísticas Tácticas (`heuristics/tactical.py`)
Implementación de clasificadores deterministas usando `python-chess`:
1. `detect_hanging_piece(board, move)`: Verifica si la pieza movida quedó indefensa o si se descuidó otra pieza propia que fue capturada con pérdida material neta.
2. `detect_pin_exploitation(board, move)`: Verifica si el error involucró mover una pieza clavada al rey (`board.is_pinned()`) o no atender una clavada rival.
3. `detect_fork(board, opponent_reply)`: Verifica si la respuesta rival realiza un ataque simultáneo a 2 o más piezas no protegidas o de mayor valor.
4. `detect_missed_mate(eval_before, eval_after)`: Verifica si existía un mate forzado en 1, 2 o 3 movimientos que se esfumó tras la jugada.
5. `detect_king_safety(board, move)`: Evalúa seguridad del rey (falta de enroque tras jugada 15, columnas $d/e$ abiertas, peones $f/g/h$ avanzados).

### Tarea 2.4: Clasificador Psicológico del Reloj (`heuristics/clock.py`)
- Cruzar $\Delta t$ invertido con la clasificación del error:
  - **Jugada Impulsiva:** Blunder cometido en $\le 3.0\text{ s}$ teniendo más de 120 segundos disponibles en el reloj.
  - **Apuro de Tiempo:** Blunder cometido con menos de 10 a 15 segundos en el reloj.
- Calcular métricas agregadas: tiempo medio en blunders vs. tiempo medio en buenas jugadas.

### Tarea 2.5: Agregador y Generador de Esquemas (`heuristics/aggregator.py`)
- Ensamblar `PlayerDiagnosisSummary`: Consolidar métricas globales, desglose por fases (apertura, medio juego, final), frecuencias de motivos tácticos, factor psicológico dominante y Top 3 alertas algorítmicas.
- Generar `BlunderBank`: Colección de objetos `BlunderBankItem` con FENs, jugadas del usuario, soluciones de Stockfish y metadatos para ejercicios.

### Tarea 2.6: Streaming en Tiempo Real vía Server-Sent Events (SSE)
- Endpoint `GET /api/v1/analysis/stream?username=...&limit=30`:
  - Emisión de eventos SSE para informar el progreso del análisis en tiempo real:
    - `stage: "fetching_games"`
    - `stage: "evaluating_moves", current_game: i, total_games: N, progress_pct: P`
    - `stage: "classifying_heuristics"`
    - `stage: "complete", summary: PlayerDiagnosisSummary, blunder_count: B`

**Criterio de Aceptación Fase 2:**
Tests unitarios pasando en `backend/tests/test_heuristics.py` con posiciones FEN de control, y ejecución de análisis en un perfil de prueba completando 30 partidas en menos de 45 segundos con streaming SSE y emisión correcta del `PlayerDiagnosisSummary`.

---

## Fase 3: Profesor LLM e Interfaz Interactiva (Frontend Completo)

El objetivo de esta fase es conectar el LLM para generar el reporte pedagógico accionable y construir el frontend interactivo en Next.js con el entrenador de errores propios.

### Tarea 3.1: Servicio del Tutor LLM (`modules/tutor/llm_service.py`)
- Diseñar system prompt pedagógico estricto:
  - Rol: Gran Maestro y Entrenador de Élite de Ajedrez empático pero directo.
  - Regla: No recalcular jugadas ni inventar posiciones; basarse 100% en el `PlayerDiagnosisSummary`.
  - Estructura obligatoria:
    1. *Diagnóstico Maestro:* Los 3 grandes escapes de Elo del jugador explicados con claridad conceptual.
    2. *Plan de Estudio Semanal:* Calendario de 7 días con rutinas de 20-30 minutos enfocadas en sus debilidades.
    3. *Generador de Pistas Pedagógicas:* Creación de pistas de 3 niveles para cada posición del `BlunderBank` (Conceptual $\to$ Direccional $\to$ Concreta).
- Configuración de salidas estructuradas JSON con Pydantic / Instructor.

### Tarea 3.2: Inicialización del Frontend (Next.js 15 + Tailwind CSS)
- Configuración del proyecto en `frontend/` con TypeScript y Tailwind.
- Instalación de dependencias clave: `chessground`, `chess.js`, `lucide-react`, `recharts`, `framer-motion`.
- Creación del cliente API con soporte para SSE (`EventSource`) y fetch tipado.

### Tarea 3.3: Pantalla Principal y Flujo de Análisis
- Input estilizado para ingresar el `username` de Chess.com.
- Selector de ritmo de juego: Rápido (10+0, 15+10) o Blitz (3+0, 5+0).
- Selector de cantidad de partidas (ej. 15, 30, 50).
- Barra de progreso reactiva con animación e indicadores en tiempo real recibidos por SSE.

### Tarea 3.4: Dashboard de Diagnóstico del Profesor
- **Tarjeta del Diagnóstico Principal:** Explicación humana de los 3 problemas críticos generados por el LLM.
- **Gráficos de Rendimiento:**
  - Gráfico de dispersión: Tiempo invertido vs Centipawn Loss (destacando en rojo los errores impulsivos).
  - Gráfico circular o radar: Distribución de errores tácticos (colgadas, clavadas, dobles, seguridad de rey).
- **Tabla de Aperturas:** Rendimiento por código ECO, win rate y evaluación media a la jugada 12.
- **Plan de Estudio Semanal:** Lista interactiva con casillas de verificación para marcar avances diarios.

### Tarea 3.5: Modo Entrenamiento Interactivo (*Blunder Replay*)
- Integración de `Chessground` en `frontend/src/components/board/ChessgroundBoard.tsx`.
- Carga de la posición FEN donde el jugador falló en su partida real.
- Permite arrastrar piezas o hacer clic para mover:
  - Valida la jugada con `chess.js`.
  - Si el usuario juega la misma jugada errónea de su partida, el sistema le avisa con sonido y mensaje: *"¡Esa fue la jugada que hiciste en la partida y te costó la ventaja!"*.
  - Si realiza la jugada correcta recomendada por Stockfish, felicita al jugador y muestra la variante principal (PV) con flechas verdes.
- **Sistema de Pistas de 3 Niveles:**
  - Botón "Pedir Pista al Profesor" que desbloquea secuencialmente:
    - *Nivel 1:* Pregunta orientativa ("¿Qué pieza enemiga no tiene defensa?").
    - *Nivel 2:* Zona o casilla crítica ("Observa la diagonal a2-g8").
    - *Nivel 3:* Jugada exacta con explicación táctica.

### Tarea 3.6: Pruebas Integradas E2E y Pulido
- Verificación completa del flujo: Ingreso de usuario $\to$ Análisis SSE $\to$ Dashboard del Profesor $\to$ Resolución de 5 ejercicios en el Blunder Replay.
- Manejo de estados de error (usuario inexistente, perfil privado, usuario sin partidas en el ritmo seleccionado).

**Criterio de Aceptación Fase 3:**
Aplicación web 100% funcional y navegable donde un usuario puede analizar su perfil de Chess.com, leer su diagnóstico pedagógico y resolver sus propios fallos tácticos en el tablero interactivo.

