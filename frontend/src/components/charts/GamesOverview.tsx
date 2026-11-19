"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { GameRecap, GameStats, RatingGapKey } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Segmented } from "@/components/ui/Segmented";
import { RESULT_LABEL, TERMINATION_LABEL } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Swords, TrendingUp, LifeBuoy, Scale, ExternalLink, Target, ChevronDown } from "lucide-react";

type Filter = "all" | "thrown" | "better_lost" | "losses";

const FILTERS: Record<Filter, (g: GameRecap) => boolean> = {
  all: () => true,
  thrown: (g) => g.advantage === "thrown" || g.advantage === "drawn",
  better_lost: (g) => playedBetter(g) && g.result === "loss",
  losses: (g) => g.result === "loss",
};

const GAP_LABEL: Record<RatingGapKey, { title: string; sub: string }> = {
  stronger: { title: "Rival más fuerte", sub: "más de 50 de Elo por encima" },
  similar: { title: "Rival de tu nivel", sub: "±50 de Elo" },
  weaker: { title: "Rival más débil", sub: "más de 50 por debajo" },
};

const RESULT_CHIP: Record<GameRecap["result"], string> = {
  win: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  draw: "border-ink-500 bg-ink-700 text-ivory-muted",
  loss: "border-rose-500/40 bg-rose-500/15 text-rose-300",
};

const INITIAL_ROWS = 8;

function playedBetter(g: GameRecap) {
  return g.user_accuracy !== null && g.opponent_accuracy !== null && g.user_accuracy > g.opponent_accuracy;
}

const num = (n: number, digits = 1) => n.toLocaleString("es", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (n: number) => `${n > 0 ? "+" : ""}${num(n)}`;
/** ±10 es el tope (mate o ventaja aplastante): mejor decirlo con palabras. */
const advText = (n: number) => (Math.abs(n) >= 10 ? "decisiva" : `de ${signed(n)}`);

export function GamesOverview({ stats, games, username }: { stats?: GameStats | null; games?: GameRecap[] | null; username: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const counts = useMemo(
    () => Object.fromEntries((Object.keys(FILTERS) as Filter[]).map((f) => [f, (games ?? []).filter(FILTERS[f]).length])) as Record<Filter, number>,
    [games]
  );

  const header = (
    <SectionHeader
      icon={Swords}
      eyebrow="Tus partidas"
      title="Cómo se decidieron"
      subtitle="Las ventajas que convertiste o se te escaparon, y quién jugó mejor según el motor, partida a partida."
    />
  );

  if (!stats || !games) {
    return (
      <Card className="p-5 sm:p-7">
        {header}
        <p className="mt-6 rounded-xl border border-ink-600/60 bg-ink-900/60 p-4 text-sm text-ivory-faint">
          Vuelve a analizar tus partidas para ver la conversión de ventaja y el resumen de cada partida.
        </p>
      </Card>
    );
  }

  const { advantage: adv, vs_opponent: vs } = stats;
  const rows = games.filter(FILTERS[filter]);
  const visible = expanded ? rows : rows.slice(0, INITIAL_ROWS);

  return (
    <Card className="p-5 sm:p-7">
      {header}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Conversión de ventaja"
          value={adv.converted}
          suffix={`de ${adv.games_with_advantage}`}
          icon={TrendingUp}
          tone="emerald"
          hint={
            adv.games_with_advantage
              ? `Partidas en las que llegaste a +3 y ganaste · ${adv.thrown} perdidas, ${adv.drawn} en tablas`
              : "No llegaste a +3 en ninguna partida"
          }
        />
        <StatTile
          label="Remontadas"
          value={adv.saved_win + adv.saved_draw}
          suffix={`de ${adv.games_with_disadvantage}`}
          icon={LifeBuoy}
          tone="cyan"
          hint={
            adv.games_with_disadvantage
              ? `Partidas con −3 o peor que salvaste · ${adv.saved_win} ganadas, ${adv.saved_draw} tablas`
              : "Nunca estuviste a −3 o peor"
          }
          style={{ animationDelay: "60ms" }}
        />
        <StatTile
          label="Mejor que tu rival"
          value={vs.played_better}
          suffix={`de ${vs.games_compared}`}
          icon={Scale}
          tone="brass"
          hint={`Partidas con más precisión que el rival · perdiste ${vs.played_better_lost} de esas`}
          style={{ animationDelay: "120ms" }}
        />
      </div>

      {/* Por Elo del rival */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["stronger", "similar", "weaker"] as const).map((k) => {
          const b = stats.by_rating_gap[k];
          return (
            <div key={k} className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ivory">{GAP_LABEL[k].title}</span>
                <span className="num text-xs text-ivory-faint">
                  {b.games} {b.games === 1 ? "partida" : "partidas"}
                </span>
              </div>
              <div className="text-[11px] text-ivory-faint">{GAP_LABEL[k].sub}</div>
              {b.games ? (
                <>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
                    <div className="bg-emerald-400" style={{ width: `${(b.wins / b.games) * 100}%` }} />
                    <div className="bg-ivory-faint" style={{ width: `${(b.draws / b.games) * 100}%` }} />
                    <div className="bg-rose-400" style={{ width: `${(b.losses / b.games) * 100}%` }} />
                  </div>
                  <div className="num mt-1.5 text-xs text-ivory-muted">
                    <strong className="text-ivory">{Math.round(b.win_rate * 100)} %</strong> victorias · {b.wins}V {b.draws}T {b.losses}D
                  </div>
                </>
              ) : (
                <div className="mt-2 text-xs text-ivory-faint">Sin partidas</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lista */}
      <div className="mt-6">
        <Segmented<Filter>
          ariaLabel="Filtrar partidas"
          size="sm"
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setExpanded(false);
          }}
          options={[
            { value: "all", label: "Todas", badge: counts.all },
            { value: "thrown", label: "Ventaja escapada", badge: counts.thrown },
            { value: "better_lost", label: "Mejor y perdiste", badge: counts.better_lost },
            { value: "losses", label: "Derrotas", badge: counts.losses },
          ]}
        />

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ivory-faint">Ninguna partida con este filtro.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-600/50 rounded-2xl border border-ink-600/60 bg-ink-900/40">
            {visible.map((g) => (
              <GameRow key={g.id} game={g} username={username} />
            ))}
          </ul>
        )}
        {rows.length > INITIAL_ROWS && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brass-300 hover:text-brass-200"
          >
            {expanded ? "Ver menos" : `Ver las ${rows.length} partidas`}
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
    </Card>
  );
}

function GameRow({ game: g, username }: { game: GameRecap; username: string }) {
  const gap = g.opponent_rating - g.user_rating;
  const date = g.end_time ? new Date(g.end_time * 1000).toLocaleDateString("es", { day: "numeric", month: "short" }) : null;
  const better = playedBetter(g);

  return (
    <li className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn("num flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold", RESULT_CHIP[g.result])}
          title={RESULT_LABEL[g.result]}
        >
          {RESULT_LABEL[g.result].charAt(0)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="truncate font-medium text-ivory">vs {g.opponent_username}</span>
            <span className="num text-xs text-ivory-faint">
              {g.user_rating} vs {g.opponent_rating}{" "}
              <span className={gap > 50 ? "text-rose-300" : gap < -50 ? "text-emerald-300" : ""}>
                ({gap > 0 ? "+" : ""}
                {gap})
              </span>
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ivory-faint">
            <span className="inline-flex items-center gap-1">
              <span
                className={cn("h-2.5 w-2.5 rounded-full border", g.color === "white" ? "border-ivory-muted bg-[#f6f1e7]" : "border-ink-500 bg-ink-950")}
                aria-hidden
              />
              {g.color === "white" ? "Blancas" : "Negras"}
            </span>
            {date && <span>· {date}</span>}
            <span className="max-w-[16rem] truncate" title={g.opening_name}>
              · {g.opening_name}
            </span>
            <span>· {TERMINATION_LABEL[g.termination] ?? TERMINATION_LABEL.other}</span>
          </div>
          <AdvantageNote game={g} />
        </div>
      </div>

      <div className="flex items-center gap-4 md:w-[22rem] md:shrink-0 md:justify-end">
        <AccuracyCompare you={g.user_accuracy} rival={g.opponent_accuracy} better={better} />
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5 md:ml-0">
          {g.advantage_lost_puzzle_id && (
            <Link
              href={`/trainer?username=${encodeURIComponent(username)}&puzzle=${encodeURIComponent(g.advantage_lost_puzzle_id)}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brass-300 hover:text-brass-200"
            >
              <Target className="h-3.5 w-3.5" aria-hidden /> Ver el error
            </Link>
          )}
          <a
            href={g.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ivory-faint hover:text-brass-300"
          >
            Chess.com <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </div>
    </li>
  );
}

function AdvantageNote({ game: g }: { game: GameRecap }) {
  const notes: { text: string; tone: string }[] = [];
  const at = g.advantage_lost_move ? ` en la jugada ${g.advantage_lost_move}` : "";
  if (g.advantage === "converted") notes.push({ text: `Ventaja ${advText(g.max_eval)} convertida`, tone: "text-emerald-300" });
  if (g.advantage === "thrown") notes.push({ text: `Ventaja ${advText(g.max_eval)} perdida${at}`, tone: "text-rose-300" });
  if (g.advantage === "drawn") notes.push({ text: `Ventaja ${advText(g.max_eval)} que acabó en tablas${at}`, tone: "text-amber-300" });
  if (g.disadvantage === "saved_win") notes.push({ text: Math.abs(g.min_eval) >= 10 ? "Remontada desde una posición perdida" : `Remontada desde ${signed(g.min_eval)}`, tone: "text-cyan-300" });
  if (g.disadvantage === "saved_draw") notes.push({ text: Math.abs(g.min_eval) >= 10 ? "Tablas desde una posición perdida" : `Salvada en tablas desde ${signed(g.min_eval)}`, tone: "text-cyan-300" });
  if (!notes.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-medium">
      {notes.map((n) => (
        <span key={n.text} className={n.tone}>
          {n.text}
        </span>
      ))}
    </div>
  );
}

function AccuracyCompare({ you, rival, better }: { you: number | null; rival: number | null; better: boolean }) {
  if (you === null) return <span className="text-xs text-ivory-faint">Sin precisión</span>;
  const row = (label: string, v: number | null, color: string, strong: boolean) => (
    <div className="flex items-center gap-2">
      <span className={cn("w-10 text-[11px]", strong ? "font-semibold text-ivory" : "text-ivory-faint")}>{label}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-700">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${v ?? 0}%` }} />
      </div>
      <span className={cn("num w-9 text-right text-xs", strong ? "font-semibold text-ivory" : "text-ivory-muted")}>
        {v === null ? "—" : num(v)}
      </span>
    </div>
  );
  return (
    <div className="space-y-1" title="Precisión según el motor (0-100)">
      {row("Tú", you, "bg-brass-400", better)}
      {row("Rival", rival, "bg-cyan-400/80", !better && rival !== null && rival > you)}
    </div>
  );
}
