"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

interface EvalBarProps {
  /** Evaluación en peones desde la perspectiva de las blancas. */
  evalWhite: number;
  orientation: "white" | "black";
  className?: string;
}

/** Probabilidad aproximada de victoria de las blancas (curva estándar sobre centipeones). */
function whiteShare(pawns: number) {
  const cp = Math.max(-2000, Math.min(2000, pawns * 100));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function formatEval(pawns: number) {
  if (Math.abs(pawns) >= 90) return "M";
  const abs = Math.abs(pawns);
  return abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
}

/** Barra vertical de evaluación. Las blancas ocupan el lado de su orientación. */
export function EvalBar({ evalWhite, orientation, className }: EvalBarProps) {
  const { m } = useI18n();
  const share = whiteShare(evalWhite);
  const whiteAtBottom = orientation === "white";
  const whiteWinning = evalWhite >= 0;
  const label = formatEval(evalWhite);

  return (
    <div
      role="meter"
      aria-label={m.trainer.replay.evalBar}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share)}
      aria-valuetext={`${whiteWinning ? m.trainer.replay.white : m.trainer.replay.black} ${whiteWinning ? "+" : "−"}${label}`}
      className={cn(
        "relative flex w-3.5 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-950 sm:w-5",
        whiteAtBottom ? "flex-col-reverse" : "flex-col",
        className
      )}
    >
      <div
        className="w-full bg-gradient-to-b from-[#f6f1e7] to-[#ddd3c1] transition-[height] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
        style={{ height: `${share}%` }}
      />
      <span
        className={cn(
          "num pointer-events-none absolute inset-x-0 hidden text-center text-[9px] font-bold sm:block",
          // la etiqueta va en el extremo del bando que gana
          whiteWinning === whiteAtBottom ? "bottom-1" : "top-1",
          whiteWinning ? "text-ink-900" : "text-ivory"
        )}
      >
        {label}
      </span>
    </div>
  );
}
