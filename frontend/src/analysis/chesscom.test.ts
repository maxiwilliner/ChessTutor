import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecentGames, retryTiming, MONTHS_PER_BATCH, archiveLabel } from "./chesscom";

const PGN = (white: string, black: string) =>
  `[White "${white}"]\n[Black "${black}"]\n[Result "1-0"]\n[TimeControl "600"]\n[Link "https://www.chess.com/game/live/${Math.random()}"]\n\n1. e4 e5 1-0`;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());
retryTiming.sleep = async () => undefined;

describe("cliente de Chess.com en el navegador", () => {
  it("reintenta errores de red (bloqueos sin CORS) antes de rendirse", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls++;
      if (url.endsWith("/stats")) return json({ chess_rapid: { record: { win: 1 } } });
      if (calls <= 3) throw new TypeError("Load failed");
      if (url.endsWith("/archives")) return json({ archives: ["https://api.chess.com/pub/player/me/games/2026/10"] });
      return json({ games: [{ time_class: "rapid", rules: "chess", pgn: PGN("demo_me", "you"), end_time: 1 }] });
    }));
    const games = await getRecentGames("demo_me", "rapid", 5);
    expect(games).toHaveLength(1);
    expect(calls).toBe(5); // stats + 2 fallos + archivos + mes
  });

  it("tras agotar los reintentos da un error claro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Load failed");
    }));
    await expect(getRecentGames("demo_me", "rapid", 5)).rejects.toThrow(/No se pudo contactar con Chess.com/);
  });

  it("pide los meses en lotes, en orden, ignora variantes y para al llegar al límite", async () => {
    const months = Array.from({ length: 7 }, (_, i) => `https://api.chess.com/pub/player/me/games/2026/${String(i + 1).padStart(2, "0")}`);
    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      requested.push(url);
      if (url.endsWith("/stats")) return json({ chess_rapid: { record: { win: 3, loss: 2 } } });
      if (url.endsWith("/archives")) return json({ archives: months });
      const m = Number(url.slice(-2));
      // Solo los meses 7 y 3 tienen partidas rápidas estándar; el 6 tiene una de Chess960
      const games =
        m === 6 ? [{ time_class: "rapid", rules: "chess960", pgn: PGN("demo_me", "x") }]
        : m === 7 || m === 3 ? [{ time_class: "rapid", rules: "chess", pgn: PGN("demo_me", `m${m}`) }]
        : [{ time_class: "blitz", rules: "chess", pgn: PGN("demo_me", "b") }];
      return json({ games });
    }));
    const seen: string[] = [];
    const games = await getRecentGames("demo_me", "rapid", 2, undefined, (label) => seen.push(label));
    expect(games.map((g) => g.black_username)).toEqual(["m7", "m3"]);
    // Dos lotes de 3 meses (7-6-5 y 4-3-2): el mes 1 no hace falta
    expect(requested.filter((u) => u.includes("/games/2026/"))).toHaveLength(2 * MONTHS_PER_BATCH);
    expect(seen).toEqual(["2026-05", "2026-02"]);
  });

  it("sin partidas puntuadas del ritmo solo mira los 3 meses más recientes", async () => {
    const months = Array.from({ length: 12 }, (_, i) => `https://api.chess.com/pub/player/me/games/2026/${String(i + 1).padStart(2, "0")}`);
    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      requested.push(url);
      if (url.endsWith("/stats")) return json({ chess_blitz: { record: { win: 10 } } });
      if (url.endsWith("/archives")) return json({ archives: months });
      return json({ games: [{ time_class: "blitz", rules: "chess", pgn: PGN("demo_me", "b") }] });
    }));
    expect(await getRecentGames("demo_me", "rapid", 5)).toEqual([]);
    expect(requested.filter((u) => u.includes("/games/2026/"))).toHaveLength(MONTHS_PER_BATCH);
  });

  it("si /stats falla se recorre el historial como siempre", async () => {
    const months = Array.from({ length: 6 }, (_, i) => `https://api.chess.com/pub/player/me/games/2026/${String(i + 1).padStart(2, "0")}`);
    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      requested.push(url);
      if (url.endsWith("/stats")) return json({}, 503);
      if (url.endsWith("/archives")) return json({ archives: months });
      return json({ games: [] });
    }));
    expect(await getRecentGames("demo_me", "rapid", 5)).toEqual([]);
    expect(requested.filter((u) => u.includes("/games/2026/"))).toHaveLength(6);
  });

  it("etiqueta de mes", () => {
    expect(archiveLabel("https://api.chess.com/pub/player/me/games/2025/10")).toBe("oct 2025");
  });
});
