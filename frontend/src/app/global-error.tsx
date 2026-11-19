"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/telemetry";

/**
 * Error en el propio layout: Next sustituye todo el HTML, así que aquí no hay estilos de la app.
 * Se usan estilos en línea con los colores del tema.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportError(error, { where: "global_error_boundary" });
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0B0F15", color: "#F3EDE2", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>ChessTutor no ha podido cargar</h1>
          <p style={{ color: "#BDB6AA", fontSize: 14, lineHeight: 1.5 }}>
            Tus análisis y tu progreso siguen guardados en este navegador. Recarga la página para volver a intentarlo.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "10px 20px", borderRadius: 12, border: 0, background: "#DDB463", color: "#0B0F15", fontWeight: 600, cursor: "pointer" }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
