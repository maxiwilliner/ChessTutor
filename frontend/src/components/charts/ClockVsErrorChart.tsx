"use client";

import React from "react";
import { ClockBucket, ClockPsychology, FastVsThought, TimeByPhase, TimeEndings } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { CLOCK_BUCKET_LABEL, PHASE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Clock, Zap, AlertTriangle, Brain, Hourglass, Timer, TimerOff, Trophy } from "lucide-react";

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
    title: "No hay un patrón claro de reloj",
    text: "Ni impulsividad ni apuro de tiempo destacan. Abajo tienes cómo cambia tu juego según el reloj.",
    tone: "border-emerald-500/30 from-emerald-500/10 text-emerald-100",
  },
};

/** Por debajo de esto, el % de un tramo es poco fiable. */
const MIN_BUCKET_MOVES = 5;
const PHASE_BAR: Record<keyof TimeByPhase, string> = {
  opening: "bg-[#67E8F9]",
  middlegame: "bg-[#DDB463]",
  endgame: "bg-[#A78BFA]",
};

const pct = (n: number) => `${n.toLocaleString("es", { maximumFractionDigits: 1 })} %`;

export const ClockVsErrorChart: React.FC<{ clockData: ClockPsychology }> = ({ clockData }) => {
  const verdict = VERDICT[clockData.primary_flaw] ?? VERDICT.none;
  const { error_rate_by_clock: buckets, fast_vs_thought: speed, time_by_phase: phases, time_endings: endings } = clockData;
  const hasDetail = !!(buckets && speed && phases && endings);

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeader
        icon={Clock}
        eyebrow="Psicología del reloj"
        title="El reloj y tus errores"
        subtitle="Cuándo fallas según el tiempo que te queda, cómo lo repartes y si pensar más te ayuda."
      />

      <div className={cn("mt-6 flex gap-3 rounded-2xl border bg-gradient-to-r to-transparent p-4", verdict.tone)}>
        <Brain className="mt-0.5 h-5 w-5 shrink-0 opacity-80" aria-hidden />
        <div>
          <div className="font-display text-lg font-semibold">{verdict.title}</div>
          <p className="mt-0.5 text-sm opacity-80">{verdict.text}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatTile
          compact
          label="Blunders impulsivos"
          value={clockData.blunders_under_3s_with_ample_time}
          icon={Zap}
          tone="rose"
          hint="Al instante, con tiempo de sobra"
        />
        <StatTile
          compact
          label="Blunders en apuro"
          value={clockData.blunders_in_time_trouble_under_10s}
          icon={AlertTriangle}
          tone="amber"
          hint="Con el reloj casi agotado"
        />
      </div>

      {!hasDetail ? (
        <p className="mt-5 rounded-xl border border-ink-600/60 bg-ink-900/60 p-4 text-sm text-ivory-faint">
          Vuelve a analizar tus partidas para ver cuándo fallas según el reloj y cómo repartes el tiempo.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ErrorsByClock buckets={buckets!} />
          <FastVsThoughtPanel speed={speed!} impulsive={clockData.primary_flaw === "impulsive_play"} />
          <TimeByPhasePanel phases={phases!} />
          <TimeEndingsPanel endings={endings!} />
        </div>
      )}
    </Card>
  );
};

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-600/60 bg-ink-900/60 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ivory">
        <Icon className="h-4 w-4 text-amber-300" aria-hidden />
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ErrorsByClock({ buckets }: { buckets: ClockBucket[] }) {
  const reliable = buckets.filter((b) => b.moves >= MIN_BUCKET_MOVES);
  const pool = reliable.length ? reliable : buckets.filter((b) => b.moves > 0);
  const worst = pool.reduce<ClockBucket | null>((w, b) => (!w || b.error_rate > w.error_rate ? b : w), null);
  const full = buckets.find((b) => b.bucket === "gt50");
  // La escala solo cuenta los tramos con muestra suficiente: un 2 de 2 no debe dominar el gráfico
  const max = Math.max(...pool.map((b) => b.error_rate), 1);
  const ratio = worst && full && full.error_rate > 0 && worst.bucket !== "gt50" && full.moves >= MIN_BUCKET_MOVES ? worst.error_rate / full.error_rate : 0;

  return (
    <Panel title="Cuándo fallas" icon={Hourglass}>
      <p className="-mt-2 mb-3 text-xs text-ivory-faint">% de jugadas con error grave según el reloj que te quedaba.</p>
      <ul className="space-y-3">
        {buckets.map((b) => {
          const isWorst = worst?.bucket === b.bucket && b.error_rate > 0;
          const small = b.moves < MIN_BUCKET_MOVES;
          return (
            <li key={b.bucket}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className={cn("whitespace-nowrap", isWorst ? "font-semibold text-ivory" : "text-ivory-muted")}>
                  {CLOCK_BUCKET_LABEL[b.bucket]}
                </span>
                <strong className={cn("num text-sm", isWorst ? "text-rose-300" : small ? "text-ivory-faint" : "text-ivory")}>
                  {b.moves === 0 ? "—" : pct(b.error_rate)}
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-750">
                <div
                  className={cn("h-full rounded-full", isWorst ? "bg-rose-400" : small ? "bg-ink-500" : "bg-amber-400/70")}
                  style={{ width: `${Math.min(100, (b.error_rate / max) * 100)}%` }}
                />
              </div>
              <div className="num mt-0.5 text-[11px] text-ivory-faint">
                {b.moves === 0 ? "sin jugadas" : `${b.serious_errors} de ${b.moves} jugadas${small ? " · poca muestra" : ""}`}
              </div>
            </li>
          );
        })}
      </ul>
      {ratio >= 1.5 && worst && (
        <p className="mt-4 text-sm text-ivory-muted">
          Con <strong className="text-ivory">{CLOCK_BUCKET_LABEL[worst.bucket].toLowerCase()}</strong> del reloj cometes{" "}
          <strong className="num text-rose-300">{ratio.toLocaleString("es", { maximumFractionDigits: 1 })}×</strong> más errores graves que con
          el reloj lleno.
        </p>
      )}
    </Panel>
  );
}

function FastVsThoughtPanel({ speed, impulsive }: { speed: FastVsThought; impulsive: boolean }) {
  const { fast, thought } = speed;
  const enough = fast.moves >= MIN_BUCKET_MOVES && thought.moves >= MIN_BUCKET_MOVES;
  const fastWorse = enough && fast.accuracy < thought.accuracy - 3;
  const secs = (s: number) => `${s.toLocaleString("es", { maximumFractionDigits: 1 })} s`;

  return (
    <Panel title="¿Pensar te ayuda?" icon={Timer}>
      <div className="grid grid-cols-2 gap-3">
        <SpeedTile label="Jugadas rápidas" sub={`${secs(speed.fast_threshold_seconds)} o menos`} data={fast} tone={fastWorse ? "rose" : "neutral"} />
        <SpeedTile label="Jugadas pensadas" sub={`${secs(speed.thought_threshold_seconds)} o más`} data={thought} tone="neutral" />
      </div>
      <p className="mt-4 text-sm text-ivory-muted">
        {!enough
          ? "Aún hay pocas jugadas de cada tipo para compararlas."
          : fastWorse
            ? "Tus jugadas rápidas son claramente menos precisas: antes de mover, tómate unos segundos para mirar jaques, capturas y amenazas."
            : impulsive
              ? "En conjunto tus jugadas rápidas son precisas, pero los blunders impulsivos de arriba muestran que, cuando fallas rápido, el error es grave: frena en las posiciones tensas."
              : "Tus jugadas rápidas son fiables. Las pensadas suelen ser las posiciones difíciles, por eso su precisión es menor: ahí se decide la partida."}
      </p>
      <p className="mt-2 text-[11px] text-ivory-faint">Sin contar las 8 primeras jugadas (teoría de apertura).</p>
    </Panel>
  );
}

function SpeedTile({ label, sub, data, tone }: { label: string; sub: string; data: { moves: number; accuracy: number }; tone: "rose" | "neutral" }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800/60 p-3">
      <div className="text-xs font-medium text-ivory-faint">{label}</div>
      <div className={cn("num mt-1 text-2xl font-semibold", tone === "rose" ? "text-rose-300" : "text-ivory")}>
        {data.moves ? pct(data.accuracy) : "—"}
      </div>
      <div className="mt-0.5 text-[11px] text-ivory-faint">
        precisión · {sub} · {data.moves} jug.
      </div>
    </div>
  );
}

function TimeByPhasePanel({ phases }: { phases: TimeByPhase }) {
  const keys = ["opening", "middlegame", "endgame"] as const;
  const total = keys.reduce((s, k) => s + phases[k], 0);
  const scale = Math.max(100, total);

  return (
    <Panel title="Dónde gastas el tiempo" icon={Clock}>
      <p className="-mt-2 mb-3 text-xs text-ivory-faint">% del tiempo inicial que gastas en cada fase, de media por partida.</p>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-ink-750" role="img" aria-label="Tiempo gastado por fase">
        {keys.map((k) => phases[k] > 0 && <div key={k} className={PHASE_BAR[k]} style={{ width: `${(phases[k] / scale) * 100}%` }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {keys.map((k) => (
          <li key={k}>
            <span className="flex items-center gap-1.5 text-ivory-faint">
              <span className={cn("h-2 w-2 rounded-full", PHASE_BAR[k])} aria-hidden />
              {PHASE_LABEL[k]}
            </span>
            <span className="num mt-0.5 block text-sm font-semibold text-ivory">{pct(phases[k])}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ivory-muted">
        {phases.opening >= 30
          ? "Gastas casi un tercio del reloj o más en la apertura: conocer mejor tu repertorio te dejaría más tiempo para el medio juego."
          : total < 50
            ? "Te sobra bastante reloj: en las posiciones críticas puedes permitirte pensar más."
            : "Repartes el tiempo de forma razonable entre las fases."}
      </p>
    </Panel>
  );
}

function TimeEndingsPanel({ endings }: { endings: TimeEndings }) {
  return (
    <Panel title="El reloj al final" icon={TimerOff}>
      <div className="grid grid-cols-3 gap-2">
        <EndingTile
          value={endings.games_low_clock}
          label="con menos del 10 % del reloj"
          sub={`de ${endings.games_with_clock}`}
          tone={endings.games_low_clock / Math.max(endings.games_with_clock, 1) >= 0.3 ? "text-amber-300" : "text-ivory"}
        />
        <EndingTile value={endings.lost_on_time} label="derrotas por tiempo" tone={endings.lost_on_time ? "text-rose-300" : "text-ivory"} />
        <EndingTile value={endings.won_on_time} label="victorias por tiempo" tone={endings.won_on_time ? "text-emerald-300" : "text-ivory"} icon />
      </div>
      <p className="mt-4 text-sm text-ivory-muted">
        {endings.lost_on_time > endings.won_on_time
          ? "Pierdes más partidas por tiempo de las que ganas: el reloj te está costando puntos."
          : endings.won_on_time > 0
            ? "El reloj juega a tu favor: ganas más partidas por tiempo de las que pierdes."
            : "El reloj no está decidiendo tus partidas."}
      </p>
    </Panel>
  );
}

function EndingTile({ value, label, sub, tone, icon }: { value: number; label: string; sub?: string; tone: string; icon?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800/60 p-3">
      <div className={cn("num flex items-center gap-1 text-2xl font-semibold", tone)}>
        {value}
        {sub && <span className="text-xs font-medium text-ivory-faint">{sub}</span>}
        {icon && value > 0 && <Trophy className="h-3.5 w-3.5" aria-hidden />}
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-ivory-faint">{label}</div>
    </div>
  );
}
