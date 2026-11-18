"use client";

import { useEffect, useState } from "react";

export interface SessionStats {
  streak: number;
  attempts: number;
  firstTry: number;
  avoided: number;
}

const EMPTY: SessionStats = { streak: 0, attempts: 0, firstTry: 0, avoided: 0 };
const keyFor = (username: string) => `chesstutor_session_${username.toLowerCase()}_${new Date().toISOString().slice(0, 10)}`;

/** Estadísticas de la sesión de entrenamiento del día (sobreviven a recargar; se reinician cada día). */
export function useSessionStats(username: string): [SessionStats, (update: (s: SessionStats) => SessionStats) => void] {
  const [stats, setStats] = useState<SessionStats>(EMPTY);

  useEffect(() => {
    if (!username) return;
    try {
      const raw = window.localStorage.getItem(keyFor(username));
      setStats(raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY);
    } catch {
      setStats(EMPTY);
    }
  }, [username]);

  const update = (fn: (s: SessionStats) => SessionStats) =>
    setStats((prev) => {
      const next = fn(prev);
      try {
        window.localStorage.setItem(keyFor(username), JSON.stringify(next));
      } catch {
        // sin almacenamiento: dura la pestaña
      }
      return next;
    });

  return [stats, update];
}
