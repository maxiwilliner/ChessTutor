"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "chesstutor_last_username";
const EVENT = "chesstutor:last-username";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Último usuario de Chess.com analizado, guardado en localStorage.
 * Se lee tras el montaje (evita desajustes de hidratación) y se sincroniza entre componentes y pestañas.
 * Devuelve `undefined` mientras no se ha leído y `null` si no hay usuario guardado.
 */
export function useLastUsername(): [string | null | undefined, (u: string) => void] {
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setUsername(read());
    const sync = () => setUsername(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((u: string) => {
    const clean = u.trim();
    if (!clean) return;
    try {
      window.localStorage.setItem(KEY, clean);
    } catch {
      // almacenamiento no disponible (modo privado, etc.)
    }
    setUsername(clean);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [username, save];
}
