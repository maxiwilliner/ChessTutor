"use client";

import React, { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getPuzzles, getTrainerStats, GetPuzzlesFilter } from "@/lib/api";
import { BlunderBankItem, TrainerStatsResponse } from "@/types/api";
import { BlunderReplay } from "@/components/board/BlunderReplay";
import {
  Dumbbell,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  User,
  Activity,
  Flame,
  Target,
  ShieldCheck,
  Trophy,
  Filter,
  Zap,
  Clock,
  Crosshair,
  RotateCcw,
} from "lucide-react";

type FilterMode = "all" | "leak" | "impulse" | "theme";

const THEME_OPTIONS = [
  { key: "hanging_piece", label: "Piezas Colgadas", icon: "🛡️" },
  { key: "pin_exploitation", label: "Clavadas Tácticas", icon: "📌" },
  { key: "fork_overlooked", label: "Ataques Dobles / Horquillas", icon: "⚡" },
  { key: "missed_mate", label: "Mates Omitidos", icon: "👑" },
  { key: "king_safety_collapse", label: "Seguridad del Rey", icon: "🏰" },
];

function TrainerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawParam = searchParams.get("username") || "";

  const [username, setUsername] = useState<string>(rawParam);
  const [inputUser, setInputUser] = useState<string>("");

  // Data & Puzzles State
  const [puzzles, setPuzzles] = useState<BlunderBankItem[]>([]);
  const [stats, setStats] = useState<TrainerStatsResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter Mode State
  const [activeMode, setActiveMode] = useState<FilterMode>("all");
  const [selectedTheme, setSelectedTheme] = useState<string>("hanging_piece");
  const [onlyReviewDue, setOnlyReviewDue] = useState<boolean>(false);

  // Session Tracking State (real-time in session)
  const [sessionStreak, setSessionStreak] = useState<number>(0);
  const [sessionAttempts, setSessionAttempts] = useState<number>(0);
  const [sessionFirstTryCount, setSessionFirstTryCount] = useState<number>(0);
  const [sessionBlundersAvoided, setSessionBlundersAvoided] = useState<number>(0);

  // Sync username from search param or localStorage
  useEffect(() => {
    if (rawParam) {
      setUsername(rawParam);
      if (typeof window !== "undefined") {
        localStorage.setItem("chesstutor_last_username", rawParam);
      }
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chesstutor_last_username");
      if (saved) {
        setUsername(saved);
        router.replace(`/trainer?username=${encodeURIComponent(saved)}`);
      } else {
        setLoading(false);
      }
    }
  }, [rawParam, router]);

  // Load Trainer Stats
  const fetchStats = useCallback(async () => {
    if (!username) return;
    try {
      const data = await getTrainerStats(username);
      setStats(data);
    } catch (e) {
      // ignore
    }
  }, [username]);

  // Load Puzzles with current filter
  const fetchPuzzles = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      setError("");

      const filter: GetPuzzlesFilter = {};

      if (activeMode === "leak") {
        filter.top_leak_only = true;
      } else if (activeMode === "impulse") {
        // Will filter client-side if needed or load all and filter
      } else if (activeMode === "theme") {
        filter.theme = selectedTheme;
      }

      if (onlyReviewDue) {
        filter.status = "review_due";
      }

      const data = await getPuzzles(username, filter);

      let finalPuzzles = data;
      if (activeMode === "impulse") {
        finalPuzzles = data.filter((p) => p.classification.psychological_tag === "impulsive");
      }

      setPuzzles(finalPuzzles);
      setCurrentIndex(0);
    } catch (err: any) {
      setError(err.message || "No se encontraron ejercicios con este filtro.");
      setPuzzles([]);
    } finally {
      setLoading(false);
    }
  }, [username, activeMode, selectedTheme, onlyReviewDue]);

  useEffect(() => {
    if (username) {
      fetchStats();
      fetchPuzzles();
    }
  }, [username, fetchStats, fetchPuzzles]);

  const handleAttemptFinished = (result: {
    isSolved: boolean;
    firstTry: boolean;
    repeatedOldBlunder: boolean;
  }) => {
    setSessionAttempts((prev) => prev + 1);

    if (result.isSolved) {
      setSessionStreak((prev) => prev + 1);
      if (result.firstTry) {
        setSessionFirstTryCount((prev) => prev + 1);
      }
      if (!result.repeatedOldBlunder) {
        setSessionBlundersAvoided((prev) => prev + 1);
      }
    } else {
      setSessionStreak(0);
    }

    // Refresh aggregated stats in background
    fetchStats();
  };

  const handleNext = () => {
    if (currentIndex < puzzles.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (!username) {
    return (
      <div className="max-w-md mx-auto text-center py-16 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-xl">
        <User className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Entrenador de Errores Reales</h2>
        <p className="text-sm text-slate-400 mb-6">
          Introduce tu usuario de Chess.com para cargar tus posiciones analizadas:
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = inputUser.trim();
            if (clean) {
              setUsername(clean);
              router.push(`/trainer?username=${encodeURIComponent(clean)}`);
            }
          }}
          className="space-y-4"
        >
          <input
            type="text"
            value={inputUser}
            onChange={(e) => setInputUser(e.target.value)}
            placeholder="Usuario de Chess.com (ej. macsimo1312)"
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition text-sm"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/30"
          >
            Cargar Mis Ejercicios
          </button>
          <button
            type="button"
            onClick={() => {
              setUsername("macsimo1312");
              router.push("/trainer?username=macsimo1312");
            }}
            className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs transition border border-slate-700/60"
          >
            Cargar perfil de prueba: <span className="font-semibold text-emerald-400">macsimo1312</span> (48 ejercicios)
          </button>
        </form>
        <div className="mt-6 pt-6 border-t border-slate-800 text-xs text-slate-500">
          ¿Aún no has analizado tus partidas?{" "}
          <Link href="/" className="text-indigo-400 hover:underline">
            Ir al inicio y analizar
          </Link>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentIndex];
  const firstTryRate = sessionAttempts > 0 ? Math.round((sessionFirstTryCount / sessionAttempts) * 100) : 100;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard?username=${encodeURIComponent(username)}`}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
              <Dumbbell className="w-6 h-6 text-emerald-400" />
              <span>Hub de Entrenamiento Táctico</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Posiciones reales de partidas de <span className="text-slate-200 font-semibold">{username}</span>
            </p>
          </div>
        </div>

        {/* Carousel controls */}
        {puzzles.length > 0 && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition"
              title="Ejercicio anterior"
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
              title="Siguiente ejercicio"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Session Progress & Mastery Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Aciertos 1º intento</div>
            <div className="text-lg font-extrabold text-white font-mono">
              {sessionAttempts > 0 ? `${firstTryRate}%` : "100%"}
              <span className="text-xs font-normal text-slate-500 ml-1">({sessionFirstTryCount}/{sessionAttempts})</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Racha actual</div>
            <div className="text-lg font-extrabold text-amber-400 font-mono">
              {sessionStreak} <span className="text-xs font-normal text-slate-500">seguidos</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Blunders evitados</div>
            <div className="text-lg font-extrabold text-emerald-400 font-mono">
              {sessionBlundersAvoided} <span className="text-xs font-normal text-slate-500">en sesión</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Maestría Global</div>
            <div className="text-lg font-extrabold text-purple-300 font-mono">
              {stats?.mastery_percentage ?? 0}%
              <span className="text-xs font-normal text-slate-500 ml-1">
                ({stats?.mastered_puzzles ?? 0}/{stats?.total_puzzles ?? 0})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Mode Filter Tabs */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveMode("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                activeMode === "all"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800/70 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Todos los Errores</span>
            </button>

            <button
              onClick={() => setActiveMode("leak")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                activeMode === "leak"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                  : "bg-slate-800/70 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Fuga Prioritaria #1</span>
              {stats?.top_leak_theme && (
                <span className="text-[10px] bg-rose-950/80 px-1.5 py-0.5 rounded text-rose-300 uppercase">
                  {stats.top_leak_theme.replace("_", " ")}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveMode("impulse")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                activeMode === "impulse"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "bg-slate-800/70 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Control de Impulsos (≤3s)</span>
            </button>

            <button
              onClick={() => setActiveMode("theme")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                activeMode === "theme"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "bg-slate-800/70 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>Por Tema Táctico</span>
            </button>
          </div>

          {/* Review Due SRS Toggle */}
          <button
            onClick={() => setOnlyReviewDue((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition ${
              onlyReviewDue
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-slate-900 border-slate-700/60 text-slate-400 hover:text-slate-300"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Repaso Programado ({stats?.review_due_puzzles ?? 0})</span>
          </button>
        </div>

        {/* Theme Pills (When activeMode === 'theme') */}
        {activeMode === "theme" && (
          <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
            {THEME_OPTIONS.map((th) => {
              const themeCount = stats?.themes_breakdown[th.key]?.total_puzzles ?? 0;
              const isSelected = selectedTheme === th.key;
              return (
                <button
                  key={th.key}
                  onClick={() => setSelectedTheme(th.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                    isSelected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <span>{th.icon}</span>
                  <span>{th.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {themeCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="max-w-md mx-auto text-center py-24 space-y-4">
          <Activity className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
          <h3 className="text-lg font-bold text-white">Cargando tus posiciones de entrenamiento...</h3>
          <p className="text-xs text-slate-400">Extrayendo tus errores reales analizados por Stockfish 16.</p>
        </div>
      ) : error || puzzles.length === 0 ? (
        <div className="max-w-md mx-auto text-center py-20 bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">¡No hay ejercicios pendientes en esta categoría!</h3>
          <p className="text-xs text-slate-400 mb-6">
            {onlyReviewDue
              ? "No tienes ejercicios pendientes de repaso programado para hoy. ¡Excelente constancia!"
              : "No se encontraron errores bajo este filtro o ya has dominado todas estas posiciones."}
          </p>
          <button
            onClick={() => {
              setActiveMode("all");
              setOnlyReviewDue(false);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium text-sm hover:bg-slate-700 transition"
          >
            Ver Todos los Ejercicios
          </button>
        </div>
      ) : (
        <BlunderReplay
          key={currentPuzzle.id}
          puzzle={currentPuzzle}
          puzzleIndex={currentIndex}
          totalPuzzles={puzzles.length}
          username={username}
          onNext={handleNext}
          onAttemptFinished={handleAttemptFinished}
        />
      )}
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
