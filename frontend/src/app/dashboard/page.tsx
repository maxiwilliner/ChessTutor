"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSummary, getTutorReport } from "@/lib/api";
import { PlayerDiagnosisSummary, TutorPedagogicalReport } from "@/types/api";
import { DiagnosisCard } from "@/components/tutor/DiagnosisCard";
import { StudyPlanCard } from "@/components/tutor/StudyPlanCard";
import { ClockVsErrorChart } from "@/components/charts/ClockVsErrorChart";
import { OpeningStatsTable } from "@/components/charts/OpeningStatsTable";
import {
  Trophy,
  Dumbbell,
  ArrowRight,
  TrendingUp,
  Flame,
  AlertOctagon,
  Percent,
  Activity,
  User,
} from "lucide-react";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const usernameParam = searchParams.get("username") || "";

  const [summary, setSummary] = useState<PlayerDiagnosisSummary | null>(null);
  const [tutor, setTutor] = useState<TutorPedagogicalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usernameParam) {
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        const [sumData, tutorData] = await Promise.all([
          getSummary(usernameParam),
          getTutorReport(usernameParam),
        ]);
        setSummary(sumData);
        setTutor(tutorData);
      } catch (err: any) {
        setError(err.message || "Error al cargar el diagnóstico.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [usernameParam]);

  if (!usernameParam) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <User className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No se especificó ningún usuario</h2>
        <p className="text-sm text-slate-400 mb-6">
          Ingresa un perfil de Chess.com en la página principal para generar el análisis.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 transition"
        >
          Ir al Inicio
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto text-center py-24 space-y-4">
        <Activity className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
        <h3 className="text-lg font-bold text-white">Generando informe pedagógico...</h3>
        <p className="text-xs text-slate-400">
          Procesando estadísticas de Stockfish y redactando recomendaciones.
        </p>
      </div>
    );
  }

  if (error || !summary || !tutor) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8">
        <AlertOctagon className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-rose-200 mb-1">Análisis no encontrado</h3>
        <p className="text-xs text-rose-300 mb-6">
          {error || "No se ha corrido el escaneo para este usuario recientemente."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm hover:bg-slate-700 transition"
        >
          Escanear Usuario
        </Link>
      </div>
    );
  }

  const p = summary.player;
  const m = summary.overall_metrics;
  const err = summary.error_breakdown;

  return (
    <div className="space-y-10">
      {/* Top Profile & Metrics Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{p.username}</h1>
            <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
              Rating: {p.elo_current}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Análisis de {p.games_analyzed} partidas en ritmo {p.time_class.toUpperCase()} · Periodo {p.period}
          </p>
        </div>

        {/* CTA to Trainer */}
        <Link
          href={`/trainer?username=${encodeURIComponent(p.username)}`}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 transition transform active:scale-95"
        >
          <Dumbbell className="w-4 h-4" />
          <span>Resolver mis Errores (Blunder Replay)</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Precisión Media</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            {m.accuracy_score}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Pérdida media de {m.avg_centipawn_loss} CPL</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Tasa de Victorias</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-400 font-mono">
            {Math.round(m.win_rate * 100)}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {Math.round(m.loss_rate * 100)}% Derrotas · {Math.round(m.draw_rate * 100)}% Tablas
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Blunders Críticos</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400 font-mono">
            {err.blunders_total}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{err.blunders_per_game} blunders por partida</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Inexactitudes & Errores</span>
            <AlertOctagon className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">
            {err.errors_total + err.inaccuracies_total}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {err.errors_total} errores · {err.inaccuracies_total} imprecisiones
          </p>
        </div>
      </div>

      {/* 1. Tutor Diagnosis & 3 Critical Leaks */}
      <DiagnosisCard
        leaks={tutor.top_3_leaks}
        overview={tutor.overview}
        mentalTip={tutor.mental_game_tip}
      />

      {/* 2. Clock Psychology */}
      <ClockVsErrorChart clockData={summary.clock_psychology} />

      {/* 3. Opening Repertoire Table */}
      <OpeningStatsTable openings={summary.opening_repertoire_gaps} />

      {/* 4. Weekly 7-Day Study Plan */}
      <StudyPlanCard plan={tutor.weekly_plan} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-400">Cargando...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

