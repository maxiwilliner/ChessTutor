"use client";

import React, { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { GetPuzzlesFilter } from "@/lib/api";
import { store } from "@/lib/store";
import { BlunderBankItem, TrainerStatsResponse } from "@/types/api";
import { BlunderReplay } from "@/components/board/BlunderReplay";
import { Card, Skeleton } from "@/components/ui/Card";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import { themeLabel, TRAINER_THEMES, type TrainerMode } from "@/lib/labels";
import { useLastUsername } from "@/lib/useLastUsername";
import { useCountUp } from "@/lib/motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Flame,
  Target,
  ShieldCheck,
  Layers,
  Zap,
  Crosshair,
  RotateCcw,
  Shapes,
  Search,
} from "lucide-react";

const MODES: TrainerMode[] = ["all", "leak", "impulse", "theme"];

function TrainerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawParam = searchParams.get("username") || "";
  const modeParam = searchParams.get("mode") as TrainerMode | null;
  const themeParam = searchParams.get("theme");
  const [lastUser, saveLastUser] = useLastUsername();

  const [username, setUsername] = useState<string>(rawParam);
  const [inputUser, setInputUser] = useState("");

  const [puzzles, setPuzzles] = useState<BlunderBankItem[]>([]);
  const [stats, setStats] = useState<TrainerStatsResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeMode, setActiveMode] = useState<TrainerMode>(
    modeParam && MODES.includes(modeParam) ? modeParam : themeParam ? "theme" : "all"
  );
  const [selectedTheme, setSelectedTheme] = useState<string>(themeParam || "hanging_piece");
  const [onlyReviewDue, setOnlyReviewDue] = useState(false);
  // Por defecto, los ejercicios del último análisis (los repasos programados miran todo el banco)
  const [scope, setScope] = useState<"latest" | "all">("latest");

  const [sessionStreak, setSessionStreak] = useState(0);
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [sessionFirstTryCount, setSessionFirstTryCount] = useState(0);
  const [sessionBlundersAvoided, setSessionBlundersAvoided] = useState(0);

  // Usuario: parámetro de URL > último usuario guardado
  useEffect(() => {
    if (rawParam) {
      setUsername(rawParam);
      saveLastUser(rawParam);
    } else if (lastUser) {
      setUsername(lastUser);
      router.replace(`/trainer?username=${encodeURIComponent(lastUser)}`);
    } else if (lastUser === null) {
      setLoading(false);
    }
  }, [rawParam, lastUser, router, saveLastUser]);

  // Sincronizar filtro si se llega con ?mode= / ?theme= (p. ej. desde el diagnóstico)
  useEffect(() => {
    if (modeParam && MODES.includes(modeParam)) setActiveMode(modeParam);
    else if (themeParam) setActiveMode("theme");
    if (themeParam) setSelectedTheme(themeParam);
  }, [modeParam, themeParam]);

  const fetchStats = useCallback(async () => {
    if (!username) return;
    try {
      setStats(await store.getTrainerStats(username));
    } catch {
      // las estadísticas son opcionales
    }
  }, [username]);

  const fetchPuzzles = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      setError("");
      const filter: GetPuzzlesFilter = {};
      if (activeMode === "leak") filter.top_leak_only = true;
      else if (activeMode === "theme") filter.theme = selectedTheme;
      else if (activeMode === "impulse") filter.psych_tag = "impulsive";
      if (onlyReviewDue) filter.status = "review_due";
      filter.scope = onlyReviewDue ? "all" : scope;

      setPuzzles(await store.getPuzzles(username, filter));
      setCurrentIndex(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se encontraron ejercicios con este filtro.");
      setPuzzles([]);
    } finally {
      setLoading(false);
    }
  }, [username, activeMode, selectedTheme, onlyReviewDue, scope]);

  useEffect(() => {
    if (username) {
      fetchStats();
      fetchPuzzles();
    }
  }, [username, fetchStats, fetchPuzzles]);

  const handleAttemptFinished = (result: { isSolved: boolean; firstTry: boolean; repeatedOldBlunder: boolean }) => {
    setSessionAttempts((p) => p + 1);
    if (result.isSolved) {
      setSessionStreak((p) => p + 1);
      if (result.firstTry) setSessionFirstTryCount((p) => p + 1);
      if (!result.repeatedOldBlunder) setSessionBlundersAvoided((p) => p + 1);
    } else {
      setSessionStreak(0);
    }
    fetchStats();
  };

  const handleNext = () => setCurrentIndex((p) => (p < puzzles.length - 1 ? p + 1 : 0));
  const handlePrev = () => setCurrentIndex((p) => (p > 0 ? p - 1 : p));

  if (!username) {
    return (
      <div className="mx-auto max-w-md animate-fade-up py-10">
        <Card className="p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brass-500/30 bg-brass-400/10 text-brass-300">
            <Target className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="font-display text-2xl font-semibold text-ivory">Entrena tus errores reales</h1>
          <p className="mt-2 text-sm text-ivory-muted">
            Escribe tu usuario de Chess.com para cargar las posiciones donde fallaste.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const clean = inputUser.trim();
              if (!clean) return;
              setUsername(clean);
              router.push(`/trainer?username=${encodeURIComponent(clean)}`);
            }}
            className="mt-6 space-y-3"
          >
            <label htmlFor="trainer-user" className="sr-only">
              Usuario de Chess.com
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory-faint" aria-hidden />
              <input
                id="trainer-user"
                type="text"
                value={inputUser}
                onChange={(e) => setInputUser(e.target.value)}
                placeholder="Tu usuario de Chess.com"
                autoComplete="off"
                className="h-12 w-full rounded-xl border border-ink-500 bg-ink-900 pl-10 pr-4 text-sm text-ivory placeholder:text-ivory-faint focus:border-brass-400 focus:outline-none focus:ring-2 focus:ring-brass-400/20"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Cargar mis ejercicios
            </Button>
            {process.env.NODE_ENV === "development" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => router.push("/trainer?username=macsimo1312")}
              >
                Perfil de prueba: <span className="font-semibold text-emerald-300">macsimo1312</span>
              </Button>
            )}
          </form>
          <p className="mt-6 border-t border-ink-600 pt-5 text-xs text-ivory-faint">
            ¿Aún no analizaste tus partidas?{" "}
            <Link href="/" className="font-semibold text-brass-300 hover:underline">
              Empieza por el diagnóstico
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentIndex];
  const firstTryRate = sessionAttempts > 0 ? Math.round((sessionFirstTryCount / sessionAttempts) * 100) : null;
  const themeCount = (key: string) => stats?.themes_breakdown[key]?.total_puzzles ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard?username=${encodeURIComponent(username)}`}
            aria-label="Volver al diagnóstico"
            className={buttonClasses("secondary", "md", "w-10 px-0")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ivory sm:text-3xl">Entrenador</h1>
            <p className="text-xs text-ivory-faint">
              Posiciones reales de las partidas de <span className="font-semibold text-ivory-muted">{username}</span>
            </p>
          </div>
        </div>
        <MasteryMeter stats={stats} />
      </div>

      {/* Sesión */}
      <Card tone="inset" className="grid grid-cols-2 divide-ink-600/60 sm:grid-cols-4 sm:divide-x">
        <SessionStat icon={Target} tone="text-brass-300" label="1.er intento" value={firstTryRate === null ? "—" : `${firstTryRate}%`} sub={`${sessionFirstTryCount}/${sessionAttempts}`} />
        <SessionStat icon={Flame} tone="text-amber-300" label="Racha" value={String(sessionStreak)} sub="seguidos" highlight={sessionStreak >= 3} />
        <SessionStat icon={ShieldCheck} tone="text-emerald-300" label="Blunders evitados" value={String(sessionBlundersAvoided)} sub="en sesión" />
        <SessionStat icon={RotateCcw} tone="text-cyan-300" label="Repaso pendiente" value={String(stats?.review_due_puzzles ?? 0)} sub="hoy" />
      </Card>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented<TrainerMode>
            ariaLabel="Tipo de ejercicios"
            value={activeMode}
            onChange={setActiveMode}
            options={[
              { value: "all", label: "Todos", icon: Layers },
              {
                value: "leak",
                label: "Fuga n.º 1",
                icon: Crosshair,
                hint: stats?.top_leak_theme ? themeLabel(stats.top_leak_theme) : undefined,
              },
              { value: "impulse", label: "Impulsivos", icon: Zap, hint: "al instante" },
              { value: "theme", label: "Por tema", icon: Shapes },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
          <Segmented<"latest" | "all">
            ariaLabel="Qué ejercicios mostrar"
            size="sm"
            value={onlyReviewDue ? "all" : scope}
            disabled={onlyReviewDue}
            onChange={setScope}
            options={[
              { value: "latest", label: "Último análisis" },
              { value: "all", label: "Todo el banco", hint: stats ? `${stats.total_puzzles}` : undefined },
            ]}
          />
          <button
            type="button"
            aria-pressed={onlyReviewDue}
            onClick={() => setOnlyReviewDue((p) => !p)}
            className={cn(
              "flex h-10 items-center gap-2 self-start rounded-xl border px-3.5 text-sm font-medium transition-colors lg:self-auto",
              onlyReviewDue
                ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                : "border-ink-600 bg-ink-900/80 text-ivory-muted hover:text-ivory"
            )}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Solo repaso programado
            <span className="num rounded-md bg-ink-750 px-1.5 text-xs">{stats?.review_due_puzzles ?? 0}</span>
          </button>
          </div>
        </div>

        {activeMode === "theme" && (
          <div className="flex animate-fade-up flex-wrap gap-2" role="group" aria-label="Tema táctico">
            {TRAINER_THEMES.map((th) => {
              const selected = selectedTheme === th.key;
              const Icon = th.icon;
              return (
                <button
                  key={th.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedTheme(th.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                    selected
                      ? "border-brass-500/50 bg-brass-400/15 text-brass-200"
                      : "border-ink-600 bg-ink-850 text-ivory-muted hover:border-ink-500 hover:text-ivory"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {th.label}
                  <span className="num rounded-full bg-ink-750 px-1.5 text-[10px] text-ivory-faint">{themeCount(th.key)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navegación entre ejercicios */}
      {!loading && puzzles.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-750" aria-hidden>
            <div
              className="h-full rounded-full bg-brass-400 transition-[width] duration-500"
              style={{ width: `${((currentIndex + 1) / puzzles.length) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="w-8 px-0" onClick={handlePrev} disabled={currentIndex === 0} aria-label="Ejercicio anterior">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="num min-w-14 text-center text-xs font-semibold text-ivory-muted">
              {currentIndex + 1} / {puzzles.length}
            </span>
            <Button variant="secondary" size="sm" className="w-8 px-0" onClick={handleNext} aria-label="Siguiente ejercicio">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <TrainerSkeleton />
      ) : error || puzzles.length === 0 ? (
        <Card className="mx-auto max-w-md animate-fade-up p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" aria-hidden />
          <h2 className="font-display text-xl font-semibold text-ivory">Nada pendiente aquí</h2>
          <p className="mb-6 mt-1 text-sm text-ivory-muted">
            {onlyReviewDue
              ? "No tienes repasos programados para hoy. ¡Buena constancia!"
              : "No hay errores con este filtro, o ya dominaste todas estas posiciones."}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setActiveMode("all");
              setOnlyReviewDue(false);
            }}
          >
            Ver todos los ejercicios
          </Button>
        </Card>
      ) : (
        <BlunderReplay
          key={currentPuzzle.id}
          puzzle={currentPuzzle}
          puzzleIndex={currentIndex}
          totalPuzzles={puzzles.length}
          username={username}
          onNext={handleNext}
          onPrev={handlePrev}
          onAttemptFinished={handleAttemptFinished}
        />
      )}
    </div>
  );
}

function SessionStat({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className={cn("h-4 w-4 shrink-0", tone, highlight && "animate-pulse")} aria-hidden />
      <div className="min-w-0">
        <div className="truncate text-[11px] text-ivory-faint">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("num text-lg font-semibold", tone)}>{value}</span>
          <span className="truncate text-[11px] text-ivory-faint">{sub}</span>
        </div>
      </div>
    </div>
  );
}

function MasteryMeter({ stats }: { stats: TrainerStatsResponse | null }) {
  const pct = stats?.mastery_percentage ?? 0;
  const animated = useCountUp(pct);
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3 self-start rounded-2xl border border-ink-600/70 bg-ink-800/70 py-2 pl-2 pr-4 sm:self-auto">
      <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="#1F2733" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="#DDB463"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - animated / 100)}
        />
      </svg>
      <div>
        <div className="text-[11px] text-ivory-faint">Maestría global</div>
        <div className="num text-lg font-semibold text-brass-300">
          {Math.round(animated)}%
          <span className="ml-1.5 text-xs font-normal text-ivory-faint">
            {stats?.mastered_puzzles ?? 0}/{stats?.total_puzzles ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function TrainerSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8" aria-busy="true" aria-label="Cargando ejercicios">
      <div className="mx-auto w-full max-w-[600px] space-y-2 lg:col-span-7">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="aspect-square w-full" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="space-y-4 lg:col-span-5">
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
        <Skeleton className="h-36" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

export default function TrainerPage() {
  return (
    <Suspense fallback={<TrainerSkeleton />}>
      <TrainerContent />
    </Suspense>
  );
}
