"use client";

import React from "react";
import Link from "next/link";
import { AlgorithmicFlag, TutorLeak } from "@/types/api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { SeverityBadge, SEVERITY_STRIPE } from "@/components/ui/Badge";
import { trainerHrefForFlag } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { Target, BookOpen, Quote, Brain, ArrowRight, Stethoscope } from "lucide-react";

interface DiagnosisCardProps {
  leaks: TutorLeak[];
  flags: AlgorithmicFlag[];
  overview: string;
  greeting?: string;
  mentalTip: string;
  username: string;
  /** Demo: solo las fugas, con el hábito a entrenar (sin resumen, concepto ni consejo mental). */
  compact?: boolean;
}

/** El informe numera las fugas ("Fuga #1: …" / "Leak #1: …"); la tarjeta ya muestra el número. */
const leakTitle = (title: string) => title.replace(/^(Fuga|Leak) #\d+:\s*/, "");

export const DiagnosisCard: React.FC<DiagnosisCardProps> = ({ leaks, flags, overview, greeting, mentalTip, username, compact }) => {
  const { m, path } = useI18n();
  const t = m.dashboard.diagnosis;
  if (compact) return <CompactDiagnosis leaks={leaks} flags={flags} username={username} />;
  return (
    <section aria-labelledby="diagnostico-titulo" className="space-y-5">
      <SectionHeader id="diagnostico-titulo" icon={Stethoscope} eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />

      {/* Resumen del profesor */}
      <Card tone="raised" className="relative overflow-hidden p-6 sm:p-7">
        <Quote className="absolute -right-2 -top-2 h-24 w-24 text-brass-400/[0.07]" aria-hidden />
        {greeting && <p className="font-display text-lg text-brass-200">{greeting}</p>}
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ivory-muted">{overview}</p>
      </Card>

      {/* Fugas */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {leaks.map((leak, idx) => (
          <Card
            key={idx}
            className="relative flex animate-fade-up flex-col overflow-hidden p-6 pl-7 transition-colors hover:border-ink-500"
            style={{ animationDelay: `${idx * 90}ms` }}
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${SEVERITY_STRIPE[leak.severity] ?? "bg-ink-500"}`} aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              <SeverityBadge severity={leak.severity} />
              <span className="num font-display text-3xl font-semibold text-ink-500">{idx + 1}</span>
            </div>
            <h3 className="font-display text-lg font-semibold leading-snug text-ivory">{leakTitle(leak.title)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ivory-muted">{leak.explanation}</p>

            <div className="mt-auto space-y-2.5 pt-5">
              <div className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-3 text-xs">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-brass-300">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden /> {t.concept}
                </div>
                <div className="text-ivory-muted">{leak.tactical_concept}</div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Target className="h-3.5 w-3.5" aria-hidden /> {t.habit}
                </div>
                <div className="text-emerald-100/85">{leak.actionable_advice}</div>
              </div>
              <Link
                href={path(trainerHrefForFlag(flags[idx]?.code, username))}
                className="group flex items-center justify-between rounded-xl px-1 pt-2 text-sm font-semibold text-brass-300 hover:text-brass-200"
              >
                {t.train}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* Consejo mental */}
      <div className="flex items-start gap-4 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.08] to-transparent p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
          <Brain className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-violet-200">{t.mental}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ivory-muted">{mentalTip}</p>
        </div>
      </div>
    </section>
  );
};

function CompactDiagnosis({ leaks, flags, username }: Pick<DiagnosisCardProps, "leaks" | "flags" | "username">) {
  const { m, path } = useI18n();
  const t = m.dashboard.diagnosis;
  return (
    <section aria-labelledby="diagnostico-titulo" className="space-y-5">
      <SectionHeader id="diagnostico-titulo" icon={Stethoscope} eyebrow={t.eyebrowCompact} title={t.title} subtitle={t.subtitleCompact} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {leaks.map((leak, idx) => (
          <Card
            key={idx}
            className="relative flex animate-fade-up flex-col overflow-hidden p-5 pl-6"
            style={{ animationDelay: `${idx * 90}ms` }}
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${SEVERITY_STRIPE[leak.severity] ?? "bg-ink-500"}`} aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-base font-semibold leading-snug text-ivory">{leakTitle(leak.title)}</h3>
              <SeverityBadge severity={leak.severity} />
            </div>
            <p className="mt-2 flex gap-1.5 text-sm leading-relaxed text-ivory-muted">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
              {leak.actionable_advice}
            </p>
            <Link
              href={path(trainerHrefForFlag(flags[idx]?.code, username))}
              className="group mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-brass-300 hover:text-brass-200"
            >
              {t.train}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
