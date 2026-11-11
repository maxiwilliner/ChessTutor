"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPuzzles } from "@/lib/api";
import { BlunderBankItem } from "@/types/api";
import { BlunderReplay } from "@/components/board/BlunderReplay";
import { Dumbbell, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, User, Activity } from "lucide-react";

function TrainerContent() {
  const searchParams = useSearchParams();
  const usernameParam = searchParams.get("username") || "";

  const [puzzles, setPuzzles] = useState<BlunderBankItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usernameParam) {
      setLoading(false);
      return;
    }

    async function loadPuzzles() {
      try {
        setLoading(true);
        const data = await getPuzzles(usernameParam);
        setPuzzles(data);
      } catch (err: any) {
        setError(err.message || "No se encontraron ejercicios.");
      } finally {
        setLoading(false);
      }
    }

    loadPuzzles();
  }, [usernameParam]);

  if (!usernameParam) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <User className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Usuario no especificado</h2>
        <p className="text-sm text-slate-400 mb-6">
          Inicia un diagnóstico desde la página principal para generar tus ejercicios personalizados.
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
        <Activity className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
        <h3 className="text-lg font-bold text-white">Cargando tus posiciones de entrenamiento...</h3>
        <p className="text-xs text-slate-400">Extrayendo tus errores reales analizados por Stockfish 16.</p>
      </div>
    );
  }

  if (error || puzzles.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20 bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">¡No se detectaron errores graves!</h3>
        <p className="text-xs text-slate-400 mb-6">
          {error || "En las partidas analizadas no se cometieron blunders graves, ¡gran nivel de juego!"}
        </p>
        <Link
          href={`/dashboard?username=${encodeURIComponent(usernameParam)}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm hover:bg-slate-700 transition"
        >
          Volver al Diagnóstico
        </Link>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentIndex];

  const handleNext = () => {
    if (currentIndex < puzzles.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Loop back or stay
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard?username=${encodeURIComponent(usernameParam)}`}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-emerald-400" />
              <span>Entrenador Blunder Replay</span>
            </h1>
            <p className="text-xs text-slate-400">
              Posiciones reales de <span className="text-slate-200 font-semibold">{usernameParam}</span>
            </p>
          </div>
        </div>

        {/* Puzzle navigation selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-bold text-slate-300 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            {currentIndex + 1} / {puzzles.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex === puzzles.length - 1}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Interactive Replay Area */}
      <BlunderReplay
        puzzle={currentPuzzle}
        puzzleIndex={currentIndex}
        totalPuzzles={puzzles.length}
        onNext={handleNext}
      />
    </div>
  );
}

export default function TrainerPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-400">Cargando...</div>}>
      <TrainerContent />
    </Suspense>
  );
}

