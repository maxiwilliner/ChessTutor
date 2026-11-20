"use client";

import React from "react";
import Link from "next/link";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PhaseDistribution, TacticalMotifDetail } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { themeMeta, TRAINER_THEMES } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { Map as MapIcon, ArrowUpRight } from "lucide-react";

interface WeaknessMapProps {
  phases: PhaseDistribution;
  motifs: Record<string, TacticalMotifDetail>;
  username: string;
}

const PHASE_COLORS: Record<string, string> = {
  opening: "#67E8F9",
  middlegame: "#DDB463",
  endgame: "#A78BFA",
};

const MOTIF_COLORS = ["#FB7185", "#F59E0B", "#DDB463", "#67E8F9", "#A78BFA", "#8A8479"];

export function WeaknessMap({ phases, motifs, username }: WeaknessMapProps) {
  const { m: msg, fmt, path } = useI18n();
  const t = msg.dashboard.weakness;
  const phaseLabel = (k: string) => msg.labels.phase[k] ?? k;
  const phaseRows = (["opening", "middlegame", "endgame"] as const).map((k) => ({ key: k, ...phases[k] }));
  const totalBlunders = phaseRows.reduce((s, p) => s + p.blunders, 0);
  const worstPhase = [...phaseRows].sort((a, b) => b.percentage_of_blunders - a.percentage_of_blunders)[0];

  const motifRows = Object.entries(motifs)
    .filter(([, m]) => m.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    // La descripción sale del diccionario (la guardada en el resumen está en español)
    .map(([key, m]) => ({ ...m, key, label: themeMeta(key, msg).label, description: themeMeta(key, msg).description }));

  // El enlace apunta al motivo entrenable más frecuente (la "imprecisión táctica" genérica no es un filtro del entrenador).
  const trainable = motifRows.find((r) => TRAINER_THEMES.some((t) => t.key === r.key));

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeader
        icon={MapIcon}
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-5">
        {/* Fases */}
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-ivory">{t.byPhase}</h3>
          {totalBlunders === 0 ? (
            <p className="mt-3 text-sm text-ivory-faint">{t.noBlunders}</p>
          ) : (
            <>
              <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-ink-750" role="img" aria-label={t.phaseAria}>
                {phaseRows.map(
                  (p) =>
                    p.percentage_of_blunders > 0 && (
                      <div
                        key={p.key}
                        className="h-full transition-[width] duration-700 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${p.percentage_of_blunders}%`, background: PHASE_COLORS[p.key] }}
                        title={`${phaseLabel(p.key)}: ${fmt.pct(p.percentage_of_blunders)}`}
                      />
                    )
                )}
              </div>
              <ul className="mt-4 space-y-2.5">
                {phaseRows.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-2 whitespace-nowrap text-ivory-muted">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PHASE_COLORS[p.key] }} aria-hidden />
                      {phaseLabel(p.key)}
                      {p.key === worstPhase.key && p.percentage_of_blunders > 0 && (
                        <span className="rounded-full bg-rose-500/15 px-1.5 text-[10px] font-semibold text-rose-300">{t.biggest}</span>
                      )}
                    </span>
                    <span className="num text-xs text-ivory-faint">
                      <strong className="text-sm font-semibold text-ivory">{fmt.pct(p.percentage_of_blunders)}</strong> ·{" "}
                      {t.phaseRow(p.blunders, fmt.numMax(p.avg_cpl, 1))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Motivos tácticos */}
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-ivory">{t.byMotif}</h3>
            {trainable && (
              <Link
                href={path(`/trainer?username=${encodeURIComponent(username)}&mode=theme&theme=${trainable.key}`)}
                className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brass-300 hover:text-brass-200"
              >
                {t.train(trainable.label)} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>
          {motifRows.length === 0 ? (
            <p className="mt-3 text-sm text-ivory-faint">{t.noMotifs}</p>
          ) : (
            <div className="mt-3" style={{ height: Math.max(140, motifRows.length * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={motifRows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={10}>
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={128}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#BDB6AA", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(243,237,226,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as (typeof motifRows)[number];
                      return (
                        <div className="max-w-xs rounded-xl border border-ink-500 bg-ink-850 p-3 text-xs shadow-card">
                          <div className="font-semibold text-ivory">{d.label}</div>
                          <div className="num mt-0.5 text-brass-300">{t.tooltip(d.count, fmt.pct(d.percentage_of_blunders))}</div>
                          {d.description && <p className="mt-1.5 text-ivory-muted">{d.description}</p>}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive>
                    {motifRows.map((_, i) => (
                      <Cell key={i} fill={MOTIF_COLORS[i % MOTIF_COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="percentage_of_blunders"
                      position="right"
                      formatter={(v: number) => fmt.pct(v)}
                      style={{ fill: "#F3EDE2", fontSize: 12, fontFamily: "var(--font-mono)" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
