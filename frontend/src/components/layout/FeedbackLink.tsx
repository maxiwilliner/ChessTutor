"use client";

import React from "react";
import { MessageSquareHeart } from "lucide-react";
import { FEEDBACK_URL } from "@/lib/site";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

/** Enlace al formulario de opinión. No se muestra si NEXT_PUBLIC_FEEDBACK_URL no está configurada. */
export function FeedbackLink({ className, label }: { className?: string; label?: string }) {
  const { m } = useI18n();
  if (!FEEDBACK_URL) return null;
  return (
    <a
      href={FEEDBACK_URL}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1.5 font-medium text-brass-300 hover:text-brass-200", className)}
    >
      <MessageSquareHeart className="h-4 w-4" aria-hidden />
      {label ?? m.feedback.label}
    </a>
  );
}
