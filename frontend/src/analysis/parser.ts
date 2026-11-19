/** Port de `backend/app/modules/chesscom/parser.py`. */
import { Chess } from "chess.js";
import type { Color, MoveWithClock, NormalizedGame, Termination } from "./types";
import { pyRound } from "./scoring";

const CLK_PATTERN = /\[%clk\s+([0-9:.]+)\]/;

export function parseClockString(clock: string): number | null {
  const parts = clock.trim().split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

export function extractClockFromComment(comment: string | null | undefined): number | null {
  if (!comment) return null;
  const m = comment.match(CLK_PATTERN);
  return m ? parseClockString(m[1]) : null;
}

/** "600" -> [600, 0], "180+2" -> [180, 2]; diarias o desconocido -> [0, 0]. */
export function parseTimeControl(tc: string): [number, number] {
  if (!tc || tc.includes("/")) return [0, 0];
  const [base, inc] = tc.split("+", 2);
  const b = Number(base);
  const i = inc === undefined ? 0 : Number(inc);
  return Number.isNaN(b) || Number.isNaN(i) ? [0, 0] : [b, i];
}

export function formatOpeningFromUrl(ecoUrl: string | undefined): string {
  if (!ecoUrl) return "";
  const slug = ecoUrl.replace(/\/+$/, "").split("/").pop() ?? "";
  return slug.replace(/-/g, " ");
}

function parseEndTime(headers: Record<string, string>): number {
  const endTime = headers["EndTime"] ?? "";
  if (/^\d+$/.test(endTime)) return Number(endTime);
  const date = headers["EndDate"] || headers["UTCDate"] || headers["Date"];
  const m = date && endTime ? `${date} ${endTime}`.match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/) : null;
  if (!m) return 0;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Math.floor(Date.UTC(y, mo - 1, d, h, mi, s) / 1000);
}

/** Comentario asociado a cada jugada del movetext, en orden (python-chess: `node.comment`). */
function commentsPerPly(pgn: string): (string | null)[] {
  const movetext = pgn.replace(/^\s*\[[^\]]*\]\s*$/gm, "");
  const tokens = movetext.match(/\{[^}]*\}|[^\s{}]+/g) ?? [];
  const out: (string | null)[] = [];
  for (const tok of tokens) {
    if (tok.startsWith("{")) {
      if (out.length) out[out.length - 1] = (out[out.length - 1] ?? "") + tok.slice(1, -1);
    } else if (/^\d+\.+$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok) || tok.startsWith("$")) {
      continue;
    } else {
      out.push(null);
    }
  }
  return out;
}

// Orden importante: "timeout vs insufficient material" antes que "on time" e "insufficient".
const TERMINATIONS: [string, Termination][] = [
  ["timeout vs insufficient", "timeout_vs_insufficient"],
  ["on time", "timeout"],
  ["checkmate", "checkmate"],
  ["resignation", "resignation"],
  ["abandoned", "abandoned"],
  ["agreement", "agreement"],
  ["repetition", "repetition"],
  ["stalemate", "stalemate"],
  ["insufficient", "insufficient"],
  ["50-move", "fifty_moves"],
  ["50 move", "fifty_moves"],
];

/** Port de `parse_termination`: "X won on time" -> "timeout". */
export function parseTermination(text: string): Termination {
  const t = text.toLowerCase();
  return TERMINATIONS.find(([needle]) => t.includes(needle))?.[1] ?? "other";
}

export function parseGamePgn(pgn: string, targetUsername: string): NormalizedGame | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  const headers = chess.getHeaders() as Record<string, string>;
  const white = headers["White"] ?? "Unknown";
  const black = headers["Black"] ?? "Unknown";
  const target = targetUsername.toLowerCase();
  const isWhite = white.toLowerCase() === target;
  const isBlack = black.toLowerCase() === target;
  if (!isWhite && !isBlack) return null;

  const userColor: Color = isWhite ? "white" : "black";
  const result = headers["Result"] ?? "*";
  let userResult: NormalizedGame["user_result"] = "draw";
  if (result === "1-0") userResult = isWhite ? "win" : "loss";
  else if (result === "0-1") userResult = isWhite ? "loss" : "win";

  const timeControl = headers["TimeControl"] ?? "";
  const [baseTime, increment] = parseTimeControl(timeControl);
  const rating = (v: string | undefined) => (v && /^-?\d+$/.test(v) ? Number(v) : 0);
  const eco = headers["ECO"] ?? "Unknown";
  const openingName = formatOpeningFromUrl(headers["ECOUrl"]) || headers["Opening"] || "Unknown Opening";

  const prevClocks: Record<Color, number> = {
    white: baseTime > 0 ? baseTime : 600,
    black: baseTime > 0 ? baseTime : 600,
  };
  const history = chess.history({ verbose: true });
  const comments = commentsPerPly(pgn);

  const moves: MoveWithClock[] = history.map((mv, i) => {
    const ply = i + 1;
    const turn: Color = mv.color === "w" ? "white" : "black";
    let remaining = extractClockFromComment(comments[i]);
    let spent = 0;
    if (remaining === null) {
      remaining = prevClocks[turn];
    } else {
      spent = Math.max(0, prevClocks[turn] - remaining + increment);
      prevClocks[turn] = remaining;
    }
    return {
      ply,
      move_number: Math.floor((ply + 1) / 2),
      turn,
      san: mv.san,
      uci: mv.from + mv.to + (mv.promotion ?? ""),
      fen_before: mv.before,
      fen_after: mv.after,
      clock_remaining_seconds: pyRound(remaining, 2),
      time_spent_seconds: pyRound(spent, 2),
    };
  });

  const endTime = parseEndTime(headers);
  let gameId = (headers["Link"] ?? headers["Site"] ?? "").replace(/\/+$/, "").split("/").pop() ?? "";
  if (!gameId || gameId === "chess.com") gameId = `game_${endTime}_${white}_${black}`;

  return {
    id: gameId,
    url: headers["Link"] ?? `https://www.chess.com/game/live/${gameId}`,
    white_username: white,
    white_rating: rating(headers["WhiteElo"]),
    white_result: headers["WhiteResult"] ?? result,
    black_username: black,
    black_rating: rating(headers["BlackElo"]),
    black_result: headers["BlackResult"] ?? result,
    user_color: userColor,
    user_result: userResult,
    time_control: timeControl,
    time_class: headers["TimeClass"] ?? "rapid",
    eco,
    opening_name: openingName,
    end_time: endTime,
    moves_count: moves.length,
    moves,
    termination: parseTermination(headers["Termination"] ?? ""),
  };
}
