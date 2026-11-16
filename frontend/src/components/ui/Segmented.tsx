"use client";

import React, { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Ocupa todo el ancho repartiendo las opciones. */
  stretch?: boolean;
}

/** Control segmentado accesible (radiogroup con flechas del teclado). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  size = "md",
  className,
  stretch,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const next = (idx + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-2xl border border-ink-600 bg-ink-900/80 p-1",
        stretch && "flex w-full",
        className
      )}
    >
      {options.map((opt, idx) => {
        const selected = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={String(opt.value)}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
              size === "md" ? "min-h-10 px-3.5 py-2 text-sm" : "min-h-8 px-3 py-1.5 text-xs",
              stretch && "flex-1",
              selected
                ? "bg-brass-400 text-ink-950 shadow-[0_6px_18px_-8px_rgba(221,180,99,0.7)]"
                : "text-ivory-muted hover:bg-ink-750 hover:text-ivory"
            )}
          >
            {Icon && <Icon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />}
            <span className="flex flex-col items-start leading-tight">
              <span>{opt.label}</span>
              {opt.hint && (
                <span className={cn("text-[10px] font-medium", selected ? "text-ink-800" : "text-ivory-faint")}>
                  {opt.hint}
                </span>
              )}
            </span>
            {opt.badge}
          </button>
        );
      })}
    </div>
  );
}
