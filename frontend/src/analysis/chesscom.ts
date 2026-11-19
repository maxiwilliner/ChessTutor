/**
 * Cliente de la API pública de Chess.com desde el navegador (la API responde con
 * `access-control-allow-origin: *`). Equivalente a `backend/app/modules/chesscom/client.py`.
 */
import type { PlayerProfile } from "@/types/api";
import type { NormalizedGame } from "./types";
import { parseGamePgn } from "./parser";

const BASE = "https://api.chess.com/pub";
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,25}$/;
const MAX_RETRIES = 3;

export type ChessComErrorKind = "invalid_username" | "not_found" | "rate_limited" | "network" | "server";

export class ChessComError extends Error {
  constructor(message: string, readonly kind: ChessComErrorKind) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera inyectable para los tests. */
export const retryTiming = { sleep, baseDelayMs: 1000 };

/**
 * GET con reintentos. Devuelve null si el recurso no existe (404).
 * Se reintenta ante 429/5xx y también ante errores de red: cuando la protección anti-bots de Chess.com
 * responde sin cabeceras CORS, el navegador no ve el código y `fetch` lanza un TypeError.
 */
async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const wait = (attempt: number, retryAfterSec = 0) =>
    retryTiming.sleep(Math.min(retryAfterSec > 0 ? retryAfterSec * 1000 : 2 ** attempt * retryTiming.baseDelayMs, 10_000));
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (!offline && attempt < MAX_RETRIES) {
        await wait(attempt);
        continue;
      }
      throw new ChessComError(
        offline
          ? "Parece que no tienes conexión a internet. Conéctate y vuelve a intentarlo."
          : "No se pudo contactar con Chess.com. Inténtalo de nuevo en un minuto.",
        "network"
      );
    }
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      await wait(attempt, Number.isFinite(retryAfter) ? retryAfter : 0);
      continue;
    }
    if (res.status === 429) {
      throw new ChessComError("Chess.com está limitando las peticiones. Espera un minuto y vuelve a intentarlo.", "rate_limited");
    }
    throw new ChessComError(`Chess.com respondió con un error (${res.status}). Inténtalo de nuevo en unos minutos.`, "server");
  }
}

function checkUsername(username: string) {
  if (!USERNAME_RE.test(username)) {
    throw new ChessComError("Ese no parece un usuario válido de Chess.com (3-25 letras, números, «_» o «-»).", "invalid_username");
  }
}

export async function getProfile(username: string, signal?: AbortSignal): Promise<PlayerProfile | null> {
  checkUsername(username);
  const d = await getJson<Record<string, unknown>>(`${BASE}/player/${username.toLowerCase()}`, signal);
  if (!d) return null;
  return {
    username: (d.username as string) ?? username,
    title: (d.title as string) ?? null,
    status: (d.status as string) ?? null,
    avatar: (d.avatar as string) ?? null,
    country: (d.country as string) ?? null,
    joined: (d.joined as number) ?? null,
    url: (d.url as string) ?? null,
  };
}

interface RawGame {
  pgn?: string;
  time_class?: string;
  rules?: string;
  end_time?: number;
}

type PlayerStats = Record<string, { record?: { win?: number; loss?: number; draw?: number } } | undefined>;

/** Partidas puntuadas del ritmo según /stats (`chess_rapid`, `chess_blitz`...). */
export function ratedGames(stats: PlayerStats, timeClass: string): number {
  const r = stats[`chess_${timeClass}`]?.record;
  return r ? (r.win ?? 0) + (r.loss ?? 0) + (r.draw ?? 0) : 0;
}

/** Meses que se piden a la vez y tope de meses hacia atrás. */
export const MONTHS_PER_BATCH = 3;
export const MAX_MONTHS = 36;

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** ".../games/2025/10" -> "oct 2025" */
export function archiveLabel(url: string): string {
  const [y, m] = url.split("/").slice(-2).map(Number);
  return m >= 1 && m <= 12 ? `${MONTHS_ES[m - 1]} ${y}` : url;
}

/**
 * Últimas `limit` partidas estándar del ritmo pedido, de la más reciente a la más antigua.
 * Los meses se piden en lotes de MONTHS_PER_BATCH en paralelo (en orden) y como máximo MAX_MONTHS hacia atrás.
 */
export async function getRecentGames(
  username: string,
  timeClass: string,
  limit: number,
  signal?: AbortSignal,
  onMonth?: (label: string) => void
): Promise<NormalizedGame[]> {
  checkUsername(username);
  const user = username.toLowerCase();
  // Las estadísticas (en paralelo, sin coste de latencia) dicen si hay partidas puntuadas de ese ritmo. Si no hay,
  // solo se mira el lote más reciente: las no puntuadas no cuentan en /stats, pero no merece recorrer 3 años de archivos.
  const [stats, index] = await Promise.all([
    getJson<PlayerStats>(`${BASE}/player/${user}/stats`, signal).catch((e) => {
      if ((e as Error).name === "AbortError") throw e;
      return null;
    }),
    getJson<{ archives: string[] }>(`${BASE}/player/${user}/games/archives`, signal),
  ]);
  if (!index) throw new ChessComError(`No existe el usuario «${username}» en Chess.com. Revisa cómo se escribe.`, "not_found");
  const maxMonths = stats && timeClass && ratedGames(stats, timeClass) === 0 ? MONTHS_PER_BATCH : MAX_MONTHS;
  const months = [...(index.archives ?? [])].reverse().slice(0, maxMonths);
  const games: NormalizedGame[] = [];
  for (let i = 0; i < months.length; i += MONTHS_PER_BATCH) {
    const batch = months.slice(i, i + MONTHS_PER_BATCH);
    onMonth?.(archiveLabel(batch[batch.length - 1]));
    const results = await Promise.all(batch.map((url) => getJson<{ games: RawGame[] }>(url, signal)));
    for (const month of results) {
      for (const g of [...(month?.games ?? [])].reverse()) {
        if (timeClass && g.time_class !== timeClass) continue;
        // Solo ajedrez estándar: Chess960 y otras variantes comparten ritmo pero no aperturas
        if (g.rules && g.rules !== "chess") continue;
        if (!g.pgn) continue;
        const game = parseGamePgn(g.pgn, username);
        if (!game) continue;
        if (typeof g.end_time === "number") game.end_time = g.end_time;
        games.push(game);
        if (games.length >= limit) return games;
      }
    }
  }
  return games;
}
