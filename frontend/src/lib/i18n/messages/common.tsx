/** Textos compartidos: navegación, pie, demo, errores, progreso del análisis y etiquetas. */
import type { ReactNode } from "react";
import type { ErrorParams } from "@/lib/errors";

/** Para textos con partes destacadas: el componente decide cómo se pintan. */
export type Rich = (text: ReactNode) => ReactNode;

const PACE_EN: Record<string, string> = { rapid: "rapid", blitz: "blitz", bullet: "bullet", daily: "daily" };
const PACE_ES: Record<string, string> = { rapid: "rápidas", blitz: "de blitz", bullet: "de bullet", daily: "diarias" };

const en = {
  meta: {
    title: "ChessTutor · Your personal chess coach",
    shareTitle: "ChessTutor · Stop repeating the same mistakes",
    tagline:
      "Analyze your Chess.com games with Stockfish, find the 3 leaks costing you the most Elo, and train the exact positions where you went wrong.",
    ogAlt: "ChessTutor: stop repeating the same mistakes. Your Chess.com games analyzed with Stockfish.",
    dashboardTitle: "Diagnosis",
    dashboardDescription: "Your 3 biggest Elo leaks, how your games were decided, clock psychology and your opening repertoire.",
    trainerTitle: "Trainer",
    trainerDescription: "Solve the real positions where you blundered, with progressive hints and spaced repetition.",
    privacyTitle: "Privacy",
    privacyDescription: "What data ChessTutor uses, where it's stored and how to delete it.",
    notFoundTitle: "Page not found",
  },
  nav: {
    main: "Main",
    home: "Home",
    dashboard: "Diagnosis",
    trainer: "Trainer",
    homeAria: "ChessTutor, home",
    skipToContent: "Skip to content",
  },
  lang: {
    label: "Language",
  },
  footer: {
    about: "ChessTutor · Analysis with Stockfish · Public Chess.com data · Not affiliated with Chess.com",
    privacy: "Privacy",
  },
  feedback: { label: "Give us feedback" },
  sound: { mute: "Mute sounds", unmute: "Turn sounds on" },
  actions: { retry: "Try again", close: "Close", cancel: "Cancel", reload: "Reload", backHome: "Back to home" },
  demo: {
    bannerLong: (b: Rich) => (
      <>
        {b("Free demo.")} The analysis runs in your browser and your data is stored only here: no server, no accounts.
      </>
    ),
    bannerShort: (b: Rich) => <>{b("Free demo")} · your data stays in this browser</>,
    notPersistent: (b: Rich) => (
      <>
        {b("Your browser doesn't allow saving data")} (private mode?). You can use the demo, but your analysis and progress will be
        lost when you close the tab.
      </>
    ),
    export: "Export my data",
    clear: "Delete my data from this browser",
    confirmClear: "Delete all your analyses, exercises and progress from this browser? This can't be undone.",
    cleared: "Data deleted.",
    exportFile: "chesstutor-data.json",
    engine: "Engine:",
    source: "source code",
  },
  errors: {
    unexpected: () => "Unexpected error during the analysis.",
    invalid_username: () => "That doesn't look like a valid Chess.com username (3–25 letters, numbers, “_” or “-”).",
    user_not_found: (p: ErrorParams) => `There's no Chess.com user called “${p.username}”. Check the spelling.`,
    offline: () => "You seem to be offline. Reconnect and try again.",
    chesscom_network: () => "Couldn't reach Chess.com. Try again in a minute.",
    chesscom_rate_limited: () => "Chess.com is rate-limiting requests. Wait a minute and try again.",
    chesscom_server: (p: ErrorParams) => `Chess.com returned an error (${p.status}). Try again in a few minutes.`,
    no_games: (p: ErrorParams) =>
      `${p.username} has no recent ${PACE_EN[String(p.timeClass)] ?? p.timeClass} games on Chess.com. Try another time control.`,
    engine_start: () =>
      "The analysis engine couldn't start in your browser. Try an up-to-date browser (Chrome, Firefox, Safari or Edge).",
    engine_timeout: () => "The analysis engine stopped responding. Reload the page and try again.",
    engine_stopped: () => "The analysis engine was stopped.",
    analysis_locked: () =>
      "There's already an analysis running in another tab. Wait for it to finish, or close it and try again.",
    storage_full: () =>
      "Your browser is out of space to save the analysis. Free up space or delete the demo data (at the bottom of the page).",
    no_analysis: () => "There's no saved analysis for this user in this browser.",
    analysis_outdated: () =>
      "We've improved the analysis since your last visit: analyze your games again (your exercise progress is kept).",
    no_puzzles: () => "No exercises yet: analyze your games first.",
    backend_unreachable: () => "Couldn't connect to the analysis server. Check that the backend is running.",
    stats_failed: () => "Couldn't load the trainer stats.",
    attempt_failed: () => "Couldn't save the attempt.",
    evaluate_failed: () => "Couldn't evaluate that move.",
    report_failed: () => "Couldn't generate the coach's report.",
  },
  progress: {
    stages: {
      fetching_games: "Downloading games",
      evaluating: "Stockfish evaluates every move",
      classifying: "Classifying mistakes",
      complete: "Report ready",
    },
    connecting: (u: string) => `Connecting to Chess.com for ${u}…`,
    fetching: (u: string) => `Downloading ${u}'s recent games…`,
    searchingMonth: (u: string, month: string) => `Looking for ${u}'s games in ${month}…`,
    evaluatingStart: (total: number) => `Analyzing ${total} games with Stockfish…`,
    evaluatingGame: (i: number, total: number, players?: [string, string]) =>
      `Evaluating game ${i} of ${total}${players ? ` (${players[0]} vs ${players[1]})` : ""}…`,
    classifying: "Classifying tactical errors, openings and clock psychology…",
    complete: "Analysis complete.",
    keepOpen: "Keep this tab open and the screen on: if you switch apps, your phone pauses the analysis.",
  },
  labels: {
    themes: {
      hanging_piece: {
        label: "Hanging pieces",
        short: "Hanging",
        description: "Leaving your own pieces undefended, or grabbing poisoned pieces",
      },
      pin_exploitation: { label: "Pins", short: "Pins", description: "Missing pieces pinned to the king or to a more valuable piece" },
      fork_overlooked: { label: "Double attacks", short: "Forks", description: "Overlooked knight or queen double attacks" },
      missed_mate: { label: "Missed mates", short: "Mates", description: "Missing forced mates in 1 to 3 moves" },
      king_safety_collapse: {
        label: "King safety",
        short: "King",
        description: "King stuck in the center, or lines opened in front of your castled king",
      },
      tactical_inaccuracy: {
        label: "Tactical inaccuracy",
        short: "Inaccuracy",
        description: "Inaccurate calculation or unfavorable trades",
      },
    } as Record<string, { label: string; short: string; description: string }>,
    unknown: "Unknown",
    none: "—",
    severity: { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" } as Record<string, string>,
    phase: { opening: "Opening", middlegame: "Middlegame", endgame: "Endgame" } as Record<string, string>,
    psych: { impulsive: "Impulsive", time_trouble: "Time trouble", normal: "Normal" } as Record<string, string>,
    timeClass: { rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", daily: "Daily" } as Record<string, string>,
    termination: {
      checkmate: "Checkmate",
      resignation: "Resignation",
      timeout: "On time",
      abandoned: "Abandoned",
      agreement: "Draw agreed",
      repetition: "Repetition",
      stalemate: "Stalemate",
      insufficient: "Insufficient material",
      timeout_vs_insufficient: "Timeout vs. insufficient material",
      fifty_moves: "50-move rule",
      other: "Other ending",
    } as Record<string, string>,
    result: { win: "Win", draw: "Draw", loss: "Loss" } as Record<"win" | "draw" | "loss", string>,
    clockBucket: { gt50: "Over 50%", "25_50": "25–50%", "10_25": "10–25%", lt10: "Under 10%" } as Record<string, string>,
  },
  pages: {
    notFoundTitle: "This square is empty",
    notFoundText: "The page you're looking for doesn't exist or has moved.",
    errorTitle: "Something broke on this page",
    errorText: "Your analyses and progress are still saved. Try reloading; if it happens again, let us know.",
  },
};

const es: typeof en = {
  meta: {
    title: "ChessTutor · Tu profesor personal de ajedrez",
    shareTitle: "ChessTutor · Deja de repetir los mismos errores",
    tagline:
      "Analiza tus partidas de Chess.com con Stockfish, descubre las 3 fugas que más Elo te cuestan y entrena las posiciones exactas donde fallaste.",
    ogAlt: "ChessTutor: deja de repetir los mismos errores. Análisis de tus partidas de Chess.com con Stockfish.",
    dashboardTitle: "Diagnóstico",
    dashboardDescription: "Tus 3 fugas de Elo, cómo se decidieron tus partidas, la psicología del reloj y tu repertorio de aperturas.",
    trainerTitle: "Entrenador",
    trainerDescription: "Resuelve las posiciones reales donde cometiste blunders, con pistas progresivas y repetición espaciada.",
    privacyTitle: "Privacidad",
    privacyDescription: "Qué datos usa ChessTutor, dónde se guardan y cómo borrarlos.",
    notFoundTitle: "Página no encontrada",
  },
  nav: {
    main: "Principal",
    home: "Inicio",
    dashboard: "Diagnóstico",
    trainer: "Entrenador",
    homeAria: "ChessTutor, inicio",
    skipToContent: "Saltar al contenido",
  },
  lang: {
    label: "Idioma",
  },
  footer: {
    about: "ChessTutor · Análisis con Stockfish · Datos públicos de Chess.com · No afiliado a Chess.com",
    privacy: "Privacidad",
  },
  feedback: { label: "Danos tu opinión" },
  sound: { mute: "Silenciar sonidos", unmute: "Activar sonidos" },
  actions: { retry: "Reintentar", close: "Cerrar", cancel: "Cancelar", reload: "Recargar", backHome: "Volver al inicio" },
  demo: {
    bannerLong: (b: Rich) => (
      <>
        {b("Demo gratuita.")} El análisis se hace en tu navegador y tus datos se guardan solo aquí: no tenemos servidor ni cuentas.
      </>
    ),
    bannerShort: (b: Rich) => <>{b("Demo gratuita")} · tus datos se quedan en este navegador</>,
    notPersistent: (b: Rich) => (
      <>
        {b("Tu navegador no permite guardar datos")} (¿modo privado?). Puedes usar la demo, pero tu análisis y tu progreso se perderán
        al cerrar la pestaña.
      </>
    ),
    export: "Exportar mis datos",
    clear: "Borrar mis datos de este navegador",
    confirmClear: "¿Borrar todos tus análisis, ejercicios y progreso de este navegador? No se puede deshacer.",
    cleared: "Datos borrados.",
    exportFile: "chesstutor-datos.json",
    engine: "Motor:",
    source: "código fuente",
  },
  errors: {
    unexpected: () => "Error inesperado durante el análisis.",
    invalid_username: () => "Ese no parece un usuario válido de Chess.com (3-25 letras, números, «_» o «-»).",
    user_not_found: (p: ErrorParams) => `No existe el usuario «${p.username}» en Chess.com. Revisa cómo se escribe.`,
    offline: () => "Parece que no tienes conexión a internet. Conéctate y vuelve a intentarlo.",
    chesscom_network: () => "No se pudo contactar con Chess.com. Inténtalo de nuevo en un minuto.",
    chesscom_rate_limited: () => "Chess.com está limitando las peticiones. Espera un minuto y vuelve a intentarlo.",
    chesscom_server: (p: ErrorParams) => `Chess.com respondió con un error (${p.status}). Inténtalo de nuevo en unos minutos.`,
    no_games: (p: ErrorParams) =>
      `${p.username} no tiene partidas ${PACE_ES[String(p.timeClass)] ?? p.timeClass} recientes en Chess.com. Prueba con otro ritmo.`,
    engine_start: () =>
      "No se pudo iniciar el motor de análisis en tu navegador. Prueba con un navegador actualizado (Chrome, Firefox, Safari o Edge).",
    engine_timeout: () => "El motor de análisis dejó de responder. Recarga la página e inténtalo de nuevo.",
    engine_stopped: () => "Se detuvo el motor de análisis.",
    analysis_locked: () =>
      "Ya hay un análisis en marcha en otra pestaña. Espera a que termine o ciérrala y vuelve a intentarlo.",
    storage_full: () =>
      "Tu navegador no tiene espacio para guardar el análisis. Libera espacio o borra los datos de la demo (al pie de la página).",
    no_analysis: () => "No hay un análisis guardado para este usuario en este navegador.",
    analysis_outdated: () =>
      "Mejoramos el análisis desde tu última visita: vuelve a analizar tus partidas (tu progreso en los ejercicios se conserva).",
    no_puzzles: () => "No hay ejercicios: analiza primero tus partidas.",
    backend_unreachable: () =>
      "No se pudo conectar con el servidor de análisis. Comprueba que el backend esté en marcha.",
    stats_failed: () => "No se pudieron cargar las estadísticas del entrenador.",
    attempt_failed: () => "No se pudo registrar el intento.",
    evaluate_failed: () => "No se pudo evaluar esa jugada.",
    report_failed: () => "No se pudo generar el informe del profesor.",
  },
  progress: {
    stages: {
      fetching_games: "Descargando partidas",
      evaluating: "Stockfish evalúa cada jugada",
      classifying: "Clasificando errores",
      complete: "Informe listo",
    },
    connecting: (u: string) => `Conectando con Chess.com para ${u}…`,
    fetching: (u: string) => `Descargando partidas recientes de ${u}…`,
    searchingMonth: (u: string, month: string) => `Buscando partidas de ${u} en ${month}…`,
    evaluatingStart: (total: number) => `Analizando ${total} partidas con Stockfish…`,
    evaluatingGame: (i: number, total: number, players?: [string, string]) =>
      `Evaluando partida ${i} de ${total}${players ? ` (${players[0]} vs ${players[1]})` : ""}…`,
    classifying: "Clasificando errores tácticos, aperturas y psicología del reloj…",
    complete: "Análisis finalizado con éxito.",
    keepOpen: "Mantén esta pestaña abierta y la pantalla encendida: si cambias de app, el móvil pausa el análisis.",
  },
  labels: {
    themes: {
      hanging_piece: {
        label: "Piezas colgadas",
        short: "Colgadas",
        description: "Piezas propias dejadas sin defensa táctica o captura de piezas rivales envenenadas",
      },
      pin_exploitation: {
        label: "Clavadas tácticas",
        short: "Clavadas",
        description: "Fallo al detectar piezas clavadas al rey o a piezas de mayor valor",
      },
      fork_overlooked: { label: "Ataques dobles", short: "Horquillas", description: "Ataques dobles de caballo o dama desatendidos" },
      missed_mate: { label: "Mates omitidos", short: "Mates", description: "Omisión de secuencias forzadas de mate en 1 a 3 jugadas" },
      king_safety_collapse: {
        label: "Seguridad del rey",
        short: "Rey",
        description: "Rey atrapado en el centro o apertura de líneas frente al enroque",
      },
      tactical_inaccuracy: {
        label: "Imprecisión táctica",
        short: "Imprecisión",
        description: "Imprecisión en el cálculo posicional o intercambio desventajoso de material",
      },
    },
    unknown: "Desconocido",
    none: "—",
    severity: { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" },
    phase: { opening: "Apertura", middlegame: "Medio juego", endgame: "Final" },
    psych: { impulsive: "Impulsiva", time_trouble: "Apuro de tiempo", normal: "Normal" },
    timeClass: { rapid: "Rápidas", blitz: "Blitz", bullet: "Bullet", daily: "Diarias" },
    termination: {
      checkmate: "Jaque mate",
      resignation: "Abandono",
      timeout: "Por tiempo",
      abandoned: "Desconexión",
      agreement: "Tablas acordadas",
      repetition: "Repetición",
      stalemate: "Ahogado",
      insufficient: "Material insuficiente",
      timeout_vs_insufficient: "Tiempo sin material",
      fifty_moves: "Regla de 50 jugadas",
      other: "Otro final",
    },
    result: { win: "Victoria", draw: "Tablas", loss: "Derrota" },
    clockBucket: { gt50: "Más del 50 %", "25_50": "25–50 %", "10_25": "10–25 %", lt10: "Menos del 10 %" },
  },
  pages: {
    notFoundTitle: "Esta casilla está vacía",
    notFoundText: "La página que buscas no existe o ha cambiado de sitio.",
    errorTitle: "Algo se ha roto en esta página",
    errorText: "Tus análisis y tu progreso siguen guardados. Prueba a recargar; si vuelve a pasar, cuéntanoslo.",
  },
};

const common = { en, es };
export default common;
