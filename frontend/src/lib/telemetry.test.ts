import { describe, expect, it } from "vitest";
import { scrubDeep, scrubText } from "./telemetry";
import { isChunkLoadError } from "@/components/layout/Telemetry";

describe("informes de errores sin datos personales", () => {
  it("quita nombres de usuario de URLs y mensajes", () => {
    expect(scrubText("https://x.app/dashboard?username=Pepe_99&mode=all")).toBe("https://x.app/dashboard?username=[usuario]&mode=all");
    expect(scrubText("GET https://api.chess.com/pub/player/pepe_99/games/archives")).toBe("GET https://api.chess.com/pub/player/[usuario]/games/archives");
    expect(scrubText("No existe el usuario «pepe» en Chess.com")).toBe("No existe el usuario «[usuario]» en Chess.com");
  });

  it("recorre eventos anidados", () => {
    const ev = { request: { url: "/trainer?username=ana" }, breadcrumbs: [{ data: { url: "https://api.chess.com/pub/player/ana/stats" } }], level: 1 };
    expect(JSON.stringify(scrubDeep(ev))).not.toContain("ana");
  });

  it("reconoce errores de carga de chunks tras un despliegue", () => {
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "Loading chunk 123 failed." })).toBe(true);
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /_next/x.js"))).toBe(true);
    expect(isChunkLoadError(new Error("otra cosa"))).toBe(false);
  });
});
