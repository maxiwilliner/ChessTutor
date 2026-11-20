"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n";

export default function NotFoundView() {
  const { m, path } = useI18n();
  return (
    <Card className="mx-auto mt-8 max-w-lg animate-fade-up p-8 text-center sm:p-10">
      <div className="num font-display text-5xl font-semibold text-brass-300">404</div>
      <h1 className="mt-2 font-display text-2xl font-semibold text-ivory">{m.pages.notFoundTitle}</h1>
      <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-ivory-muted">{m.pages.notFoundText}</p>
      <Link href={path("/")} className={buttonClasses("primary", "md")}>
        {m.actions.backHome}
      </Link>
    </Card>
  );
}
