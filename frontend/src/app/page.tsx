"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createAnalysisEventSource } from "@/lib/api";
import { Search, Trophy, Sparkles, ArrowRight, Activity, Clock, Zap } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [timeClass, setTimeClass] = useState("rapid");
  const [gamesLimit, setGamesLimit] = useState(15);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleStartAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser) return;

    setIsAnalyzing(true);
    setProgressPct(5);
    setStatusMessage(`Conectando con Chess.com para ${cleanUser}...`);
    setErrorMessage("");

    const sse = createAnalysisEventSource(cleanUser, timeClass, gamesLimit);

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.stage === "error") {
          setErrorMessage(data.message);
          setIsAnalyzing(false);
          sse.close();
          return;
        }

        setProgressPct(data.progress_pct || 0);
        setStatusMessage(data.message || "");

        if (data.stage === "complete") {
          sse.close();
          if (typeof window !== "undefined") {
            localStorage.setItem("chesstutor_last_username", cleanUser);
          }
          setTimeout(() => {
            router.push(`/dashboard?username=${encodeURIComponent(cleanUser)}`);
          }, 800);
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    sse.onerror = (err) => {
      console.error("SSE error", err);
      sse.close();
      setErrorMessage("Error de conexión al servidor de análisis. Asegúrate de que el backend esté en ejecución.");
      setIsAnalyzing(false);
    };
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {/* Hero Header */}
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Inteligencia Artificial + Motor Stockfish 16</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Tu Profesor Personal de Ajedrez conectado a{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Chess.com
          </span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
          Descubre de forma matemática las 3 fugas que más Elo te están costando, analiza tus patrones
          de impulsividad con el reloj y entrena resolviendo tus propios errores reales.
        </p>
      </div>

      {/* Main Search Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-indigo-500/5">
        <form onSubmit={handleStartAnalysis} className="space-y-6">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Usuario de Chess.com
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isAnalyzing}
                placeholder="Ej. magnuscarlsen, hikaru o tu usuario..."
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition text-base font-medium"
              />
            </div>
          </div>

          {/* Time class & Limit grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Ritmo de Juego
              </label>
              <select
                value={timeClass}
                onChange={(e) => setTimeClass(e.target.value)}
                disabled={isAnalyzing}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500 text-sm font-medium"
              >
                <option value="rapid">Rápido (10+0, 15+10)</option>
                <option value="blitz">Blitz (3+0, 5+0)</option>
                <option value="bullet">Bullet (1+0, 2+1)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Partidas a Analizar
              </label>
              <select
                value={gamesLimit}
                onChange={(e) => setGamesLimit(Number(e.target.value))}
                disabled={isAnalyzing}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500 text-sm font-medium"
              >
                <option value={10}>Últimas 10 partidas (Rápido ~15s)</option>
                <option value={15}>Últimas 15 partidas (Recomendado ~25s)</option>
                <option value={30}>Últimas 30 partidas (Profundo ~45s)</option>
              </select>
            </div>
          </div>

          {/* Submit Button */}
          {!isAnalyzing ? (
            <button
              type="submit"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/25 transition transform active:scale-[0.99]"
            >
              Iniciar Diagnóstico Pedagógico
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                  {statusMessage}
                </span>
                <span className="text-indigo-400 font-mono font-bold">{progressPct}%</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              {errorMessage}
            </div>
          )}
        </form>
      </div>

      {/* 3 Pillars Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-sm mb-1">Cálculo con Stockfish 16</h4>
          <p className="text-xs text-slate-400">
            Evaluación matemática precisa de cada jugada con Centipawn Loss real.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-sm mb-1">Psicología del Reloj</h4>
          <p className="text-xs text-slate-400">
            Detección de errores impulsivos (&le;3s) y colapsos bajo presión de tiempo.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-sm mb-1">Entrenador Blunder Replay</h4>
          <p className="text-xs text-slate-400">
            Tablero interactivo donde resuelves las posiciones donde fallaste en tus partidas.
          </p>
        </div>
      </div>
    </div>
  );
}

