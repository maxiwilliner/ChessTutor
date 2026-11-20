"use client";

import React from "react";
import { ClockBucket, ClockPsychology, FastVsThought, TimeByPhase, TimeEndings } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Clock, Zap, AlertTriangle, Brain, Hourglass, Timer, TimerOff, Trophy } from "lucide-react";

const VERDICT_TONE: Record<ClockPsychology["primary_flaw"], string> = {
  impulsive_play: "border-rose-500/30 from-rose-500/10 text-rose-100",
  time_trouble_panic: "border-amber-500/30 from-amber-500/10 text-amber-100",
  none: "border-emerald-500/30 from-emerald-500/10 text-emerald-100",
};

/** Por debajo de esto, el % de un tramo es poco fiable. */
const MIN_BUCKET_MOVES = 5;
const PHASE_BAR: Record<keyof TimeByPhase, string> = {
  opening: "bg-[#67E8F9]",
  middlegame: "bg-[#DDB463]",
  endgame: "bg-[#A78BFA]",
};

export const ClockVsErrorChart: React.FC<{ clockData: ClockPsychology }> = ({ clockData }) => {
  const { m } = useI18n();
  const t = m.dashboard.clock;
  const flaw = VERDICT_TONE[clockData.primary_flaw] ? clockData.primary_flaw : "none";
  const verdict = t.verdict[flaw];
  const { error_rate_by_clock: buckets, fast_vs_thought: speed, time_by_phase: phases, time_endings: endings } = clockData;
  const hasDetail = !!(buckets && speed && phases && endings);

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeader icon={Clock} eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

      <div className={cn("mt-6 flex gap-3 rounded-2xl border bg-gradient-to-r to-transparent p-4", VERDICT_TONE[flaw])}>
        <Brain className="mt-0.5 h-5 w-5 shrink-0 opacity-80" aria-hidden />
        <div>
          <div className="font-display text-lg font-semibold">{verdict.title}</div>
          <p className="mt-0.5 text-sm opacity-80">{verdict.text}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatTile compact label={t.impulsive} value={clockData.blunders_under_3s_with_ample_time} icon={Zap} tone="rose" hint={t.impulsiveHint} />
        <StatTile
          compact
          label={t.trouble}
          value={clockData.blunders_in_time_trouble_under_10s}
          icon={AlertTriangle}
          tone="amber"
          hint={t.troubleHint}
        />
      </div>

      {!hasDetail ? (
        <p className="mt-5 rounded-xl border border-ink-600/60 bg-ink-900/60 p-4 text-sm text-ivory-faint">{t.reanalyze}</p>
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
  const { m, fmt } = useI18n();
  const t = m.dashboard.clock;
  const label = (code: string) => m.labels.clockBucket[code] ?? code;
  const reliable = buckets.filter((b) => b.moves >= MIN_BUCKET_MOVES);
  const pool = reliable.length ? reliable : buckets.filter((b) => b.moves > 0);
  const worst = pool.reduce<ClockBucket | null>((w, b) => (!w || b.error_rate > w.error_rate ? b : w), null);
  const full = buckets.find((b) => b.bucket === "gt50");
  // La escala solo cuenta los tramos con muestra suficiente: un 2 de 2 no debe dominar el gráfico
  const max = Math.max(...pool.map((b) => b.error_rate), 1);
  const ratio = worst && full && full.error_rate > 0 && worst.bucket !== "gt50" && full.moves >= MIN_BUCKET_MOVES ? worst.error_rate / full.error_rate : 0;

  return (
    <Panel title={t.whenTitle} icon={Hourglass}>
      <p className="-mt-2 mb-3 text-xs text-ivory-faint">{t.whenText}</p>
      <ul className="space-y-3">
        {buckets.map((b) => {
          const isWorst = worst?.bucket === b.bucket && b.error_rate > 0;
          const small = b.moves < MIN_BUCKET_MOVES;
          return (
            <li key={b.bucket}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className={cn("whitespace-nowrap", isWorst ? "font-semibold text-ivory" : "text-ivory-muted")}>{label(b.bucket)}</span>
                <strong className={cn("num text-sm", isWorst ? "text-rose-300" : small ? "text-ivory-faint" : "text-ivory")}>
                  {b.moves === 0 ? "—" : fmt.pct(b.error_rate)}
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-750">
                <div
                  className={cn("h-full rounded-full", isWorst ? "bg-rose-400" : small ? "bg-ink-500" : "bg-amber-400/70")}
                  style={{ width: `${Math.min(100, (b.error_rate / max) * 100)}%` }}
                />
              </div>
              <div className="num mt-0.5 text-[11px] text-ivory-faint">
                {b.moves === 0 ? t.noMoves : `${t.bucketMoves(b.serious_errors, b.moves)}${small ? ` · ${t.lowSample}` : ""}`}
              </div>
            </li>
          );
        })}
      </ul>
      {ratio >= 1.5 && worst && (
        <p className="mt-4 text-sm text-ivory-muted">
          {t.ratio(
            <strong className="text-ivory">{label(worst.bucket).toLowerCase()}</strong>,
            <strong className="num text-rose-300">{fmt.numMax(ratio, 1)}×</strong>
          )}
        </p>
      )}
    </Panel>
  );
}

function FastVsThoughtPanel({ speed, impulsive }: { speed: FastVsThought; impulsive: boolean }) {
  const { m, fmt } = useI18n();
  const t = m.dashboard.clock;
  const { fast, thought } = speed;
  const enough = fast.moves >= MIN_BUCKET_MOVES && thought.moves >= MIN_BUCKET_MOVES;
  const fastWorse = enough && fast.accuracy < thought.accuracy - 3;

  return (
    <Panel title={t.thinkTitle} icon={Timer}>
      <div className="grid grid-cols-2 gap-3">
        <SpeedTile label={t.fast} sub={t.orLess(fmt.seconds(speed.fast_threshold_seconds))} data={fast} tone={fastWorse ? "rose" : "neutral"} />
        <SpeedTile label={t.thought} sub={t.orMore(fmt.seconds(speed.thought_threshold_seconds))} data={thought} tone="neutral" />
      </div>
      <p className="mt-4 text-sm text-ivory-muted">{!enough ? t.notEnough : fastWorse ? t.fastWorse : impulsive ? t.fastFineImpulsive : t.fastFine}</p>
      <p className="mt-2 text-[11px] text-ivory-faint">{t.openingNote}</p>
    </Panel>
  );
}

function SpeedTile({ label, sub, data, tone }: { label: string; sub: string; data: { moves: number; accuracy: number }; tone: "rose" | "neutral" }) {
  const { m, fmt } = useI18n();
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-800/60 p-3">
      <div className="text-xs font-medium text-ivory-faint">{label}</div>
      <div className={cn("num mt-1 text-2xl font-semibold", tone === "rose" ? "text-rose-300" : "text-ivory")}>
        {data.moves ? fmt.pct(data.accuracy) : "—"}
      </div>
      <div className="mt-0.5 text-[11px] text-ivory-faint">{m.dashboard.clock.speedSub(sub, data.moves)}</div>
    </div>
  );
}

function TimeByPhasePanel({ phases }: { phases: TimeByPhase }) {
  const { m, fmt } = useI18n();
  const t = m.dashboard.clock;
  const keys = ["opening", "middlegame", "endgame"] as const;
  const total = keys.reduce((s, k) => s + phases[k], 0);
  const scale = Math.max(100, total);

  return (
    <Panel title={t.spendTitle} icon={Clock}>
      <p className="-mt-2 mb-3 text-xs text-ivory-faint">{t.spendText}</p>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-ink-750" role="img" aria-label={t.spendAria}>
        {keys.map((k) => phases[k] > 0 && <div key={k} className={PHASE_BAR[k]} style={{ width: `${(phases[k] / scale) * 100}%` }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {keys.map((k) => (
          <li key={k}>
            <span className="flex items-center gap-1.5 text-ivory-faint">
              <span className={cn("h-2 w-2 rounded-full", PHASE_BAR[k])} aria-hidden />
              {m.labels.phase[k]}
            </span>
            <span className="num mt-0.5 block text-sm font-semibold text-ivory">{fmt.pct(phases[k])}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ivory-muted">{phases.opening >= 30 ? t.spendOpening : total < 50 ? t.spendSpare : t.spendBalanced}</p>
    </Panel>
  );
}

function TimeEndingsPanel({ endings }: { endings: TimeEndings }) {
  const { m } = useI18n();
  const t = m.dashboard.clock;
  return (
    <Panel title={t.endTitle} icon={TimerOff}>
      <div className="grid grid-cols-3 gap-2">
        <EndingTile
          value={endings.games_low_clock}
          label={t.lowClock}
          sub={m.dashboard.games.outOf(endings.games_with_clock)}
          tone={endings.games_low_clock / Math.max(endings.games_with_clock, 1) >= 0.3 ? "text-amber-300" : "text-ivory"}
        />
        <EndingTile value={endings.lost_on_time} label={t.lostOnTime} tone={endings.lost_on_time ? "text-rose-300" : "text-ivory"} />
        <EndingTile value={endings.won_on_time} label={t.wonOnTime} tone={endings.won_on_time ? "text-emerald-300" : "text-ivory"} icon />
      </div>
      <p className="mt-4 text-sm text-ivory-muted">
        {endings.lost_on_time > endings.won_on_time ? t.endLosing : endings.won_on_time > 0 ? t.endWinning : t.endNeutral}
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
