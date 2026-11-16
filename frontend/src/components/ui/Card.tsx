import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "raised" | "inset";
};

export function Card({ tone = "default", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        tone === "default" && "border-ink-600/70 bg-ink-800/70 shadow-card",
        tone === "raised" && "border-ink-600 bg-ink-750 shadow-card",
        tone === "inset" && "border-ink-600/50 bg-ink-900/70",
        className
      )}
      {...props}
    />
  );
}

interface SectionHeaderProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  id?: string;
}

export function SectionHeader({ icon: Icon, eyebrow, title, subtitle, actions, className, id }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-400">
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {eyebrow}
          </div>
        )}
        <h2 id={id} className="font-display text-xl font-semibold text-ivory sm:text-2xl">
          {!eyebrow && Icon && <Icon className="mr-2 inline h-5 w-5 -translate-y-0.5 text-brass-400" aria-hidden />}
          {title}
        </h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ivory-faint">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-ink-750", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}
