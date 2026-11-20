"use client";

import React from "react";
import Link from "next/link";
import { APP_MODE } from "@/lib/mode";
import { FEEDBACK_URL } from "@/lib/site";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-semibold text-ivory">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ivory-muted">{children}</div>
    </section>
  );
}

const bold = (t: React.ReactNode) => <strong className="text-ivory">{t}</strong>;
const code = (t: React.ReactNode) => <code className="num text-ivory">{t}</code>;
const linkCls = "text-brass-300 hover:underline";

export default function PrivacyView() {
  const { m, path } = useI18n();
  const t = m.privacy;
  const demo = APP_MODE === "demo";
  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <h1 className="font-display text-3xl font-semibold text-ivory sm:text-4xl">{t.title}</h1>
      <p className="mt-2 text-sm text-ivory-faint">{t.subtitle}</p>

      <Card className="mt-8 space-y-8 p-6 sm:p-8">
        <Section title={t.dataTitle}>
          <p>{t.dataText(bold)}</p>
        </Section>

        <Section title={t.whereTitle}>
          {demo ? (
            <>
              <p>{t.whereDemo(bold)}</p>
              <p>{t.whereDemoApi(code)}</p>
            </>
          ) : (
            <p>{t.whereFull}</p>
          )}
        </Section>

        <Section title={t.cookiesTitle}>
          <p>{t.cookiesText}</p>
          <p>{t.errorsText}</p>
        </Section>

        <Section title={t.deleteTitle}>
          <p>{demo ? t.deleteDemo : t.deleteFull}</p>
        </Section>

        <Section title={t.thirdTitle}>
          <p>
            {t.thirdText(
              <a href="https://stockfishchess.org" target="_blank" rel="noreferrer" className={linkCls}>
                Stockfish
              </a>,
              demo && (
                <>
                  {" "}(
                  <a href="/engine/COPYING.txt" className={linkCls}>
                    {t.licenseText}
                  </a>{" "}
                  ·{" "}
                  <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer" className={linkCls}>
                    {t.sourceCode}
                  </a>
                  )
                </>
              )
            )}
          </p>
        </Section>

        {FEEDBACK_URL && (
          <Section title={t.contactTitle}>
            <p>
              {t.contactText(
                <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className={linkCls}>
                  {t.feedbackForm}
                </a>
              )}
            </p>
          </Section>
        )}
      </Card>

      <p className="mt-6 text-center text-sm">
        <Link href={path("/")} className={linkCls}>
          {m.actions.backHome}
        </Link>
      </p>
    </div>
  );
}
