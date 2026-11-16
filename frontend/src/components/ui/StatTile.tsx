"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useCountUp } from "@/lib/motion";
import { TONE_TEXT, type Tone } from "./Badge";

interface StatTileProps {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
  compact?: boolean;
  style?: React.CSSProperties;
}

export function StatTile({
  label,
  value,
  decimals = 0,
  suffix,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
  compact,
  style,
}: StatTileProps) {
  const animated = useCountUp(value, 900, decimals);
  return (
    <div
      style={style}
      className={cn(
        "animate-fade-up rounded-2xl border border-ink-600/70 bg-ink-800/70 shadow-card",
        compact ? "p-3.5" : "p-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-ivory-faint">
        <span>{label}</span>
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])} aria-hidden />}
      </div>
      <div className={cn("num mt-1 font-semibold tracking-tight", compact ? "text-xl" : "text-3xl", TONE_TEXT[tone])}>
        {animated.toLocaleString("es", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {suffix && <span className="ml-0.5 text-[0.6em] font-medium text-ivory-faint">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-snug text-ivory-faint">{hint}</div>}
    </div>
  );
}
