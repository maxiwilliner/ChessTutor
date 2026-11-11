"use client";

import React from "react";
import { OpeningGap } from "@/types/api";
import { BookMarked, TrendingUp, TrendingDown } from "lucide-react";

interface OpeningStatsTableProps {
  openings: OpeningGap[];
}

export const OpeningStatsTable: React.FC<OpeningStatsTableProps> = ({ openings }) => {
  return (
    <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
        <BookMarked className="w-5 h-5 text-indigo-400" />
        <div>
          <h3 className="text-base font-bold text-white">Rendimiento por Repertorio de Aperturas</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluación media obtenida al salir de la jugada 12 y tasa de victorias por código ECO.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/60 uppercase font-semibold text-slate-400 border-b border-slate-700">
            <tr>
              <th className="py-3 px-3">ECO</th>
              <th className="py-3 px-3">Apertura</th>
              <th className="py-3 px-3">Color</th>
              <th className="py-3 px-3 text-center">Partidas</th>
              <th className="py-3 px-3">Win Rate</th>
              <th className="py-3 px-3">Eval Jugada 12</th>
              <th className="py-3 px-3">Motivo de Error Común</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {openings.map((op, idx) => {
              const winPct = Math.round(op.win_rate * 100);
              const isPositiveEval = op.avg_eval_at_move_12 >= 0;

              return (
                <tr key={idx} className="hover:bg-slate-700/30 transition">
                  <td className="py-3 px-3 font-mono font-bold text-indigo-400">{op.eco}</td>
                  <td className="py-3 px-3 font-medium text-white max-w-[200px] truncate">
                    {op.name}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        op.color === "white"
                          ? "bg-slate-200 text-slate-900"
                          : "bg-slate-950 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {op.color === "white" ? "Blancas" : "Negras"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono">{op.games_played}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            winPct >= 50 ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${winPct}%` }}
                        />
                      </div>
                      <span className="font-mono font-semibold">{winPct}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        isPositiveEval ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isPositiveEval ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {isPositiveEval ? `+${op.avg_eval_at_move_12}` : `${op.avg_eval_at_move_12}`}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 capitalize">
                    {op.dominant_blunder_motif.replace("_", " ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

