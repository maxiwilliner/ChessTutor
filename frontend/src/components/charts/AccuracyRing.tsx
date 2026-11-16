"use client";

import React from "react";
import { useCountUp } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Anillo de precisión (0-100) con color según nivel. */
export function AccuracyRing({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value, 1100, 1);
  const r = 42;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? "#34D399" : value >= 60 ? "#DDB463" : "#FB7185";
  return (
    <div className={cn("relative h-28 w-28 shrink-0", className)} role="img" aria-label={`Precisión ${value} sobre 100`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1F2733" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, animated) / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-xl font-semibold text-ivory sm:text-2xl">{animated.toFixed(1)}</span>
        <span className="text-[9px] uppercase tracking-wider text-ivory-faint sm:text-[10px]">precisión</span>
      </div>
    </div>
  );
}
