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

export type ChessComErrorKind = "invalid_username" | "rate_limited" | "network" | "server";

export class ChessComError extends Error {
  constructor(message: string, readonly kind: ChessComErrorKind) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET con reintentos ante 429/5xx. Devuelve null si el recurso no existe (404). */
async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new ChessComError("No se pudo contactar con Chess.com. Revisa tu conexión a internet.", "network");
    }
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000, 10_000));
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
  end_time?: number;
}

/** Últimas `limit` partidas del ritmo pedido, de la más reciente a la más antigua. */
export async function getRecentGames(
  username: string,
  timeClass: string,
  limit: number,
  signal?: AbortSignal
): Promise<NormalizedGame[]> {
  checkUsername(username);
  const user = username.toLowerCase();
  const archives = (await getJson<{ archives: string[] }>(`${BASE}/player/${user}/games/archives`, signal))?.archives ?? [];
  const games: NormalizedGame[] = [];
  for (const url of [...archives].reverse()) {
    const raw = (await getJson<{ games: RawGame[] }>(url, signal))?.games ?? [];
    for (const g of [...raw].reverse()) {
      if (timeClass && g.time_class !== timeClass) continue;
      if (!g.pgn) continue;
      const game = parseGamePgn(g.pgn, username);
      if (!game) continue;
      if (typeof g.end_time === "number") game.end_time = g.end_time;
      games.push(game);
      if (games.length >= limit) return games;
    }
  }
  return games;
}
