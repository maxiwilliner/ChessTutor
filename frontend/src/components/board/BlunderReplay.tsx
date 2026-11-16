"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Key } from "chessground/types";
import { DrawShape } from "chessground/draw";
import { Chess } from "chess.js";
import { BlunderBankItem, EvaluateMoveResponse } from "@/types/api";
import { store } from "@/lib/store";
import { cn } from "@/lib/cn";
import { PHASE_LABEL, PSYCH_LABEL, themeMeta } from "@/lib/labels";
import { ChessgroundBoard, BoardEffect } from "./ChessgroundBoard";
import { EvalBar } from "./EvalBar";
import { Badge } from "@/components/ui/Badge";
import { Button, Kbd } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Eye,
  Clock,
  Zap,
  Play,
  Award,
  ExternalLink,
  Loader2,
  History,
  HelpCircle,
} from "lucide-react";

interface BlunderReplayProps {
  puzzle: BlunderBankItem;
  puzzleIndex: number;
  totalPuzzles: number;
  username: string;
  onNext: () => void;
  onPrev?: () => void;
  onAttemptFinished?: (result: { isSolved: boolean; firstTry: boolean; repeatedOldBlunder: boolean }) => void;
}

type FeedbackType = "success" | "error" | "warning" | "info" | "idle";
interface PlayedMove {
  san: string;
  by: "user" | "opp";
}

const ANTI_IMPULSE_SECONDS = 5;
const OPPONENT_DELAY_MS = 650;

const toKey = (sq: string) => sq as Key;

export const BlunderReplay: React.FC<BlunderReplayProps> = ({
  puzzle,
  puzzleIndex,
  totalPuzzles,
  username,
  onNext,
  onPrev,
  onAttemptFinished,
}) => {
  const isUserWhite = puzzle.metadata.user_color === "white";
  const orientation: "white" | "black" = puzzle.metadata.user_color || puzzle.turn || "white";
  const opponentName = (isUserWhite ? puzzle.metadata.black : puzzle.metadata.white) || "Rival";
  const userColorLabel = isUserWhite ? "Blancas" : "Negras";
  const opponentColorLabel = isUserWhite ? "Negras" : "Blancas";
  const isImpulsive = puzzle.classification.psychological_tag === "impulsive";
  const theme = themeMeta(puzzle.classification.theme);
  const toWhite = useCallback((playerPawns: number) => (isUserWhite ? playerPawns : -playerPawns), [isUserWhite]);
  const moveLabel = `${puzzle.move_number}${puzzle.turn === "black" ? "..." : "."}`;

  // Tablero
  const chessRef = useRef<Chess>(new Chess(puzzle.fen_before));
  const [boardFen, setBoardFen] = useState(puzzle.fen_before);
  const [arrows, setArrows] = useState<DrawShape[]>([]);
  const [lastMove, setLastMove] = useState<[Key, Key] | null>(null);
  const [syncKey, setSyncKey] = useState(0);
  const [effect, setEffect] = useState<BoardEffect>(null);
  const [evalWhite, setEvalWhite] = useState(toWhite(puzzle.engine_solution.eval_before));
  const [confettiKey, setConfettiKey] = useState<number | null>(null);

  // Secuencia
  const activePvRef = useRef<string[]>([]);
  const [pvStepIndex, setPvStepIndex] = useState(0);
  const [played, setPlayed] = useState<PlayedMove[]>([]);

  // Estado
  const [antiImpulseCount, setAntiImpulseCount] = useState(isImpulsive ? ANTI_IMPULSE_SECONDS : 0);
  const [isOpponentMoving, setIsOpponentMoving] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [showingEngineContinuation, setShowingEngineContinuation] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string }>({ type: "idle", message: "" });

  const [explaining, setExplaining] = useState(false);
  const snapshotRef = useRef<{ fen: string; arrows: DrawShape[]; lastMove: [Key, Key] | null; evalWhite: number } | null>(null);

  const timerStartRef = useRef(0);
  const attemptsCountRef = useRef(0);
  const mistakesRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timeoutsRef.current.push(window.setTimeout(fn, ms));
  };

  // Reinicio al cambiar de ejercicio
  useEffect(() => {
    chessRef.current = new Chess(puzzle.fen_before);
    setBoardFen(puzzle.fen_before);
    setArrows([]);
    setLastMove(null);
    setEffect(null);
    setConfettiKey(null);
    setEvalWhite(toWhite(puzzle.engine_solution.eval_before));
    setHintLevel(0);
    setIsSolved(false);
    setIsFailed(false);
    setIsOpponentMoving(false);
    setIsEvaluating(false);
    setShowingEngineContinuation(false);
    setFeedback({ type: "idle", message: "" });
    setPvStepIndex(0);
    setPlayed([]);
    setExplaining(false);
    attemptsCountRef.current = 0;
    mistakesRef.current = 0;

    const pv = puzzle.engine_solution.pv_uci?.length ? puzzle.engine_solution.pv_uci : [puzzle.engine_solution.best_move_uci];
    activePvRef.current = pv.slice(0, 5);

    if (isImpulsive) {
      setAntiImpulseCount(ANTI_IMPULSE_SECONDS);
      const interval = window.setInterval(() => {
        setAntiImpulseCount((prev) => {
          if (prev <= 1) {
            window.clearInterval(interval);
            timerStartRef.current = Date.now();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => window.clearInterval(interval);
    }
    setAntiImpulseCount(0);
    timerStartRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  // Limpiar temporizadores pendientes al desmontar
  useEffect(() => () => timeoutsRef.current.forEach((t) => window.clearTimeout(t)), []);

  const isBoardLocked = antiImpulseCount > 0 || isOpponentMoving || isEvaluating || isSolved || isFailed || explaining;
  const refutationUci = puzzle.engine_solution.refutation_uci ?? [];
  const refutationSan = puzzle.engine_solution.refutation_san ?? [];
  const canExplain = (isSolved || isFailed) && refutationUci.length > 0 && !isOpponentMoving;
  const elapsedSeconds = () => Math.max(1, (Date.now() - timerStartRef.current) / 1000);

  const finishPuzzleSuccess = (lastUci: string, isFirstTry: boolean, message: string) => {
    setIsOpponentMoving(false);
    setIsSolved(true);
    setFeedback({ type: "success", message });
    setEffect("glow");
    setEvalWhite(toWhite(puzzle.engine_solution.eval_before));
    if (isFirstTry) setConfettiKey(Date.now());

    store.submitAttempt({
      username,
      puzzle_id: puzzle.id,
      played_uci: lastUci,
      is_solved: true,
      repeated_old_blunder: false,
      hints_used: hintLevel,
      mistakes: mistakesRef.current,
      time_spent_seconds: elapsedSeconds(),
    }).catch(console.error);

    onAttemptFinished?.({ isSolved: true, firstTry: isFirstTry, repeatedOldBlunder: false });
  };

  const playOpponent = (uci: string): string | null => {
    const chess = chessRef.current;
    const from = toKey(uci.slice(0, 2));
    const to = toKey(uci.slice(2, 4));
    try {
      const mv = chess.move({ from, to, promotion: uci[4] || "q" });
      setBoardFen(chess.fen());
      setLastMove([from, to]);
      setArrows([{ orig: from, dest: to, brush: "paleBlue" }]);
      return mv.san;
    } catch {
      return null;
    }
  };

  const handleMove = async (orig: Key, dest: Key) => {
    if (isBoardLocked) return;

    attemptsCountRef.current += 1;
    const isFirstTry = attemptsCountRef.current === 1 && hintLevel === 0;
    const playedUci = `${orig}${dest}`.toLowerCase();
    const chess = chessRef.current;

    let moveObj = null;
    try {
      moveObj = chess.move({ from: orig, to: dest, promotion: "q" });
    } catch {
      setSyncKey((k) => k + 1);
      return;
    }
    if (!moveObj) return;

    const expected = activePvRef.current[pvStepIndex]?.toLowerCase();

    // 1. Jugada de la línea principal
    if (expected && (playedUci === expected || playedUci.startsWith(expected.slice(0, 4)))) {
      setBoardFen(chess.fen());
      setLastMove([orig, dest]);
      setArrows([{ orig, dest, brush: "green" }]);
      setPlayed((p) => [...p, { san: moveObj!.san, by: "user" }]);

      const hasOpponentReply = pvStepIndex + 1 < activePvRef.current.length;
      if (!hasOpponentReply) {
        finishPuzzleSuccess(playedUci, isFirstTry, `¡Brillante! Encontraste ${puzzle.engine_solution.best_move_san}.`);
        return;
      }

      setIsOpponentMoving(true);
      setFeedback({ type: "success", message: `¡Exacto! ${opponentName} responde…` });
      later(() => {
        const san = playOpponent(activePvRef.current[pvStepIndex + 1].toLowerCase());
        if (san) setPlayed((p) => [...p, { san, by: "opp" }]);

        if (pvStepIndex + 2 < activePvRef.current.length) {
          setPvStepIndex(pvStepIndex + 2);
          setIsOpponentMoving(false);
          setFeedback({ type: "success", message: "¡Bien! Encuentra la siguiente jugada para rematar la ventaja." });
        } else {
          finishPuzzleSuccess(playedUci, isFirstTry, "¡Brillante! Completaste toda la combinación y recuperaste la ventaja.");
        }
      }, OPPONENT_DELAY_MS);
      return;
    }

    // 2. Repite el blunder de la partida real
    const blunderUci = puzzle.user_move.uci.toLowerCase();
    if (pvStepIndex === 0 && (playedUci === blunderUci || playedUci.startsWith(blunderUci.slice(0, 4)))) {
      chess.undo();
      setBoardFen(chess.fen());
      setSyncKey((k) => k + 1);
      setArrows([{ orig, dest, brush: "red" }]);
      setEffect("shake");
      setEvalWhite(toWhite(puzzle.engine_solution.eval_after_user_move));
      setIsFailed(true);
      setFeedback({
        type: "error",
        message: `Es la misma jugada de tu partida (${puzzle.user_move.san}). Te costó ${Math.round(
          puzzle.engine_solution.cpl
        )} centipeones. Reinicia y busca otra idea.`,
      });

      store.submitAttempt({
        username,
        puzzle_id: puzzle.id,
        played_uci: playedUci,
        is_solved: false,
        repeated_old_blunder: true,
        hints_used: hintLevel,
        time_spent_seconds: elapsedSeconds(),
      }).catch(console.error);

      onAttemptFinished?.({ isSolved: false, firstTry: false, repeatedOldBlunder: true });
      return;
    }

    // 3. Jugada alternativa: la evalúa Stockfish en el backend
    const userSan = moveObj.san;
    chess.undo();
    setSyncKey((k) => k + 1);
    setIsEvaluating(true);
    setFeedback({ type: "info", message: `Analizando ${userSan} con el motor…` });

    try {
      const evalRes: EvaluateMoveResponse = await store.evaluateMove(puzzle, playedUci, chess.fen());
      setIsEvaluating(false);

      if (evalRes.is_valid) {
        chess.move({ from: orig, to: dest, promotion: "q" });
        setBoardFen(chess.fen());
        setLastMove([orig, dest]);
        setArrows([{ orig, dest, brush: "green" }]);
        setPlayed((p) => [...p, { san: userSan, by: "user" }]);

        if (evalRes.opponent_reply_uci) {
          setIsOpponentMoving(true);
          const reply = evalRes.opponent_reply_uci.toLowerCase();
          later(() => {
            const san = playOpponent(reply);
            if (san) setPlayed((p) => [...p, { san, by: "opp" }]);
            finishPuzzleSuccess(playedUci, isFirstTry, evalRes.message);
          }, OPPONENT_DELAY_MS);
        } else {
          finishPuzzleSuccess(playedUci, isFirstTry, evalRes.message);
        }
      } else {
        mistakesRef.current += 1;
        setArrows([{ orig, dest, brush: "red" }]);
        setEffect("shake");
        const before = puzzle.engine_solution.eval_before;
        setEvalWhite(toWhite(before - evalRes.cpl_diff / 100));
        setFeedback({ type: "warning", message: evalRes.message });
        later(() => {
          setArrows([]);
          setEvalWhite(toWhite(before));
        }, 1400);
      }
    } catch {
      mistakesRef.current += 1;
      setIsEvaluating(false);
      setEffect("shake");
      setFeedback({ type: "warning", message: "Jugada legal, pero no es la idea ganadora. Prueba otra." });
      later(() => setArrows([]), 1000);
    }
  };

  const handleReset = () => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    chessRef.current = new Chess(puzzle.fen_before);
    setBoardFen(puzzle.fen_before);
    setSyncKey((k) => k + 1);
    setPvStepIndex(0);
    setPlayed([]);
    setIsSolved(false);
    setIsFailed(false);
    setIsOpponentMoving(false);
    setIsEvaluating(false);
    setArrows([]);
    setLastMove(null);
    setEffect(null);
    setConfettiKey(null);
    setExplaining(false);
    setEvalWhite(toWhite(puzzle.engine_solution.eval_before));
    setFeedback({ type: "idle", message: "" });
    timerStartRef.current = Date.now();
  };

  const handleRevealSolution = () => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    setExplaining(false);
    const best = puzzle.engine_solution.best_move_uci.toLowerCase();
    chessRef.current = new Chess(puzzle.fen_before);
    setBoardFen(puzzle.fen_before);
    setSyncKey((k) => k + 1);
    setLastMove(null);
    setArrows([{ orig: toKey(best.slice(0, 2)), dest: toKey(best.slice(2, 4)), brush: "blue" }]);
    setHintLevel(3);
    setFeedback({
      type: "warning",
      message: `Solución: ${puzzle.engine_solution.best_move_san}. Línea recomendada: ${puzzle.engine_solution.pv_san.join(" ")}`,
    });
    setIsSolved(true);
    setIsFailed(false);
    setEvalWhite(toWhite(puzzle.engine_solution.eval_before));

    store.submitAttempt({
      username,
      puzzle_id: puzzle.id,
      played_uci: best,
      // Ver la solución no es resolver: el ejercicio vuelve a la cola de repaso.
      is_solved: false,
      repeated_old_blunder: false,
      hints_used: 3,
      time_spent_seconds: elapsedSeconds(),
    }).catch(console.error);

    onAttemptFinished?.({ isSolved: false, firstTry: false, repeatedOldBlunder: false });
  };

  const handleAskHint = () => setHintLevel((prev) => Math.min(3, prev + 1));

  /** Reproduce en el tablero tu jugada de la partida y la respuesta del rival que la castiga. */
  const handleExplain = () => {
    if (!canExplain) return;
    snapshotRef.current = { fen: boardFen, arrows, lastMove, evalWhite };
    setExplaining(true);
    const board = new Chess(puzzle.fen_before);
    const blunder = puzzle.user_move.uci.toLowerCase();
    const steps = [blunder, ...refutationUci.map((u) => u.toLowerCase())];
    setBoardFen(puzzle.fen_before);
    setLastMove(null);
    setArrows([]);
    setSyncKey((k) => k + 1);
    setFeedback({
      type: "info",
      message: `En la partida jugaste ${puzzle.user_move.san}. Mira cómo responde ${opponentName}…`,
    });

    steps.forEach((uci, i) => {
      later(() => {
        const from = toKey(uci.slice(0, 2));
        const to = toKey(uci.slice(2, 4));
        try {
          board.move({ from, to, promotion: uci[4] || "q" });
        } catch {
          return;
        }
        setBoardFen(board.fen());
        setLastMove([from, to]);
        setArrows([{ orig: from, dest: to, brush: i === 0 ? "red" : "paleBlue" }]);
        if (i === 0) setEvalWhite(toWhite(puzzle.engine_solution.eval_after_user_move));
        if (i === steps.length - 1) {
          setFeedback({
            type: "error",
            message:
              `Tras ${moveLabel} ${puzzle.user_move.san}, ${opponentName} responde ${refutationSan[0] ?? ""}` +
              (refutationSan.length > 1 ? ` y la línea sigue ${refutationSan.slice(1).join(" ")}` : "") +
              `. La evaluación pasa de ${fmtEval(puzzle.engine_solution.eval_before)} a ${fmtEval(
                puzzle.engine_solution.eval_after_user_move
              )}. La clave era ${puzzle.engine_solution.best_move_san}.`,
          });
        }
      }, 500 + i * 900);
    });
  };

  const handleEndExplain = () => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
    const snap = snapshotRef.current;
    if (snap) {
      setBoardFen(snap.fen);
      setArrows(snap.arrows);
      setLastMove(snap.lastMove);
      setEvalWhite(snap.evalWhite);
    }
    setSyncKey((k) => k + 1);
    setExplaining(false);
    setFeedback({ type: "idle", message: "" });
  };

  // Pistas visuales: 2 = casilla de origen, 3 = flecha completa
  const shapes = useMemo<DrawShape[]>(() => {
    if (isSolved || isFailed || isOpponentMoving || hintLevel < 2) return arrows;
    const expected = activePvRef.current[pvStepIndex];
    if (!expected) return arrows;
    const from = toKey(expected.slice(0, 2));
    const hint: DrawShape =
      hintLevel >= 3 ? { orig: from, dest: toKey(expected.slice(2, 4)), brush: "yellow" } : { orig: from, brush: "yellow" };
    return [...arrows, hint];
  }, [arrows, hintLevel, isSolved, isFailed, isOpponentMoving, pvStepIndex]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "arrowright") onNext();
      else if (key === "arrowleft") onPrev?.();
      else if (key === "h" && !isSolved && hintLevel < 3) handleAskHint();
      else if (key === "r" && !explaining) handleReset();
      else if (key === "s" && !isSolved && !explaining) handleRevealSolution();
      else if (key === "e") (explaining ? handleEndExplain : handleExplain)();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const remainingPlies = isSolved || isFailed ? 0 : Math.max(0, activePvRef.current.length - played.length);
  const hints = [
    { level: 1, title: "Idea", text: puzzle.tutor_hints.level_1_conceptual, color: "border-amber-400 text-amber-100" },
    { level: 2, title: "Dirección", text: puzzle.tutor_hints.level_2_directional, color: "border-cyan-400 text-cyan-100" },
    { level: 3, title: "Concreta", text: puzzle.tutor_hints.level_3_concrete, color: "border-emerald-400 text-emerald-100" },
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
      {/* ---------- Tablero ---------- */}
      <div className="mx-auto w-full max-w-[600px] lg:col-span-7">
        <PlayerStrip
          name={opponentName}
          colorLabel={opponentColorLabel}
          isWhite={!isUserWhite}
          status={isOpponentMoving ? "Pensando…" : undefined}
          statusTone="cyan"
        />

        <div className="my-2 flex items-stretch gap-2 sm:gap-3">
          <EvalBar evalWhite={evalWhite} orientation={orientation} />
          <ChessgroundBoard
            fen={boardFen}
            orientation={orientation}
            onMove={handleMove}
            shapes={shapes}
            lastMove={lastMove}
            syncKey={syncKey}
            viewOnly={isBoardLocked}
            effect={effect}
            onEffectEnd={() => setEffect(null)}
            className="flex-1"
          >
            {antiImpulseCount > 0 && <AntiImpulseOverlay seconds={antiImpulseCount} total={ANTI_IMPULSE_SECONDS} />}
            {confettiKey && <Confetti key={confettiKey} />}
          </ChessgroundBoard>
        </div>

        <PlayerStrip
          name={username}
          colorLabel={userColorLabel}
          isWhite={isUserWhite}
          isYou
          status={
            isEvaluating
              ? "Evaluando…"
              : isSolved
              ? "Resuelto"
              : isFailed
              ? "Error repetido"
              : antiImpulseCount > 0
              ? "Calcula primero"
              : "Tu turno"
          }
          statusTone={isSolved ? "emerald" : isFailed ? "rose" : isEvaluating || antiImpulseCount > 0 ? "amber" : "brass"}
          right={<span className="num text-xs text-ivory-faint">Jugada {moveLabel}</span>}
        />
      </div>

      {/* ---------- Panel pedagógico ---------- */}
      <Card className="flex flex-col gap-5 p-5 sm:p-6 lg:col-span-5">
        {/* Cabecera */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brass">
              <theme.icon className="h-3 w-3" aria-hidden />
              {theme.label}
            </Badge>
            <Badge>{PHASE_LABEL[puzzle.classification.phase] ?? puzzle.classification.phase}</Badge>
            {puzzle.classification.psychological_tag !== "normal" && (
              <Badge tone="amber">
                <Zap className="h-3 w-3" aria-hidden />
                {PSYCH_LABEL[puzzle.classification.psychological_tag]}
              </Badge>
            )}
            {puzzle.is_mastered && (
              <Badge tone="emerald">
                <Award className="h-3 w-3" aria-hidden /> Dominado
              </Badge>
            )}
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-ivory">
            Partida contra <span className="text-brass-300">{opponentName}</span>
          </h3>
          <p className="mt-0.5 text-xs text-ivory-faint">
            <span className="num">{puzzle.metadata.eco}</span> · {puzzle.metadata.opening_name || "Apertura estándar"} ·
            Ejercicio {puzzleIndex + 1} de {totalPuzzles}
          </p>
        </div>

        {/* Lo que pasó en la partida */}
        <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-transparent p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
            <History className="h-3.5 w-3.5" aria-hidden /> En tu partida jugaste
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-3">
            <span className="num text-2xl font-semibold text-rose-300">
              {moveLabel} {puzzle.user_move.san}
              <span className="text-rose-400">??</span>
            </span>
            <span className="num rounded-md bg-rose-950/60 px-2 py-0.5 text-xs text-rose-200">
              −{Math.round(puzzle.engine_solution.cpl)} cp
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ivory-faint">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              Pensaste <strong className="num font-semibold text-ivory-muted">{puzzle.user_move.time_spent_seconds}s</strong>
            </span>
            <span className="num">
              Eval {fmtEval(puzzle.engine_solution.eval_before)} → {fmtEval(puzzle.engine_solution.eval_after_user_move)}
            </span>
            {puzzle.game_url && (
              <a
                href={puzzle.game_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-ivory-muted underline-offset-2 hover:text-brass-300 hover:underline"
              >
                Ver partida <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
        </div>

        {/* Feedback */}
        <div aria-live="polite" aria-atomic="true">
          {feedback.message ? (
            <FeedbackBanner type={feedback.type} message={feedback.message} key={feedback.message} />
          ) : (
            <p className="text-sm text-ivory-muted">
              Juegas con <strong className="text-ivory">{userColorLabel}</strong>. Encuentra la jugada que no viste en la partida.
            </p>
          )}
        </div>

        {/* Línea jugada */}
        {(played.length > 0 || remainingPlies > 0) && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ivory-faint">Tu línea</div>
            <div className="flex flex-wrap gap-1.5">
              {played.map((m, i) => (
                <span
                  key={`${m.san}-${i}`}
                  className={cn(
                    "num animate-pop rounded-lg border px-2 py-1 text-xs font-semibold",
                    m.by === "user"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                  )}
                >
                  {m.san}
                </span>
              ))}
              {Array.from({ length: remainingPlies }).map((_, i) => (
                <span
                  key={`ph-${i}`}
                  className="num rounded-lg border border-dashed border-ink-500 px-2 py-1 text-xs text-ivory-faint"
                  aria-hidden
                >
                  ···
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pistas */}
        <div className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ivory-faint">Pistas</span>
              <div className="flex gap-1" aria-label={`${hintLevel} de 3 pistas usadas`}>
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={cn("h-1.5 w-6 rounded-full transition-colors", n <= hintLevel ? "bg-amber-400" : "bg-ink-600")}
                  />
                ))}
              </div>
            </div>
            {hintLevel < 3 && !isSolved && (
              <Button variant="ghost" size="sm" onClick={handleAskHint} className="text-amber-300 hover:text-amber-200">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden />
                Pista {hintLevel + 1}
                <Kbd className="ml-1 hidden sm:inline-flex">H</Kbd>
              </Button>
            )}
          </div>

          {hintLevel === 0 ? (
            <p className="text-xs italic text-ivory-faint">
              Si te atascas, pide una pista. Cada pista reduce el progreso de repaso de esta posición.
            </p>
          ) : (
            <ol className="space-y-2">
              {hints
                .filter((h) => h.level <= hintLevel)
                .map((h) => (
                  <li key={h.level} className={cn("animate-fade-up border-l-2 py-0.5 pl-3 text-xs leading-relaxed", h.color)}>
                    <span className="font-semibold">{h.title}: </span>
                    {h.text}
                    {h.level === 2 && <span className="text-ivory-faint"> (casilla marcada en el tablero)</span>}
                  </li>
                ))}
            </ol>
          )}
        </div>

        {/* Acciones */}
        <div className="space-y-3">
          {explaining ? (
            <Button variant="secondary" className="w-full" onClick={handleEndExplain}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Volver a la posición
            </Button>
          ) : (
            canExplain && (
              <Button variant="danger" className="w-full" onClick={handleExplain}>
                <HelpCircle className="h-4 w-4" aria-hidden />
                ¿Por qué fue un error?
                <Kbd className="ml-1 hidden sm:inline-flex">E</Kbd>
              </Button>
            )
          )}

          {isSolved &&
            puzzle.engine_solution.pv_san?.length > 3 &&
            (showingEngineContinuation ? (
              <p className="num rounded-xl border border-ink-600 bg-ink-900/70 p-3 text-xs text-ivory-muted">
                {puzzle.engine_solution.pv_san.join("  ")}
              </p>
            ) : (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => setShowingEngineContinuation(true)}>
                <Play className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                Ver continuación completa del motor
              </Button>
            ))}

          {!isSolved ? (
            <div className="flex gap-3">
              <Button variant={isFailed ? "primary" : "secondary"} className="flex-1" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reiniciar
                <Kbd className="ml-1 hidden sm:inline-flex">R</Kbd>
              </Button>
              <Button variant="ghost" className="flex-1 border border-ink-600" onClick={handleRevealSolution}>
                <Eye className="h-4 w-4" aria-hidden />
                Solución
                <Kbd className="ml-1 hidden sm:inline-flex">S</Kbd>
              </Button>
            </div>
          ) : (
            <Button variant="success" size="lg" className="w-full" onClick={onNext}>
              Siguiente ejercicio
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          )}

          <p className="hidden items-center justify-center gap-1.5 text-[11px] text-ivory-faint sm:flex">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> navegar · <Kbd>H</Kbd> pista · <Kbd>R</Kbd> reiniciar · <Kbd>S</Kbd> solución · <Kbd>E</Kbd> por qué
          </p>
        </div>
      </Card>
    </div>
  );
};

/* ---------------- Subcomponentes ---------------- */

function fmtEval(pawns: number) {
  if (Math.abs(pawns) >= 90) return pawns > 0 ? "+M" : "−M";
  return `${pawns >= 0 ? "+" : "−"}${Math.abs(pawns).toFixed(1)}`;
}

const STATUS_TONE: Record<string, string> = {
  brass: "bg-brass-400/15 text-brass-300",
  emerald: "bg-emerald-500/15 text-emerald-300",
  rose: "bg-rose-500/15 text-rose-300",
  amber: "bg-amber-500/15 text-amber-300",
  cyan: "bg-cyan-500/15 text-cyan-300",
};

function PlayerStrip({
  name,
  colorLabel,
  isWhite,
  isYou,
  status,
  statusTone = "brass",
  right,
}: {
  name: string;
  colorLabel: string;
  isWhite: boolean;
  isYou?: boolean;
  status?: string;
  statusTone?: keyof typeof STATUS_TONE;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 pl-6 sm:pl-8">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border",
            isWhite ? "border-ivory-muted bg-[#f6f1e7]" : "border-ink-500 bg-ink-950"
          )}
          aria-hidden
        />
        <span className="truncate text-sm font-semibold text-ivory">{name}</span>
        <span className="text-xs text-ivory-faint">
          {isYou ? "Tú · " : ""}
          {colorLabel}
        </span>
        {status && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              STATUS_TONE[statusTone],
              status.endsWith("…") && "animate-pulse"
            )}
          >
            {status}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

function FeedbackBanner({ type, message }: { type: FeedbackType; message: string }) {
  const styles: Record<FeedbackType, string> = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-100",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    info: "border-ink-500 bg-ink-750 text-ivory-muted",
    idle: "",
  };
  const Icon =
    type === "success" ? CheckCircle2 : type === "error" ? AlertTriangle : type === "info" ? Loader2 : Lightbulb;
  const iconColor =
    type === "success" ? "text-emerald-400" : type === "error" ? "text-rose-400" : type === "info" ? "text-ivory-faint" : "text-amber-400";
  return (
    <div className={cn("flex animate-pop items-start gap-2.5 rounded-xl border p-3.5 text-sm leading-relaxed", styles[type])}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor, type === "info" && "animate-spin")} aria-hidden />
      <div>{message}</div>
    </div>
  );
}

function AntiImpulseOverlay({ seconds, total }: { seconds: number; total: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - seconds / total);
  return (
    <div className="absolute inset-0 z-10 flex animate-pop flex-col items-center justify-center bg-ink-950/60 backdrop-blur-[2px]">
      <div className="relative h-28 w-28 sm:h-32 sm:w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(243,237,226,0.15)" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span className="num absolute inset-0 flex items-center justify-center text-4xl font-bold text-amber-200">
          {seconds}
        </span>
      </div>
      <div className="mt-3 px-6 text-center">
        <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-200">
          <Zap className="h-4 w-4" aria-hidden /> Modo anti-impulso
        </div>
        <p className="mt-1 text-xs text-ivory-muted">En la partida moviste rápido. Mira la posición: ¿qué amenaza tu rival?</p>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#DDB463", "#34D399", "#F3EDE2", "#67E8F9", "#EBCB8B"];

function Confetti() {
  const pieces = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.3;
    const dist = 120 + ((i * 37) % 90);
    return {
      dx: `${Math.cos(angle) * dist}px`,
      dy: `${Math.sin(angle) * dist - 40}px`,
      rot: `${(i * 67) % 360}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${(i % 5) * 25}ms`,
      w: 6 + (i % 3) * 2,
    };
  });
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute animate-confetti rounded-[2px]"
          style={
            {
              width: p.w,
              height: p.w * 0.45,
              background: p.color,
              animationDelay: p.delay,
              "--dx": p.dx,
              "--dy": p.dy,
              "--rot": p.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
