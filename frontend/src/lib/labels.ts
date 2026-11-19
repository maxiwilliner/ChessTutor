import type { LucideIcon } from "lucide-react";
import { ShieldOff, Pin, GitFork, Crown, Castle, Crosshair } from "lucide-react";

export interface ThemeMeta {
  key: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

/** Temas tácticos que produce `backend/app/modules/heuristics/tactical.py`. */
export const THEMES: ThemeMeta[] = [
  { key: "hanging_piece", label: "Piezas colgadas", short: "Colgadas", icon: ShieldOff },
  { key: "pin_exploitation", label: "Clavadas tácticas", short: "Clavadas", icon: Pin },
  { key: "fork_overlooked", label: "Ataques dobles", short: "Horquillas", icon: GitFork },
  { key: "missed_mate", label: "Mates omitidos", short: "Mates", icon: Crown },
  { key: "king_safety_collapse", label: "Seguridad del rey", short: "Rey", icon: Castle },
  { key: "tactical_inaccuracy", label: "Imprecisión táctica", short: "Imprecisión", icon: Crosshair },
];

/** Temas que se ofrecen como filtro en el entrenador. */
export const TRAINER_THEMES = THEMES.filter((t) => t.key !== "tactical_inaccuracy");

const humanize = (key: string) => {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function themeMeta(key: string | null | undefined): ThemeMeta {
  const found = THEMES.find((t) => t.key === key);
  return found ?? { key: key ?? "", label: humanize(key ?? "Desconocido"), short: humanize(key ?? "?"), icon: Crosshair };
}

export const themeLabel = (key: string | null | undefined) => themeMeta(key).label;

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export const PHASE_LABEL: Record<string, string> = {
  opening: "Apertura",
  middlegame: "Medio juego",
  endgame: "Final",
};

export const PSYCH_LABEL: Record<string, string> = {
  impulsive: "Impulsiva",
  time_trouble: "Apuro de tiempo",
  normal: "Normal",
};

export const TIME_CLASS_LABEL: Record<string, string> = {
  rapid: "Rápidas",
  blitz: "Blitz",
  bullet: "Bullet",
  daily: "Diarias",
};

export type TrainerMode = "all" | "leak" | "impulse" | "theme";

/**
 * Traduce un flag algorítmico del diagnóstico al filtro del entrenador que lo trabaja.
 * Los códigos salen de `assemble_diagnosis_and_puzzles` en `aggregator.py`.
 */
export function trainerHrefForFlag(flagCode: string | undefined, username: string): string {
  const base = `/trainer?username=${encodeURIComponent(username)}`;
  if (!flagCode) return base;
  if (flagCode === "HANGING_PIECES") return `${base}&mode=theme&theme=hanging_piece`;
  if (flagCode === "IMPULSIVE_MOVE_SELECTION") return `${base}&mode=impulse`;
  return `${base}&mode=leak`;
}

/** Cómo terminó una partida (`termination` del parser). */
export const TERMINATION_LABEL: Record<string, string> = {
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
};

export const RESULT_LABEL: Record<"win" | "draw" | "loss", string> = { win: "Victoria", draw: "Tablas", loss: "Derrota" };

/** Tramos del reloj (% del tiempo inicial que quedaba antes de mover). */
export const CLOCK_BUCKET_LABEL: Record<string, string> = {
  gt50: "Más del 50 %",
  "25_50": "25–50 %",
  "10_25": "10–25 %",
  lt10: "Menos del 10 %",
};
