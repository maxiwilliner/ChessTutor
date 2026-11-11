"use client";

import React from "react";
import { ClockPsychology } from "@/types/api";
import { Clock, Zap, AlertTriangle, ShieldCheck } from "lucide-react";

interface ClockVsErrorChartProps {
  clockData: ClockPsychology;
}

export const ClockVsErrorChart: React.FC<ClockVsErrorChartProps> = ({ clockData }) => {
  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
        <Clock className="w-5 h-5 text-indigo-400" />
        <h3 className="text-base font-bold text-white">Psicología del Reloj vs. Calidad de Jugada</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Metric 1 */}
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Blunders Impulsivos (&le;3s)</span>
            <Zap className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {clockData.blunders_under_3s_with_ample_time}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Con abundancia de tiempo en el reloj</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Blunders en Apuro (&lt;10s)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {clockData.blunders_in_time_trouble_under_10s}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Bajo presión extrema de tiempo</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Ratio Tiempo Blunder / Bueno</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {clockData.blunder_time_ratio}x
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {clockData.avg_time_on_blunders_seconds}s en blunders vs {clockData.avg_time_on_good_moves_seconds}s en buenas
          </p>
        </div>
      </div>

      {/* Visual comparison bar */}
      <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/50">
        <div className="text-xs font-semibold text-slate-300 mb-2">Comparativa de Tiempo Medio Invertido:</div>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Jugadas Buenas / Acertadas</span>
              <span className="font-mono text-emerald-400">{clockData.avg_time_on_good_moves_seconds}s</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, (clockData.avg_time_on_good_moves_seconds / 30) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Jugadas donde Cometiste Error / Blunder</span>
              <span className="font-mono text-rose-400">{clockData.avg_time_on_blunders_seconds}s</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{ width: `${Math.min(100, (clockData.avg_time_on_blunders_seconds / 30) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

