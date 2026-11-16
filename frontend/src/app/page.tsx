"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAnalysisEventSource } from "@/lib/api";
import { useLastUsername } from "@/lib/useLastUsername";
import { DemoBoard } from "@/components/board/DemoBoard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import {
  Search,
  ArrowRight,
  Timer,
  Zap,
  Rocket,
  Download,
  Cpu,
  Target,
  Check,
  Loader2,
  AlertTriangle,
  RotateCcw,
  X,
  History,
} from "lucide-react";

type Stage = "fetching_games" | "evaluating" | "classifying" | "complete";

const STAGES: { key: Stage; label: string }[] = [
  { key: "fetching_games", label: "Descargando partidas" },
  { key: "evaluating", label: "Stockfish evalúa cada jugada" },
  { key: "classifying", label: "Clasificando errores" },
  { key: "complete", label: "Informe listo" },
];

interface Progress {
  stage: Stage;
  pct: number;
  message: string;
  current?: number;
  total?: number;
}

export default function HomePage() {
  const router = useRouter();
  const [lastUser, saveLastUser] = useLastUsername();

  const [username, setUsername] = useState("");
  const [timeClass, setTimeClass] = useState("rapid");
  const [gamesLimit, setGamesLimit] = useState(15);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Prefill desde ?username= (p. ej. "Volver a analizar" en el diagnóstico)
    const fromUrl = new URLSearchParams(window.location.search).get("username");
    if (fromUrl) setUsername(fromUrl);
    return () => sseRef.current?.close();
  }, []);

  const isAnalyzing = progress !== null && !errorMessage;

  const start = () => {
    const cleanUser = username.trim();
    if (!cleanUser) return;
    sseRef.current?.close();
    setErrorMessage("");
    setProgress({ stage: "fetching_games", pct: 3, message: `Conectando con Chess.com para ${cleanUser}…` });

    const sse = createAnalysisEventSource(cleanUser, timeClass, gamesLimit);
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.stage === "error") {
          setErrorMessage(data.message);
          sse.close();
          return;
        }
        const stage: Stage = data.stage === "evaluating_start" ? "evaluating" : data.stage;
        setProgress({
          stage,
          pct: data.progress_pct ?? 0,
          message: data.message ?? "",
          current: data.current_game,
          total: data.total_games,
        });
        if (data.stage === "complete") {
          sse.close();
          saveLastUser(cleanUser);
          window.setTimeout(() => router.push(`/dashboard?username=${encodeURIComponent(cleanUser)}`), 700);
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    sse.onerror = () => {
      sse.close();
      setErrorMessage("No se pudo conectar con el servidor de análisis. Comprueba que el backend esté en marcha.");
    };
  };

  const cancel = () => {
    sseRef.current?.close();
    setProgress(null);
    setErrorMessage("");
  };

  return (
    <div className="space-y-20 pb-8 sm:space-y-24">
      {/* Hero */}
      <section className="grid items-center gap-12 pt-2 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pt-8">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-brass-500/30 bg-brass-400/10 px-3 py-1 text-xs font-semibold text-brass-300">
            <Cpu className="h-3.5 w-3.5" aria-hidden /> Stockfish 16 + tu historial de Chess.com
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ivory sm:text-6xl">
            Deja de repetir <span className="italic text-brass-300">los mismos</span> errores.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ivory-muted sm:text-lg">
            Analizamos tus partidas reales, encontramos las 3 fugas que más Elo te cuestan y te ponemos a resolver
            las posiciones exactas donde fallaste.
          </p>

          <Card tone="raised" className="mt-8 p-5 sm:p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
              className="space-y-5"
            >
              <div>
                <label htmlFor="username" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ivory-faint">
                  Usuario de Chess.com
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ivory-faint" aria-hidden />
                  <input
                    id="username"
                    type="text"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isAnalyzing}
                    placeholder="hikaru, magnuscarlsen o el tuyo"
                    className="h-14 w-full rounded-xl border border-ink-500 bg-ink-900 pl-12 pr-4 text-base font-medium text-ivory placeholder:text-ivory-faint focus:border-brass-400 focus:outline-none focus:ring-2 focus:ring-brass-400/20 disabled:opacity-60"
                  />
                </div>
                {lastUser && !isAnalyzing && lastUser !== username.trim() && (
                  <Link
                    href={`/dashboard?username=${encodeURIComponent(lastUser)}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-ivory-faint hover:text-brass-300"
                  >
                    <History className="h-3.5 w-3.5" aria-hidden />
                    Continuar como <strong className="font-semibold text-ivory-muted">{lastUser}</strong>
                  </Link>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ivory-faint">Ritmo</legend>
                  <Segmented
                    ariaLabel="Ritmo de juego"
                    stretch
                    size="sm"
                    disabled={isAnalyzing}
                    value={timeClass}
                    onChange={setTimeClass}
                    options={[
                      { value: "rapid", label: "Rápidas", icon: Timer },
                      { value: "blitz", label: "Blitz", icon: Zap },
                      { value: "bullet", label: "Bullet", icon: Rocket },
                    ]}
                  />
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ivory-faint">Partidas</legend>
                  <Segmented
                    ariaLabel="Número de partidas"
                    stretch
                    size="sm"
                    disabled={isAnalyzing}
                    value={gamesLimit}
                    onChange={setGamesLimit}
                    options={[
                      { value: 10, label: "10", hint: "~15 s" },
                      { value: 15, label: "15", hint: "~25 s" },
                      { value: 30, label: "30", hint: "~45 s" },
                    ]}
                  />
                </fieldset>
              </div>

              {!isAnalyzing && (
                <Button type="submit" size="lg" className="w-full">
                  Analizar mis partidas
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Button>
              )}
            </form>

            {progress && <AnalysisProgress progress={progress} error={errorMessage} onRetry={start} onCancel={cancel} />}
          </Card>
        </div>

        <DemoBoard className="mx-auto w-full max-w-[440px] animate-fade-up [animation-delay:150ms]" />
      </section>

      {/* Cómo funciona */}
      <section aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-center font-display text-3xl font-semibold text-ivory">
          Tres pasos, cero teoría genérica
        </h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Download,
              title: "Descargamos tus partidas",
              text: "Leemos tu historial público de Chess.com, incluido el tiempo que gastaste en cada jugada.",
            },
            {
              icon: Cpu,
              title: "Stockfish encuentra el patrón",
              text: "Medimos la pérdida de cada jugada y clasificamos el motivo: pieza colgada, horquilla, impulsividad o apuro de tiempo.",
            },
            {
              icon: Target,
              title: "Entrenas tus propios errores",
              text: "Vuelves a la posición exacta donde fallaste, con pistas progresivas y repetición espaciada hasta dominarla.",
            },
          ].map((s, i) => (
            <li key={s.title}>
              <Card className="h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brass-500/30 bg-brass-400/10 text-brass-300">
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="num font-display text-4xl font-semibold text-ink-600">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-ivory">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ivory-muted">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function AnalysisProgress({
  progress,
  error,
  onRetry,
  onCancel,
}: {
  progress: Progress;
  error: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const activeIdx = STAGES.findIndex((s) => s.key === progress.stage);

  if (error) {
    return (
      <div className="mt-5 animate-pop rounded-xl border border-rose-500/30 bg-rose-500/10 p-4" role="alert">
        <div className="flex items-start gap-2.5 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden />
          <span>{error}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reintentar
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 animate-fade-up space-y-4" aria-live="polite">
      <ol className="space-y-2.5">
        {STAGES.map((s, i) => {
          const done = i < activeIdx || progress.stage === "complete";
          const active = i === activeIdx && progress.stage !== "complete";
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  done && "border-emerald-400 bg-emerald-400 text-ink-950",
                  active && "border-brass-400 text-brass-300",
                  !done && !active && "border-ink-500 text-ink-500"
                )}
                aria-hidden
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span className={cn(done ? "text-ivory-muted" : active ? "font-semibold text-ivory" : "text-ivory-faint")}>
                {s.label}
                {active && s.key === "evaluating" && progress.current && progress.total && (
                  <span className="num ml-2 text-xs font-normal text-brass-300">
                    {progress.current}/{progress.total}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-ivory-faint">{progress.message}</span>
          <span className="num font-semibold text-brass-300">{progress.pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-750">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brass-500 to-brass-300 transition-[width] duration-500"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      </div>

      {progress.stage !== "complete" && (
        <button type="button" onClick={onCancel} className="flex items-center gap-1 text-xs text-ivory-faint hover:text-ivory">
          <X className="h-3.5 w-3.5" aria-hidden /> Cancelar
        </button>
      )}
    </div>
  );
}
