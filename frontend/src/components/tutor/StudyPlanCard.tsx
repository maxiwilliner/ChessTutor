"use client";

import React, { useEffect, useState } from "react";
import { DailyPlanItem } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { CalendarDays, Check, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LOCALE } from "@/lib/i18n/paths";

/** "Day 1 (Monday)" / "Día 1 (Lunes)" -> "Monday" / "Lunes" */
const dayName = (day: string) => day.replace(/^.*\((.+)\)\s*$/, "$1");

export const StudyPlanCard: React.FC<{ plan: DailyPlanItem[]; username: string }> = ({ plan, username }) => {
  const storageKey = `chesstutor_plan_${username.toLowerCase()}`;
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [today, setToday] = useState<string>("");
  const { m, lang } = useI18n();
  const t = m.dashboard.plan;

  useEffect(() => {
    setToday(new Date().toLocaleDateString(LOCALE[lang], { weekday: "long" }).toLowerCase());
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      // sin almacenamiento: el progreso dura solo la sesión
    }
  }, [storageKey, lang]);

  const toggle = (idx: number) => {
    setDone((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignorar
      }
      return next;
    });
  };

  const total = plan.length || 7;
  const completed = Object.values(done).filter(Boolean).length;
  const pct = Math.round((completed / total) * 100);
  const totalMinutes = plan.reduce((s, d) => s + d.duration_minutes, 0);

  return (
    <Card className="p-5 sm:p-7">
      <SectionHeader
        icon={CalendarDays}
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle(totalMinutes)}
        actions={
          <div className="flex items-center gap-3">
            <span className="num text-sm text-ivory-muted">
              <strong className="text-brass-300">{completed}</strong>/{total}
            </span>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t.progress}>
              <div className="h-full rounded-full bg-brass-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        }
      />

      <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {plan.map((item, idx) => {
          const isDone = !!done[idx];
          const isToday = today !== "" && dayName(item.day).toLowerCase() === today;
          return (
            <li key={idx}>
              <button
                type="button"
                aria-pressed={isDone}
                onClick={() => toggle(idx)}
                className={cn(
                  "flex h-full w-full flex-col rounded-xl border p-4 text-left transition-colors",
                  isDone
                    ? "border-emerald-500/40 bg-emerald-500/[0.07]"
                    : isToday
                    ? "border-brass-500/60 bg-brass-400/[0.07] hover:border-brass-400"
                    : "border-ink-600/70 bg-ink-900/60 hover:border-ink-500"
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={cn("text-xs font-semibold", isToday ? "text-brass-300" : "text-ivory-faint")}>
                    {dayName(item.day)}
                    {isToday && <span className="ml-1.5 rounded-full bg-brass-400 px-1.5 py-px text-[10px] text-ink-950">{t.today}</span>}
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                      isDone ? "border-emerald-400 bg-emerald-400 text-ink-950" : "border-ink-500"
                    )}
                    aria-hidden
                  >
                    {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </div>
                <div className={cn("mt-2 text-sm font-semibold leading-snug", isDone ? "text-ivory-faint line-through" : "text-ivory")}>
                  {item.focus}
                </div>
                <p className="mt-1.5 line-clamp-5 text-xs leading-relaxed text-ivory-faint">{item.exercises_description}</p>
                <div className="num mt-auto flex items-center gap-1 pt-3 text-[11px] text-ivory-faint">
                  <Clock className="h-3 w-3" aria-hidden /> {item.duration_minutes} min
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};
