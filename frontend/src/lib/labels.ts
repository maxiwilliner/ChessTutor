/**
 * Claves, iconos y enlaces de los temas tácticos. Los textos están en los diccionarios (`m.labels`):
 * usa `themeMeta(key, m)` / `themeLabel(key, m)`. Nunca `replace("_", " ")`.
 */
import type { LucideIcon } from "lucide-react";
import { ShieldOff, Pin, GitFork, Crown, Castle, Crosshair } from "lucide-react";
import type { Messages } from "@/lib/i18n/messages";

export interface ThemeMeta {
  key: string;
  label: string;
  short: string;
  description: string;
  icon: LucideIcon;
}

/** Temas tácticos que produce `backend/app/modules/heuristics/tactical.py`, en orden de presentación. */
export const THEME_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: "hanging_piece", icon: ShieldOff },
  { key: "pin_exploitation", icon: Pin },
  { key: "fork_overlooked", icon: GitFork },
  { key: "missed_mate", icon: Crown },
  { key: "king_safety_collapse", icon: Castle },
  { key: "tactical_inaccuracy", icon: Crosshair },
];

/** Temas que se ofrecen como filtro en el entrenador (la imprecisión genérica no es un filtro). */
export const TRAINER_THEMES = THEME_ICONS.filter((t) => t.key !== "tactical_inaccuracy");

const humanize = (key: string) => {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function themeMeta(key: string | null | undefined, m: Messages): ThemeMeta {
  const k = key ?? "";
  const text = m.labels.themes[k];
  const icon = THEME_ICONS.find((t) => t.key === k)?.icon ?? Crosshair;
  if (text) return { key: k, icon, ...text };
  if (k === "none") return { key: k, icon, label: m.labels.none, short: m.labels.none, description: "" };
  const fallback = k ? humanize(k) : m.labels.unknown;
  return { key: k, icon, label: fallback, short: fallback, description: "" };
}

export const themeLabel = (key: string | null | undefined, m: Messages) => themeMeta(key, m).label;

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type TrainerMode = "all" | "leak" | "impulse" | "theme";

/**
 * Traduce un flag algorítmico del diagnóstico al filtro del entrenador que lo trabaja (ruta sin idioma:
 * envuélvela con `path()` de `useI18n`). Los códigos salen de `assemble_diagnosis_and_puzzles` en `aggregator.py`.
 */
export function trainerHrefForFlag(flagCode: string | undefined, username: string): string {
  const base = `/trainer?username=${encodeURIComponent(username)}`;
  if (!flagCode) return base;
  if (flagCode === "HANGING_PIECES") return `${base}&mode=theme&theme=hanging_piece`;
  if (flagCode === "IMPULSIVE_MOVE_SELECTION") return `${base}&mode=impulse`;
  return `${base}&mode=leak`;
}
