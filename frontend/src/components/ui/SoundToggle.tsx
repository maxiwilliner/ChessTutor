"use client";

import React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useSoundOn } from "@/lib/sound";
import { buttonClasses } from "./Button";

/** Activa o silencia los sonidos del tablero (se recuerda en este navegador). */
export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useSoundOn();
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Silenciar sonidos" : "Activar sonidos"}
      title={on ? "Silenciar sonidos" : "Activar sonidos"}
      className={buttonClasses("secondary", "md", `w-10 px-0 ${className ?? ""}`)}
    >
      {on ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4 text-ivory-faint" aria-hidden />}
    </button>
  );
}
