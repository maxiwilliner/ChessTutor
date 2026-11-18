/**
 * Lógica del entrenador sin servidor (modo demo). Port de `backend/app/db/puzzle_service.py`
 * y de la evaluación de jugadas alternativas de `endpoints/trainer.py`.
 */
import type {
  BlunderBankItem,
  EvaluateMoveResponse,
  PuzzleAttemptRequest,
  PuzzleAttemptResponse,
  TrainerStatsResponse,
} from "@/types/api";
import type { GetPuzzlesFilter } from "@/lib/api";
import type { Engine } from "@/analysis/engine/pool";
import { Chess } from "chess.js";
import { uciToMove } from "@/analysis/notation";

export const GENERIC_THEME = "tactical_inaccuracy";

export interface PuzzleProgress {
  key: string;
  username: string;
  puzzle_id: string;
  attempts_count: number;
  consecutive_correct: number;
  is_mastered: boolean;
  next_review_at: string | null;
  last_attempt_at: string | null;
  last_solved: boolean;
  last_hints_used: number;
  repeated_old_blunder_count: number;
}

export const progressKey = (username: string, puzzleId: string) => `${username.toLowerCase()}|${puzzleId}`;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export function applyAttempt(
  prev: PuzzleProgress | undefined,
  req: PuzzleAttemptRequest,
  now: Date = new Date()
): { progress: PuzzleProgress; response: PuzzleAttemptResponse } {
  const username = req.username.trim().toLowerCase();
  const p: PuzzleProgress = prev
    ? { ...prev }
    : {
        key: progressKey(username, req.puzzle_id),
        username,
        puzzle_id: req.puzzle_id,
        attempts_count: 0,
        consecutive_correct: 0,
        is_mastered: false,
        next_review_at: null,
        last_attempt_at: null,
        last_solved: false,
        last_hints_used: 0,
        repeated_old_blunder_count: 0,
      };
  const hints = req.hints_used ?? 0;
  const mistakes = req.mistakes ?? 0;
  const at = (ms: number) => new Date(now.getTime() + ms).toISOString();

  p.attempts_count += 1;
  p.last_attempt_at = now.toISOString();
  p.last_solved = req.is_solved;
  p.last_hints_used = hints;
  if (req.repeated_old_blunder) p.repeated_old_blunder_count += 1;

  let message: string;
  if (req.is_solved && (hints > 0 || mistakes > 0)) {
    p.consecutive_correct = 0;
    p.is_mastered = false;
    p.next_review_at = at(DAY);
    message = "Resuelto con ayuda. Lo repasamos mañana para fijarlo sin pistas.";
  } else if (req.is_solved) {
    p.consecutive_correct += 1;
    if (p.consecutive_correct >= 3) {
      p.is_mastered = true;
      p.next_review_at = at(7 * DAY);
      message = "¡Posición dominada! Repaso programado en 7 días.";
    } else if (p.consecutive_correct === 2) {
      p.is_mastered = false;
      p.next_review_at = at(3 * DAY);
      message = "¡Gran avance! Segundo acierto consecutivo. Repaso en 3 días.";
    } else {
      p.is_mastered = false;
      p.next_review_at = at(DAY);
      message = "¡Correcto! Repaso programado para mañana.";
    }
  } else {
    p.consecutive_correct = 0;
    p.is_mastered = false;
    p.next_review_at = at(15 * MIN);
    message = req.repeated_old_blunder
      ? "Has repetido tu error de la partida. Repaso programado en 15 minutos."
      : "Intento no resuelto. Repaso programado en 15 minutos.";
  }

  return {
    progress: p,
    response: {
      puzzle_id: req.puzzle_id,
      username,
      is_solved: req.is_solved,
      consecutive_correct: p.consecutive_correct,
      is_mastered: p.is_mastered,
      next_review_at: p.next_review_at,
      message,
    },
  };
}

export function withProgress(item: BlunderBankItem, p: PuzzleProgress | undefined): BlunderBankItem {
  return {
    ...item,
    is_mastered: p?.is_mastered ?? false,
    consecutive_correct: p?.consecutive_correct ?? 0,
    next_review_at: p?.next_review_at ?? null,
    attempts_count: p?.attempts_count ?? 0,
    repeated_blunder_count: p?.repeated_old_blunder_count ?? 0,
  };
}

/** Tema con más ejercicios, sin contar el genérico (como get_user_puzzles con top_leak_only). */
export function topLeakTheme(puzzles: BlunderBankItem[]): string | null {
  const counts = new Map<string, number>();
  puzzles.forEach((p) => {
    const t = p.classification.theme;
    if (t !== GENERIC_THEME) counts.set(t, (counts.get(t) ?? 0) + 1);
  });
  let best: string | null = null;
  counts.forEach((n, t) => {
    if (best === null || n > counts.get(best)!) best = t;
  });
  return best;
}

/** Filtros y orden de entrenamiento: vencidos -> nuevos -> en curso -> dominados; peor error primero. */
export function selectPuzzles(
  puzzles: BlunderBankItem[],
  progress: Map<string, PuzzleProgress>,
  filter: GetPuzzlesFilter = {},
  now: Date = new Date(),
  /** Ids del último análisis en su orden (partida más reciente primero). Si se pasan, solo esos y en ese orden. */
  latestIds?: string[]
): BlunderBankItem[] {
  const latestIndex = latestIds ? new Map(latestIds.map((id, i) => [id, i])) : null;
  const pool = latestIndex ? puzzles.filter((p) => latestIndex.has(p.id)) : puzzles;
  const theme = filter.theme ?? (filter.top_leak_only ? topLeakTheme(pool) : null);
  const status = filter.status ?? "all";
  const priority = (p: PuzzleProgress | undefined) => {
    if (p?.next_review_at && new Date(p.next_review_at) <= now) return 0;
    if (!p) return 1;
    return p.is_mastered ? 3 : 2;
  };
  const byTraining = (a: BlunderBankItem, b: BlunderBankItem) =>
    priority(progress.get(a.id)) - priority(progress.get(b.id)) ||
    b.engine_solution.cpl - a.engine_solution.cpl ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const byAnalysis = (a: BlunderBankItem, b: BlunderBankItem) => latestIndex!.get(a.id)! - latestIndex!.get(b.id)!;
  return pool
    .filter((item) => {
      const p = progress.get(item.id);
      if (theme && item.classification.theme !== theme) return false;
      if (filter.psych_tag && item.classification.psychological_tag !== filter.psych_tag) return false;
      if (status === "unsolved") return !p || !p.is_mastered;
      if (status === "mastered") return !!p?.is_mastered;
      if (status === "review_due") return !!p?.next_review_at && new Date(p.next_review_at) <= now;
      return true;
    })
    .sort(latestIndex ? byAnalysis : byTraining)
    .slice(0, filter.limit ?? 200)
    .map((item) => withProgress(item, progress.get(item.id)));
}

export function trainerStats(
  username: string,
  bank: BlunderBankItem[],
  progress: Map<string, PuzzleProgress>,
  now: Date = new Date(),
  /** Ids del último análisis: las cifras se calculan solo sobre ellos (salvo los repasos pendientes). */
  latestIds?: string[]
): TrainerStatsResponse {
  const wanted = latestIds ? new Set(latestIds) : null;
  const puzzles = wanted ? bank.filter((p) => wanted.has(p.id)) : bank;
  const due = bank.filter((p) => {
    const next = progress.get(p.id)?.next_review_at;
    return !!next && new Date(next) <= now;
  }).length;
  const themes: Record<string, { total: number; solved: number; mastered: number }> = {};
  let solved = 0;
  let mastered = 0;
  let repeated = 0;
  for (const item of puzzles) {
    const th = item.classification.theme || "general";
    themes[th] ??= { total: 0, solved: 0, mastered: 0 };
    themes[th].total += 1;
    const p = progress.get(item.id);
    if (!p) continue;
    repeated += p.repeated_old_blunder_count;
    if (p.last_solved || p.consecutive_correct > 0) {
      solved += 1;
      themes[th].solved += 1;
    }
    if (p.is_mastered) {
      mastered += 1;
      themes[th].mastered += 1;
    }
  }
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const specific = Object.entries(themes).filter(([t]) => t !== GENERIC_THEME);
  const pool = specific.length ? specific : Object.entries(themes);
  const top = pool.reduce<[string, number] | null>((best, [t, c]) => (!best || c.total > best[1] ? [t, c.total] : best), null);

  return {
    username: username.toLowerCase(),
    total_puzzles: puzzles.length,
    solved_puzzles: solved,
    mastered_puzzles: mastered,
    review_due_puzzles: due,
    repeated_blunders_count: repeated,
    mastery_percentage: puzzles.length ? round1((mastered / puzzles.length) * 100) : 0,
    top_leak_theme: top?.[0] ?? null,
    bank_puzzles: bank.length,
    themes_breakdown: Object.fromEntries(
      Object.entries(themes).map(([t, c]) => [
        t,
        { theme: t, total_puzzles: c.total, solved_puzzles: c.solved, mastered_puzzles: c.mastered, success_rate: c.total ? round1((c.solved / c.total) * 100) : 0 },
      ])
    ),
  };
}

/** Port de POST /trainer/evaluate-move con el motor del navegador (profundidad 10, 100 ms). */
export async function evaluateAlternativeMove(
  puzzle: BlunderBankItem,
  playedUci: string,
  engine: Engine
): Promise<EvaluateMoveResponse> {
  const board = new Chess(puzzle.fen_before);
  const played = playedUci.toLowerCase();
  const best = puzzle.engine_solution.best_move_uci.toLowerCase();
  const blunder = puzzle.user_move.uci.toLowerCase();
  const base = { opponent_reply_uci: null, opponent_reply_san: null };

  if (played === best || played.startsWith(best.slice(0, 4))) {
    return { ...base, is_valid: true, is_best: true, is_historical_blunder: false, cpl_diff: 0, message: "¡Excelente! Has encontrado la mejor jugada del motor." };
  }
  if (played === blunder || played.startsWith(blunder.slice(0, 4))) {
    const cpl = puzzle.engine_solution.cpl;
    return {
      ...base,
      is_valid: false,
      is_best: false,
      is_historical_blunder: true,
      cpl_diff: cpl,
      message: `¡Cuidado! Esta fue la jugada que hiciste en tu partida (${puzzle.user_move.san}) y te costó ${Math.trunc(cpl)} centipeones.`,
    };
  }

  const afterOf = (uci: string) => {
    const b = new Chess(board.fen());
    b.move(uciToMove(uci));
    return b.fen();
  };
  const limits = { depth: 10, movetime: 100 };
  const [evPlayed, evBest] = await Promise.all([engine.evaluate(afterOf(played), limits), engine.evaluate(afterOf(best), limits)]);
  const sign = board.turn() === "w" ? 1 : -1;
  const scoreBest = sign * (evBest.score_cp ?? 0);
  const scorePlayed = sign * (evPlayed.score_cp ?? 0);
  const cplDiff = Math.max(0, scoreBest - scorePlayed);
  const reply = { opponent_reply_uci: evPlayed.best_move_uci, opponent_reply_san: evPlayed.best_move_san };

  if (cplDiff <= 35 || scorePlayed >= 250) {
    return {
      ...reply,
      is_valid: true,
      is_best: false,
      is_historical_blunder: false,
      cpl_diff: Math.round(cplDiff * 10) / 10,
      message: "¡Buena jugada! También gana y mantiene la ventaja, aunque había una opción más precisa del motor.",
    };
  }
  return {
    ...reply,
    is_valid: false,
    is_best: false,
    is_historical_blunder: false,
    cpl_diff: Math.round(cplDiff * 10) / 10,
    message: `Jugada legal, pero pierde ${Math.trunc(cplDiff)} centipeones respecto a la mejor opción táctica.`,
  };
}
