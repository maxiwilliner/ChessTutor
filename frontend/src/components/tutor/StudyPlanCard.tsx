"use client";

import React, { useEffect, useState } from "react";
import { DailyPlanItem } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { CalendarDays, Check, Clock } from "lucide-react";

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const StudyPlanCard: React.FC<{ plan: DailyPlanItem[]; username: string }> = ({ plan, username }) => {
  const storageKey = `chesstutor_plan_${username.toLowerCase()}`;
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setToday(WEEKDAYS[new Date().getDay()]);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      // sin almacenamiento: el progreso dura solo la sesión
    }
  }, [storageKey]);

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
        eyebrow="Plan de estudio"
        title="Tu semana de entrenamiento"
        subtitle={`Rutinas cortas enfocadas en tus fugas · ${totalMinutes} minutos en total. Marca cada día al completarlo.`}
        actions={
          <div className="flex items-center gap-3">
            <span className="num text-sm text-ivory-muted">
              <strong className="text-brass-300">{completed}</strong>/{total}
            </span>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso del plan">
              <div className="h-full rounded-full bg-brass-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        }
      />

      <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {plan.map((item, idx) => {
          const isDone = !!done[idx];
          const isToday = today !== "" && item.day.includes(today);
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
                    {item.day.replace(/^Día \d+ \((.+)\)$/, "$1")}
                    {isToday && <span className="ml-1.5 rounded-full bg-brass-400 px-1.5 py-px text-[10px] text-ink-950">Hoy</span>}
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
