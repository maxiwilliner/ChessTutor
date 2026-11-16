import React from "react";
import { cn } from "@/lib/cn";
import { SEVERITY_LABEL, type Severity } from "@/lib/labels";

export type Tone = "neutral" | "brass" | "emerald" | "rose" | "amber" | "cyan" | "violet";

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ivory-muted",
  brass: "text-brass-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
  amber: "text-amber-300",
  cyan: "text-cyan-300",
  violet: "text-violet-300",
};

const TONE_BADGE: Record<Tone, string> = {
  neutral: "border-ink-500 bg-ink-750 text-ivory-muted",
  brass: "border-brass-500/40 bg-brass-400/10 text-brass-300",
  emerald: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  rose: "border-rose-500/35 bg-rose-500/10 text-rose-300",
  amber: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  cyan: "border-cyan-500/35 bg-cyan-500/10 text-cyan-300",
  violet: "border-violet-500/35 bg-violet-500/10 text-violet-300",
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        TONE_BADGE[tone],
        className
      )}
      {...props}
    />
  );
}

export const SEVERITY_TONE: Record<Severity, Tone> = {
  CRITICAL: "rose",
  HIGH: "amber",
  MEDIUM: "cyan",
  LOW: "neutral",
};

/** Color de la franja lateral de una tarjeta según severidad. */
export const SEVERITY_STRIPE: Record<Severity, string> = {
  CRITICAL: "bg-rose-500",
  HIGH: "bg-amber-400",
  MEDIUM: "bg-cyan-400",
  LOW: "bg-ink-500",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity] ?? "neutral"} className="uppercase tracking-wider">
      {SEVERITY_LABEL[severity] ?? severity}
    </Badge>
  );
}
