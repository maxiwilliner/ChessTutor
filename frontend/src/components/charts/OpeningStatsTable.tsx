"use client";

import React from "react";
import { OpeningGap } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { themeLabel } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { BookMarked, TrendingUp, TrendingDown } from "lucide-react";

function ColorChip({ color }: { color: "white" | "black" }) {
  const white = color === "white";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ivory-muted">
      <span
        className={cn("h-3 w-3 rounded-full border", white ? "border-ivory-muted bg-[#f6f1e7]" : "border-ink-500 bg-ink-950")}
        aria-hidden
      />
      {white ? "Blancas" : "Negras"}
    </span>
  );
}

function WinRate({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink-700">
        <div className={cn("h-full rounded-full", pct >= 50 ? "bg-emerald-400" : "bg-rose-400")} style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-xs font-semibold text-ivory">{pct}%</span>
    </div>
  );
}

function EvalAt12({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn("num inline-flex items-center gap-1 text-xs font-semibold", positive ? "text-emerald-300" : "text-rose-300")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {positive ? "+" : ""}
      {value}
    </span>
  );
}

export const OpeningStatsTable: React.FC<{ openings: OpeningGap[] }> = ({ openings }) => {
  const sorted = [...openings].sort((a, b) => a.avg_eval_at_move_12 - b.avg_eval_at_move_12);

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeader
        icon={BookMarked}
        eyebrow="Repertorio"
        title="Cómo sales de la apertura"
        subtitle="Evaluación media al llegar a la jugada 12 y resultados por código ECO. Las peores primero."
      />

      {sorted.length === 0 ? (
        <p className="mt-6 text-sm text-ivory-faint">No hay suficientes partidas por apertura para sacar conclusiones.</p>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <ul className="mt-6 space-y-3 md:hidden">
            {sorted.map((op, idx) => (
              <li key={idx} className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="num text-xs font-semibold text-brass-300">{op.eco}</div>
                    <div className="mt-0.5 text-sm font-medium text-ivory">{op.name}</div>
                  </div>
                  <EvalAt12 value={op.avg_eval_at_move_12} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <ColorChip color={op.color} />
                  <span className="num text-xs text-ivory-faint">{op.games_played} partidas</span>
                  <WinRate rate={op.win_rate} />
                </div>
                <div className="mt-2 text-xs text-ivory-faint">Error típico: {themeLabel(op.dominant_blunder_motif)}</div>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-600 text-[11px] uppercase tracking-wider text-ivory-faint">
                  <th scope="col" className="py-3 pr-3 font-semibold">ECO</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Apertura</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Color</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Partidas</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Victorias</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Eval. jug. 12</th>
                  <th scope="col" className="py-3 pl-3 font-semibold">Error típico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/50">
                {sorted.map((op, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-ink-750/50">
                    <td className="num py-3 pr-3 text-xs font-semibold text-brass-300">{op.eco}</td>
                    <td className="max-w-[260px] truncate px-3 py-3 font-medium text-ivory" title={op.name}>
                      {op.name}
                    </td>
                    <td className="px-3 py-3"><ColorChip color={op.color} /></td>
                    <td className="num px-3 py-3 text-right text-xs text-ivory-muted">{op.games_played}</td>
                    <td className="px-3 py-3"><WinRate rate={op.win_rate} /></td>
                    <td className="px-3 py-3"><EvalAt12 value={op.avg_eval_at_move_12} /></td>
                    <td className="py-3 pl-3 text-xs text-ivory-muted">{themeLabel(op.dominant_blunder_motif)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
};
