"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { reportError } from "@/lib/telemetry";

/** Error al pintar una página: en vez de una pantalla en blanco, mensaje y opción de recargar. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { where: "page_error_boundary" });
  }, [error]);

  return (
    <Card className="mx-auto mt-8 max-w-lg animate-fade-up p-8 text-center sm:p-10">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
        <AlertOctagon className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-semibold text-ivory">Algo se ha roto en esta página</h1>
      <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-ivory-muted">
        Tus análisis y tu progreso siguen guardados. Prueba a recargar; si vuelve a pasar, cuéntanoslo.
      </p>
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={() => (reset(), window.location.reload())} className={buttonClasses("primary", "md")}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Recargar
        </button>
        <Link href="/" className={buttonClasses("ghost", "sm")}>
          Volver al inicio
        </Link>
      </div>
    </Card>
  );
}
