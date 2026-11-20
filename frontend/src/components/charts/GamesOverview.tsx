"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { GameRecap, GameStats, RatingGapKey } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Segmented } from "@/components/ui/Segmented";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Swords, TrendingUp, LifeBuoy, Scale, ExternalLink, Target, ChevronDown } from "lucide-react";

type Filter = "all" | "thrown" | "better_lost" | "losses";

const FILTERS: Record<Filter, (g: GameRecap) => boolean> = {
  all: () => true,
  thrown: (g) => g.advantage === "thrown" || g.advantage === "drawn",
  better_lost: (g) => playedBetter(g) && g.result === "loss",
  losses: (g) => g.result === "loss",
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

export function GamesOverview({ stats, games, username }: { stats?: GameStats | null; games?: GameRecap[] | null; username: string }) {
  const { m, fmt } = useI18n();
  const t = m.dashboard.games;
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const counts = useMemo(
    () => Object.fromEntries((Object.keys(FILTERS) as Filter[]).map((f) => [f, (games ?? []).filter(FILTERS[f]).length])) as Record<Filter, number>,
    [games]
  );

  const header = <SectionHeader icon={Swords} eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />;

  if (!stats || !games) {
    return (
      <Card className="p-5 sm:p-7">
        {header}
        <p className="mt-6 rounded-xl border border-ink-600/60 bg-ink-900/60 p-4 text-sm text-ivory-faint">{t.reanalyze}</p>
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
          label={t.conversion}
          value={adv.converted}
          suffix={t.outOf(adv.games_with_advantage)}
          icon={TrendingUp}
          tone="emerald"
          hint={adv.games_with_advantage ? t.conversionHint(adv.thrown, adv.drawn) : t.conversionNone}
        />
        <StatTile
          label={t.comebacks}
          value={adv.saved_win + adv.saved_draw}
          suffix={t.outOf(adv.games_with_disadvantage)}
          icon={LifeBuoy}
          tone="cyan"
          hint={adv.games_with_disadvantage ? t.comebacksHint(adv.saved_win, adv.saved_draw) : t.comebacksNone}
          style={{ animationDelay: "60ms" }}
        />
        <StatTile
          label={t.better}
          value={vs.played_better}
          suffix={t.outOf(vs.games_compared)}
          icon={Scale}
          tone="brass"
          hint={t.betterHint(vs.played_better_lost)}
          style={{ animationDelay: "120ms" }}
        />
      </div>

      {/* Por Elo del rival */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["stronger", "similar", "weaker"] as RatingGapKey[]).map((k) => {
          const b = stats.by_rating_gap[k];
          return (
            <div key={k} className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ivory">{t.gap[k].title}</span>
                <span className="num text-xs text-ivory-faint">{t.gapGames(b.games)}</span>
              </div>
              <div className="text-[11px] text-ivory-faint">{t.gap[k].sub}</div>
              {b.games ? (
                <>
                  <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
                    <div className="bg-emerald-400" style={{ width: `${(b.wins / b.games) * 100}%` }} />
                    <div className="bg-ivory-faint" style={{ width: `${(b.draws / b.games) * 100}%` }} />
                    <div className="bg-rose-400" style={{ width: `${(b.losses / b.games) * 100}%` }} />
                  </div>
                  <div className="num mt-1.5 text-xs text-ivory-muted">
                    <strong className="text-ivory">{t.gapWins(fmt.pct(Math.round(b.win_rate * 100), 0))}</strong> ·{" "}
                    {t.gapRecord(b.wins, b.draws, b.losses)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-xs text-ivory-faint">{t.gapNone}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lista */}
      <div className="mt-6">
        <Segmented<Filter>
          ariaLabel={t.filterAria}
          size="sm"
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setExpanded(false);
          }}
          options={(Object.keys(FILTERS) as Filter[]).map((f) => ({ value: f, label: t.filters[f], badge: counts[f] }))}
        />

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ivory-faint">{t.noneForFilter}</p>
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
            {expanded ? t.showLess : t.showAll(rows.length)}
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>
    </Card>
  );
}

function GameRow({ game: g, username }: { game: GameRecap; username: string }) {
  const { m, fmt, path } = useI18n();
  const t = m.dashboard.games;
  const gap = g.opponent_rating - g.user_rating;
  const better = playedBetter(g);
  const result = m.labels.result[g.result];

  return (
    <li className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn("num flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold", RESULT_CHIP[g.result])}
          title={result}
        >
          {result.charAt(0)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="truncate font-medium text-ivory">{t.vs(g.opponent_username)}</span>
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
              {g.color === "white" ? t.white : t.black}
            </span>
            {g.end_time > 0 && <span>· {fmt.shortDate(g.end_time)}</span>}
            <span className="max-w-[16rem] truncate" title={g.opening_name}>
              · {g.opening_name}
            </span>
            <span>· {m.labels.termination[g.termination] ?? m.labels.termination.other}</span>
          </div>
          <AdvantageNote game={g} />
        </div>
      </div>

      <div className="flex items-center gap-4 md:w-[22rem] md:shrink-0 md:justify-end">
        <AccuracyCompare you={g.user_accuracy} rival={g.opponent_accuracy} better={better} />
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5 md:ml-0">
          {g.advantage_lost_puzzle_id && (
            <Link
              href={path(`/trainer?username=${encodeURIComponent(username)}&puzzle=${encodeURIComponent(g.advantage_lost_puzzle_id)}`)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brass-300 hover:text-brass-200"
            >
              <Target className="h-3.5 w-3.5" aria-hidden /> {t.seeMistake}
            </Link>
          )}
          <a href={g.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-ivory-faint hover:text-brass-300">
            Chess.com <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </div>
    </li>
  );
}

function AdvantageNote({ game: g }: { game: GameRecap }) {
  const { m, fmt } = useI18n();
  const t = m.dashboard.games;
  // ±10 es el tope (mate o ventaja aplastante): mejor decirlo con palabras
  const amount = (n: number) => (Math.abs(n) >= 10 ? null : fmt.signed(n, 1));
  const notes: { text: string; tone: string }[] = [];
  if (g.advantage === "converted") notes.push({ text: t.converted(amount(g.max_eval)), tone: "text-emerald-300" });
  if (g.advantage === "thrown") notes.push({ text: t.thrown(amount(g.max_eval), g.advantage_lost_move), tone: "text-rose-300" });
  if (g.advantage === "drawn") notes.push({ text: t.drawn(amount(g.max_eval), g.advantage_lost_move), tone: "text-amber-300" });
  if (g.disadvantage === "saved_win") notes.push({ text: t.savedWin(amount(g.min_eval)), tone: "text-cyan-300" });
  if (g.disadvantage === "saved_draw") notes.push({ text: t.savedDraw(amount(g.min_eval)), tone: "text-cyan-300" });
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
  const { m, fmt } = useI18n();
  const t = m.dashboard.games;
  if (you === null) return <span className="text-xs text-ivory-faint">{t.noAccuracy}</span>;
  const row = (label: string, v: number | null, color: string, strong: boolean) => (
    <div className="flex items-center gap-2">
      <span className={cn("w-10 text-[11px]", strong ? "font-semibold text-ivory" : "text-ivory-faint")}>{label}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-700">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${v ?? 0}%` }} />
      </div>
      <span className={cn("num w-9 text-right text-xs", strong ? "font-semibold text-ivory" : "text-ivory-muted")}>
        {v === null ? "—" : fmt.num(v, 1)}
      </span>
    </div>
  );
  return (
    <div className="space-y-1" title={t.accuracyTitle}>
      {row(t.you, you, "bg-brass-400", better)}
      {row(t.opponent, rival, "bg-cyan-400/80", !better && rival !== null && rival > you)}
    </div>
  );
}
