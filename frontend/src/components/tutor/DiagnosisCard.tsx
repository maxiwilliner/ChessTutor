import React from "react";
import { TutorLeak } from "@/types/api";
import { AlertCircle, Target, Sparkles, BookOpen } from "lucide-react";

interface DiagnosisCardProps {
  leaks: TutorLeak[];
  overview: string;
  mentalTip: string;
}

export const DiagnosisCard: React.FC<DiagnosisCardProps> = ({ leaks, overview, mentalTip }) => {
  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-indigo-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2.5 text-indigo-400 font-semibold text-sm mb-2">
          <Sparkles className="w-5 h-5" />
          <span>Diagnóstico General del Profesor</span>
        </div>
        <p className="text-slate-200 text-base leading-relaxed">{overview}</p>
      </div>

      {/* 3 Critical Leaks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {leaks.map((leak, idx) => (
          <div
            key={idx}
            className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-600 transition"
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    leak.severity === "CRITICAL"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : leak.severity === "HIGH"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  }`}
                >
                  {leak.severity}
                </span>
                <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
              </div>

              <h4 className="text-base font-bold text-white mb-2 leading-snug">{leak.title}</h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">{leak.explanation}</p>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-700/70">
              <div className="text-xs bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/40">
                <div className="text-indigo-400 font-semibold flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Concepto Clave</span>
                </div>
                <div className="text-slate-300">{leak.tactical_concept}</div>
              </div>

              <div className="text-xs bg-emerald-950/40 rounded-xl p-2.5 border border-emerald-500/20">
                <div className="text-emerald-400 font-semibold flex items-center gap-1.5 mb-1">
                  <Target className="w-3.5 h-3.5" />
                  <span>Hábito de Acción</span>
                </div>
                <div className="text-emerald-200/90">{leak.actionable_advice}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mental Game Tip */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3.5">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h5 className="text-sm font-bold text-amber-300 mb-1">Consejo Psicológico & Gestión del Reloj</h5>
          <p className="text-xs text-amber-100/90 leading-relaxed">{mentalTip}</p>
        </div>
      </div>
    </div>
  );
};

