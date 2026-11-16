"use client";

import React from "react";
import { ClockPsychology } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { cn } from "@/lib/cn";
import { Clock, Zap, AlertTriangle, Scale, Brain } from "lucide-react";

const VERDICT: Record<ClockPsychology["primary_flaw"], { title: string; text: string; tone: string }> = {
  impulsive_play: {
    title: "Juegas demasiado rápido cuando más importa",
    text: "Tus blunders llegan con tiempo de sobra en el reloj. No es falta de tiempo: es falta de una pausa antes de mover.",
    tone: "border-rose-500/30 from-rose-500/10 text-rose-100",
  },
  time_trouble_panic: {
    title: "El reloj te gana las partidas",
    text: "Tus errores graves se concentran con pocos segundos. Gasta menos en la apertura para llegar con reserva al final.",
    tone: "border-amber-500/30 from-amber-500/10 text-amber-100",
  },
  none: {
    title: "Gestionas bien el reloj",
    text: "No hay un patrón claro de impulsividad ni de apuro de tiempo. Tus errores vienen de la posición, no del reloj.",
    tone: "border-emerald-500/30 from-emerald-500/10 text-emerald-100",
  },
};

export const ClockVsErrorChart: React.FC<{ clockData: ClockPsychology }> = ({ clockData }) => {
  const verdict = VERDICT[clockData.primary_flaw] ?? VERDICT.none;
  const good = clockData.avg_time_on_good_moves_seconds;
  const bad = clockData.avg_time_on_blunders_seconds;
  const max = Math.max(good, bad, 1);

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeader
        icon={Clock}
        eyebrow="Psicología del reloj"
        title="Cuánto piensas antes de fallar"
        subtitle="Cruzamos el tiempo que gastaste en cada jugada con la gravedad del error."
      />

      <div className={cn("mt-6 flex gap-3 rounded-2xl border bg-gradient-to-r to-transparent p-4", verdict.tone)}>
        <Brain className="mt-0.5 h-5 w-5 shrink-0 opacity-80" aria-hidden />
        <div>
          <div className="font-display text-lg font-semibold">{verdict.title}</div>
          <p className="mt-0.5 text-sm opacity-80">{verdict.text}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          compact
          label="Blunders impulsivos (≤ 3 s)"
          value={clockData.blunders_under_3s_with_ample_time}
          icon={Zap}
          tone="rose"
          hint="Con tiempo de sobra en el reloj"
        />
        <StatTile
          compact
          label="Blunders en apuro (< 10 s)"
          value={clockData.blunders_in_time_trouble_under_10s}
          icon={AlertTriangle}
          tone="amber"
          hint="Bajo presión extrema"
        />
        <StatTile
          compact
          label="Tiempo en blunder vs. buena"
          value={clockData.blunder_time_ratio}
          decimals={2}
          suffix="×"
          icon={Scale}
          tone="cyan"
          hint={clockData.blunder_time_ratio < 1 ? "Piensas menos justo cuando fallas" : "Piensas más cuando fallas"}
        />
      </div>

      <div className="mt-5 space-y-4 rounded-2xl border border-ink-600/60 bg-ink-900/60 p-4 sm:p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-ivory-faint">Tiempo medio por jugada</div>
        <TimeBar label="Jugadas buenas" seconds={good} max={max} color="bg-emerald-400" />
        <TimeBar label="Jugadas con blunder" seconds={bad} max={max} color="bg-rose-400" />
      </div>
    </Card>
  );
};

function TimeBar({ label, seconds, max, color }: { label: string; seconds: number; max: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-ivory-muted">{label}</span>
        <span className="num font-semibold text-ivory">{seconds}s</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink-750">
        <div
          className={cn("h-full origin-left animate-[grow_0.9s_cubic-bezier(0.2,0.7,0.2,1)_both] rounded-full", color)}
          style={{ width: `${(seconds / max) * 100}%` }}
        />
      </div>
    </div>
  );
}
