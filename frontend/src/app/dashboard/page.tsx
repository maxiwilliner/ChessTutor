"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { store } from "@/lib/store";
import { FeedbackLink } from "@/components/layout/FeedbackLink";
import { PlayerDiagnosisSummary, PlayerProfile, TutorPedagogicalReport } from "@/types/api";
import { DiagnosisCard } from "@/components/tutor/DiagnosisCard";
import { StudyPlanCard } from "@/components/tutor/StudyPlanCard";
import { ClockVsErrorChart } from "@/components/charts/ClockVsErrorChart";
import { OpeningStatsTable } from "@/components/charts/OpeningStatsTable";
import { WeaknessMap } from "@/components/charts/WeaknessMap";
import { AccuracyRing } from "@/components/charts/AccuracyRing";
import { Card, Skeleton } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { TIME_CLASS_LABEL } from "@/lib/labels";
import { useLastUsername } from "@/lib/useLastUsername";
import { Target, ArrowRight, TrendingUp, Flame, AlertOctagon, Gauge, UserRound, RefreshCw, ExternalLink } from "lucide-react";

const SECTIONS = [
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "debilidades", label: "Debilidades" },
  { id: "reloj", label: "Reloj" },
  { id: "aperturas", label: "Aperturas" },
  { id: "plan", label: "Plan" },
];

function DashboardContent() {
  const searchParams = useSearchParams();
  const usernameParam = searchParams.get("username") || "";
  const [lastUser, saveLastUser] = useLastUsername();

  const [summary, setSummary] = useState<PlayerDiagnosisSummary | null>(null);
  const [tutor, setTutor] = useState<TutorPedagogicalReport | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usernameParam) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [sumData, tutorData] = await Promise.all([store.getSummary(usernameParam), store.getReport(usernameParam)]);
        if (cancelled) return;
        setSummary(sumData);
        setTutor(tutorData);
        saveLastUser(usernameParam);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el diagnóstico.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // El perfil (avatar) es decorativo: si falla, no bloquea.
    store
      .getProfile(usernameParam)
      .then((p) => !cancelled && setProfile(p))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [usernameParam, saveLastUser]);

  if (!usernameParam) {
    return (
      <EmptyState
        title="Todavía no hay un diagnóstico"
        text="Analiza un perfil de Chess.com desde el inicio para ver aquí tus fugas de Elo."
        action={
          <div className="flex flex-col items-center gap-2">
            <Link href="/" className={buttonClasses("primary", "md")}>
              Analizar mis partidas
            </Link>
            {lastUser && (
              <Link href={`/dashboard?username=${encodeURIComponent(lastUser)}`} className={buttonClasses("ghost", "sm")}>
                Ver el de {lastUser}
              </Link>
            )}
          </div>
        }
      />
    );
  }

  if (loading) return <DashboardSkeleton />;

  if (error || !summary || !tutor) {
    return (
      <EmptyState
        tone="error"
        title="No encontramos un análisis reciente"
        text={`${error || "No se ha analizado este usuario."} ${
          store.mode === "demo"
            ? "En la demo los análisis se guardan solo en el navegador donde los hiciste."
            : "Los diagnósticos se guardan en memoria y se pierden al reiniciar el servidor."
        }`}
        action={
          <Link href={`/?username=${encodeURIComponent(usernameParam)}`} className={buttonClasses("primary", "md")}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Volver a analizar a {usernameParam}
          </Link>
        }
      />
    );
  }

  const p = summary.player;
  const m = summary.overall_metrics;
  const err = summary.error_breakdown;
  const trainerHref = `/trainer?username=${encodeURIComponent(p.username)}`;

  return (
    <div className="space-y-12">
      {/* Cabecera de perfil */}
      <Card tone="raised" className="relative animate-fade-up overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brass-400/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <Avatar profile={profile} username={p.username} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {profile?.title && <Badge tone="brass">{profile.title}</Badge>}
                <Badge>{TIME_CLASS_LABEL[p.time_class] ?? p.time_class}</Badge>
                <Badge>{p.games_analyzed} partidas</Badge>
              </div>
              <h1 className="mt-2 truncate font-display text-3xl font-semibold text-ivory sm:text-4xl">{p.username}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ivory-faint">
                <span>
                  Elo <strong className="num text-ivory">{p.elo_current}</strong>
                </span>
                <span>{p.period === "Recent Archives" ? "Partidas recientes" : `Periodo ${p.period}`}</span>
                {profile?.url && (
                  <a href={profile.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brass-300">
                    Chess.com <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <AccuracyRing value={m.accuracy_score} className="h-20 w-20 sm:h-28 sm:w-28" />
            <Link href={trainerHref} className={buttonClasses("primary", "lg", "flex-1 whitespace-nowrap px-4 sm:px-6 lg:flex-none")}>
              <Target className="h-5 w-5" aria-hidden />
              <span className="sm:hidden">Entrenar errores</span>
              <span className="hidden sm:inline">Entrenar mis errores</span>
              <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
            </Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Victorias"
          value={Math.round(m.win_rate * 100)}
          suffix="%"
          icon={TrendingUp}
          tone="emerald"
          hint={<ResultBar win={m.win_rate} draw={m.draw_rate} loss={m.loss_rate} />}
        />
        <StatTile
          label="Pérdida media"
          value={m.avg_centipawn_loss}
          decimals={1}
          suffix="CPL"
          icon={Gauge}
          tone="cyan"
          hint="Centipeones perdidos por jugada"
          style={{ animationDelay: "60ms" }}
        />
        <StatTile
          label="Blunders"
          value={err.blunders_total}
          icon={Flame}
          tone="rose"
          hint={`${err.blunders_per_game} por partida`}
          style={{ animationDelay: "120ms" }}
        />
        <StatTile
          label="Errores e imprecisiones"
          value={err.errors_total + err.inaccuracies_total}
          icon={AlertOctagon}
          tone="amber"
          hint={`${err.errors_total} errores · ${err.inaccuracies_total} imprecisiones`}
          style={{ animationDelay: "180ms" }}
        />
      </div>

      {/* Índice de secciones */}
      <nav
        aria-label="Secciones del diagnóstico"
        className="sticky top-16 z-30 -mx-4 hidden border-y border-ink-600/50 bg-ink-900/85 px-4 py-2 backdrop-blur-lg md:block lg:-mx-8 lg:px-8"
      >
        <ul className="flex gap-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="rounded-lg px-3 py-1.5 text-sm text-ivory-faint transition-colors hover:bg-ink-750 hover:text-ivory"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div id="diagnostico" className="scroll-mt-32">
        <DiagnosisCard
          leaks={tutor.top_3_leaks}
          flags={summary.top_3_algorithmic_flags}
          greeting={tutor.greeting}
          overview={tutor.overview}
          mentalTip={tutor.mental_game_tip}
          username={p.username}
        />
      </div>

      <div id="debilidades" className="scroll-mt-32">
        <WeaknessMap phases={summary.phase_distribution} motifs={summary.tactical_motifs} username={p.username} />
      </div>

      <div id="reloj" className="scroll-mt-32">
        <ClockVsErrorChart clockData={summary.clock_psychology} />
      </div>

      <div id="aperturas" className="scroll-mt-32">
        <OpeningStatsTable openings={summary.opening_repertoire_gaps} />
      </div>

      <div id="plan" className="scroll-mt-32">
        <StudyPlanCard plan={tutor.weekly_plan} username={p.username} />
      </div>

      {/* Cierre */}
      <Card tone="inset" className="flex flex-col items-center gap-4 p-8 text-center">
        <h2 className="font-display text-2xl font-semibold text-ivory">El mejor momento para corregir un error es ahora</h2>
        <p className="max-w-lg text-sm text-ivory-muted">
          Vuelve a las posiciones donde fallaste y resuélvelas hasta dominarlas. La repetición espaciada te las volverá a mostrar cuando toque.
        </p>
        <Link href={trainerHref} className={buttonClasses("primary", "lg")}>
          Ir al entrenador <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <FeedbackLink label="¿Te ha sido útil? Cuéntanos qué mejorarías" className="text-sm" />
      </Card>
    </div>
  );
}

function Avatar({ profile, username }: { profile: PlayerProfile | null; username: string }) {
  const [broken, setBroken] = useState(false);
  if (profile?.avatar && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar}
        alt=""
        onError={() => setBroken(true)}
        className="h-16 w-16 shrink-0 rounded-2xl border border-brass-500/30 object-cover shadow-brass sm:h-20 sm:w-20"
      />
    );
  }
  return (
    <span className="flex h-16 w-16 shrink-0 items-center sm:h-20 sm:w-20 justify-center rounded-2xl border border-brass-500/30 bg-brass-400/10 font-display text-3xl font-semibold text-brass-300">
      {username.charAt(0).toUpperCase() || <UserRound className="h-8 w-8" aria-hidden />}
    </span>
  );
}

function ResultBar({ win, draw, loss }: { win: number; draw: number; loss: number }) {
  return (
    <div className="mt-1 space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <div className="bg-emerald-400" style={{ width: `${win * 100}%` }} />
        <div className="bg-ivory-faint" style={{ width: `${draw * 100}%` }} />
        <div className="bg-rose-400" style={{ width: `${loss * 100}%` }} />
      </div>
      <div className="num">
        {Math.round(draw * 100)}% tablas · {Math.round(loss * 100)}% derrotas
      </div>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
  tone = "neutral",
}: {
  title: string;
  text: string;
  action: React.ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <Card className="mx-auto mt-8 max-w-lg animate-fade-up p-8 text-center sm:p-10">
      <span
        className={
          tone === "error"
            ? "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300"
            : "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brass-500/30 bg-brass-400/10 text-brass-300"
        }
      >
        {tone === "error" ? <AlertOctagon className="h-7 w-7" aria-hidden /> : <UserRound className="h-7 w-7" aria-hidden />}
      </span>
      <h1 className="font-display text-2xl font-semibold text-ivory">{title}</h1>
      <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-ivory-muted">{text}</p>
      {action}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Cargando diagnóstico">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-2xl" />
        ))}
      </div>
      <p className="text-center text-sm text-ivory-faint">El profesor está redactando tu informe…</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
