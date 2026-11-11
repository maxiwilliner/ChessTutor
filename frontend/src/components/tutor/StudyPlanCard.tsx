"use client";

import React, { useState } from "react";
import { DailyPlanItem } from "@/types/api";
import { Calendar, CheckSquare, Square, Clock } from "lucide-react";

interface StudyPlanCardProps {
  plan: DailyPlanItem[];
}

export const StudyPlanCard: React.FC<StudyPlanCardProps> = ({ plan }) => {
  const [completedDays, setCompletedDays] = useState<Record<number, boolean>>({});

  const toggleDay = (idx: number) => {
    setCompletedDays((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const completedCount = Object.values(completedDays).filter(Boolean).length;
  const progressPct = Math.round((completedCount / (plan.length || 7)) * 100);

  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-700">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Plan de Estudio Personalizado (7 Días)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Rutinas cortas de 20 a 30 minutos enfocadas en tus mayores pérdidas de Elo.
          </p>
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-300 font-medium">
            Progreso: <span className="text-indigo-400 font-bold">{completedCount}/7</span> días
          </div>
          <div className="w-24 h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {plan.map((item, idx) => {
          const isDone = !!completedDays[idx];
          return (
            <div
              key={idx}
              onClick={() => toggleDay(idx)}
              className={`cursor-pointer rounded-xl p-3.5 border transition flex flex-col justify-between ${
                isDone
                  ? "bg-emerald-950/30 border-emerald-500/40 opacity-75"
                  : "bg-slate-900/60 border-slate-700/60 hover:border-slate-500"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">{item.day}</span>
                  {isDone ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                </div>

                <div className="text-xs font-semibold text-indigo-300 mb-1.5 line-clamp-2">
                  {item.focus}
                </div>

                <p className="text-[11px] text-slate-400 leading-snug line-clamp-4">
                  {item.exercises_description}
                </p>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800">
                <Clock className="w-3 h-3" />
                <span>{item.duration_minutes} min</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

