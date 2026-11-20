"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { store } from "@/lib/store";
import { isExampleUser } from "@/lib/example";
import { FeedbackLink } from "@/components/layout/FeedbackLink";
import { PlayerDiagnosisSummary, PlayerProfile, TutorPedagogicalReport } from "@/types/api";
import { DiagnosisCard } from "@/components/tutor/DiagnosisCard";
import { StudyPlanCard } from "@/components/tutor/StudyPlanCard";
import { ClockVsErrorChart } from "@/components/charts/ClockVsErrorChart";
import { OpeningStatsTable } from "@/components/charts/OpeningStatsTable";
import { WeaknessMap } from "@/components/charts/WeaknessMap";
import { AccuracyRing } from "@/components/charts/AccuracyRing";
import { GamesOverview } from "@/components/charts/GamesOverview";
import { APP_MODE } from "@/lib/mode";
import { Card, Skeleton } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { useLastUsername } from "@/lib/useLastUsername";
import { errorText, useI18n } from "@/lib/i18n";
import { Target, ArrowRight, TrendingUp, Flame, AlertOctagon, Gauge, UserRound, RefreshCw, ExternalLink } from "lucide-react";

const IS_DEMO = APP_MODE === "demo";

type SectionKey = "diagnosis" | "games" | "weaknesses" | "clock" | "openings" | "plan";

// En la demo no hay plan de entrenamiento: el diagnóstico es más corto
const SECTIONS: { id: string; key: SectionKey }[] = [
  { id: "diagnostico", key: "diagnosis" },
  { id: "partidas", key: "games" },
  { id: "debilidades", key: "weaknesses" },
  { id: "reloj", key: "clock" },
  { id: "aperturas", key: "openings" },
  ...(IS_DEMO ? [] : [{ id: "plan", key: "plan" as const }]),
];

function DashboardContent() {
  const searchParams = useSearchParams();
  const usernameParam = searchParams.get("username") || "";
  const [lastUser, saveLastUser] = useLastUsername();
  const { m, fmt, path, lang } = useI18n();
  const d = m.dashboard;

  const [summary, setSummary] = useState<PlayerDiagnosisSummary | null>(null);
  const [tutor, setTutor] = useState<TutorPedagogicalReport | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!usernameParam) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [sumData, tutorData] = await Promise.all([store.getSummary(usernameParam), store.getReport(usernameParam, lang)]);
        if (cancelled) return;
        setSummary(sumData);
        setTutor(tutorData);
        if (!isExampleUser(usernameParam)) saveLastUser(usernameParam);
      } catch (err: unknown) {
        if (!cancelled) setError(err ?? new Error());
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
  }, [usernameParam, saveLastUser, lang]);

  if (!usernameParam) {
    return (
      <EmptyState
        title={d.empty.title}
        text={d.empty.text}
        action={
          <div className="flex flex-col items-center gap-2">
            <Link href={path("/")} className={buttonClasses("primary", "md")}>
              {d.empty.cta}
            </Link>
            {lastUser && (
              <Link href={path(`/dashboard?username=${encodeURIComponent(lastUser)}`)} className={buttonClasses("ghost", "sm")}>
                {d.empty.seeLast(lastUser)}
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
        title={d.notFound.title}
        text={`${error ? errorText(error, m) : d.notFound.fallback} ${store.mode === "demo" ? d.notFound.demoNote : d.notFound.fullNote}`}
        action={
          <Link href={path(`/?username=${encodeURIComponent(usernameParam)}`)} className={buttonClasses("primary", "md")}>
            <RefreshCw className="h-4 w-4" aria-hidden /> {d.notFound.reanalyze(usernameParam)}
          </Link>
        }
      />
    );
  }

  const p = summary.player;
  const om = summary.overall_metrics;
  const err = summary.error_breakdown;
  const trainerHref = path(`/trainer?username=${encodeURIComponent(p.username)}`);
  // Fechas reales de las partidas, en el idioma de la interfaz (el `period` guardado está en español)
  const stamps = (summary.games ?? []).map((g) => g.end_time).filter((t) => t > 0);
  const period = stamps.length ? fmt.dateRange(Math.min(...stamps), Math.max(...stamps)) : p.period === "Recent Archives" ? d.header.recent : p.period;

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
                {isExampleUser(p.username) && <Badge tone="violet">{d.header.example}</Badge>}
                <Badge>{m.labels.timeClass[p.time_class] ?? p.time_class}</Badge>
                <Badge>{d.header.games(p.games_analyzed)}</Badge>
                {summary.engine_profile === "low_power" && (
                  <Badge tone="amber" title={d.header.quickTitle}>
                    {d.header.quick}
                  </Badge>
                )}
              </div>
              <h1 className="mt-2 truncate font-display text-3xl font-semibold text-ivory sm:text-4xl">{p.username}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ivory-faint">
                <span>
                  {d.header.elo} <strong className="num text-ivory">{p.elo_current}</strong>
                </span>
                <span>{period}</span>
                {profile?.url && (
                  <a href={profile.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brass-300">
                    Chess.com <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <AccuracyRing value={om.accuracy_score} className="h-20 w-20 sm:h-28 sm:w-28" />
            <Link href={trainerHref} className={buttonClasses("primary", "lg", "flex-1 whitespace-nowrap px-4 sm:px-6 lg:flex-none")}>
              <Target className="h-5 w-5" aria-hidden />
              <span className="sm:hidden">{d.header.trainShort}</span>
              <span className="hidden sm:inline">{d.header.trainLong}</span>
              <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
            </Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label={d.kpi.wins}
          value={Math.round(om.win_rate * 100)}
          suffix="%"
          icon={TrendingUp}
          tone="emerald"
          hint={<ResultBar win={om.win_rate} draw={om.draw_rate} loss={om.loss_rate} />}
        />
        <StatTile
          label={d.kpi.cpl}
          value={om.avg_centipawn_loss}
          decimals={1}
          suffix="CPL"
          icon={Gauge}
          tone="cyan"
          hint={d.kpi.cplHint}
          style={{ animationDelay: "60ms" }}
        />
        <StatTile
          label={d.kpi.blunders}
          value={err.blunders_total}
          icon={Flame}
          tone="rose"
          hint={d.kpi.blundersHint(fmt.numMax(err.blunders_per_game, 2))}
          style={{ animationDelay: "120ms" }}
        />
        <StatTile
          label={d.kpi.mistakes}
          value={err.errors_total + err.inaccuracies_total}
          icon={AlertOctagon}
          tone="amber"
          hint={d.kpi.mistakesHint(err.errors_total, err.inaccuracies_total)}
          style={{ animationDelay: "180ms" }}
        />
      </div>

      {p.games_analyzed < 10 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-sm text-amber-100">
          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          {d.smallSample(p.games_analyzed)}
        </p>
      )}

      {/* Índice de secciones */}
      <nav
        aria-label={d.sections.aria}
        className="sticky top-16 z-30 -mx-4 hidden border-y border-ink-600/50 bg-ink-900/85 px-4 py-2 backdrop-blur-lg md:block lg:-mx-8 lg:px-8"
      >
        <ul className="flex gap-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="rounded-lg px-3 py-1.5 text-sm text-ivory-faint transition-colors hover:bg-ink-750 hover:text-ivory"
              >
                {d.sections[s.key]}
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
          compact={IS_DEMO}
        />
      </div>

      <div id="partidas" className="scroll-mt-32">
        <GamesOverview stats={summary.game_stats} games={summary.games} username={p.username} />
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

      {!IS_DEMO && (
        <div id="plan" className="scroll-mt-32">
          <StudyPlanCard plan={tutor.weekly_plan} username={p.username} />
        </div>
      )}

      {/* Cierre */}
      <Card tone="inset" className="flex flex-col items-center gap-4 p-8 text-center">
        <h2 className="font-display text-2xl font-semibold text-ivory">{d.closing.title}</h2>
        <p className="max-w-lg text-sm text-ivory-muted">{d.closing.text}</p>
        <Link href={trainerHref} className={buttonClasses("primary", "lg")}>
          {d.closing.cta} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <FeedbackLink label={d.closing.feedback} className="text-sm" />
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
  const { m, fmt } = useI18n();
  return (
    <div className="mt-1 space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <div className="bg-emerald-400" style={{ width: `${win * 100}%` }} />
        <div className="bg-ivory-faint" style={{ width: `${draw * 100}%` }} />
        <div className="bg-rose-400" style={{ width: `${loss * 100}%` }} />
      </div>
      <div className="num">{m.dashboard.kpi.winsHint(fmt.pct(Math.round(draw * 100), 0), fmt.pct(Math.round(loss * 100), 0))}</div>
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
  const { m } = useI18n();
  return (
    <div className="space-y-10" aria-busy="true" aria-label={m.dashboard.loading.aria}>
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
      <p className="text-center text-sm text-ivory-faint">{m.dashboard.loading.text}</p>
    </div>
  );
}

export default function DashboardView() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
