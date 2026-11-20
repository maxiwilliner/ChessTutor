"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Key } from "chessground/types";
import { DrawShape } from "chessground/draw";
import { Chess } from "chess.js";
import { BlunderBankItem, EvaluateMoveResponse } from "@/types/api";
import { store } from "@/lib/store";
import { cn } from "@/lib/cn";
import { themeMeta } from "@/lib/labels";
import { useI18n } from "@/lib/i18n";
import { generateHintsForBlunder } from "@/analysis/hints";
import { alternating, buildLine, type LineFrame, type LineStep } from "@/lib/lineViewer";
import { playMoveSound, sound } from "@/lib/sound";
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
  Award,
  ExternalLink,
  Loader2,
  History,
  HelpCircle,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  X,
  Dumbbell,
  ShieldQuestion,
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

/** Variante reproducida en el tablero ("Ver solución", "línea del motor" o "¿Por qué fue un error?"). */
interface LineView {
  kind: "solution" | "refutation";
  frames: LineFrame[];
  index: number;
  playing: boolean;
}

/** Jugada soltada en un ejercicio impulsivo, pendiente de confirmar. */
interface PendingMove {
  orig: Key;
  dest: Key;
  san: string;
}

const OPPONENT_DELAY_MS = 650;
const LINE_STEP_MS = 900;

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
  const { m, lang } = useI18n();
  const t = m.trainer.replay;
  const isUserWhite = puzzle.metadata.user_color === "white";
  const orientation: "white" | "black" = puzzle.metadata.user_color || puzzle.turn || "white";
  const opponentName = (isUserWhite ? puzzle.metadata.black : puzzle.metadata.white) || t.opponent;
  const userColorLabel = isUserWhite ? t.white : t.black;
  const opponentColorLabel = isUserWhite ? t.black : t.white;
  const isImpulsive = puzzle.classification.psychological_tag === "impulsive";
  const theme = themeMeta(puzzle.classification.theme, m);
  const toWhite = useCallback((playerPawns: number) => (isUserWhite ? playerPawns : -playerPawns), [isUserWhite]);
  const moveLabel = `${puzzle.move_number}${puzzle.turn === "black" ? "..." : "."}`;
  const solutionUci = puzzle.engine_solution.pv_uci?.length ? puzzle.engine_solution.pv_uci : [puzzle.engine_solution.best_move_uci];

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
  const [isOpponentMoving, setIsOpponentMoving] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  /** Se vio la solución: el intento ya cuenta como no resuelto. */
  const [revealed, setRevealed] = useState(false);
  /** Tras ver la solución, el usuario la practica (no se registra otro intento). */
  const [practicing, setPracticing] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState<{ type: FeedbackType; message: string }>({ type: "idle", message: "" });
  const [line, setLine] = useState<LineView | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);

  const timerStartRef = useRef(0);
  const attemptsCountRef = useRef(0);
  const mistakesRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timeoutsRef.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timeoutsRef.current.forEach((t) => window.clearTimeout(t));
    timeoutsRef.current = [];
  };

  // Reinicio al cambiar de ejercicio
  useEffect(() => {
    clearTimers();
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
    setRevealed(false);
    setPracticing(false);
    setIsOpponentMoving(false);
    setIsEvaluating(false);
    setFeedback({ type: "idle", message: "" });
    setPvStepIndex(0);
    setPlayed([]);
    setLine(null);
    setPending(null);
    attemptsCountRef.current = 0;
    mistakesRef.current = 0;
    activePvRef.current = solutionUci.slice(0, 5);
    timerStartRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  // Limpiar temporizadores pendientes al desmontar
  useEffect(() => () => clearTimers(), []);

  const isBoardLocked =
    !!line || !!pending || isOpponentMoving || isEvaluating || isSolved || isFailed || (revealed && !practicing);
  const refutationUci = puzzle.engine_solution.refutation_uci ?? [];
  const refutationSan = puzzle.engine_solution.refutation_san ?? [];
  const canExplain = (isSolved || isFailed || revealed) && refutationUci.length > 0 && !isOpponentMoving && !line;
  const elapsedSeconds = () => Math.max(1, (Date.now() - timerStartRef.current) / 1000);

  const finishPuzzleSuccess = (lastUci: string, isFirstTry: boolean, message: string) => {
    setIsOpponentMoving(false);
    setIsSolved(true);
    setEffect("glow");
    setEvalWhite(toWhite(puzzle.engine_solution.eval_before));
    sound.success();

    if (practicing) {
      // Ya se registró el intento al ver la solución: practicar no cambia el repaso.
      setFeedback({ type: "success", message: t.practiceDone });
      return;
    }
    setFeedback({ type: "success", message });
    if (isFirstTry) setConfettiKey(Date.now());

    store
      .submitAttempt({
        username,
        puzzle_id: puzzle.id,
        played_uci: lastUci,
        is_solved: true,
        repeated_old_blunder: false,
        hints_used: hintLevel,
        mistakes: mistakesRef.current,
        time_spent_seconds: elapsedSeconds(),
      })
      .catch(console.error);

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
      playMoveSound(mv.san);
      return mv.san;
    } catch {
      return null;
    }
  };

  /** Jugada soltada en el tablero. En la jugada clave de un ejercicio impulsivo, primero se pide confirmar. */
  const handleMove = (orig: Key, dest: Key) => {
    if (isBoardLocked) return;
    if (isImpulsive && pvStepIndex === 0 && !practicing) {
      const probe = new Chess(chessRef.current.fen());
      try {
        const mv = probe.move({ from: orig, to: dest, promotion: "q" });
        setPending({ orig, dest, san: mv.san });
        setBoardFen(probe.fen());
        setLastMove([orig, dest]);
        playMoveSound(mv.san);
      } catch {
        setSyncKey((k) => k + 1);
      }
      return;
    }
    void processMove(orig, dest);
  };

  const confirmPending = () => {
    if (!pending) return;
    const { orig, dest } = pending;
    setPending(null);
    void processMove(orig, dest, true);
  };

  const cancelPending = () => {
    if (!pending) return;
    setPending(null);
    setBoardFen(chessRef.current.fen());
    setLastMove(null);
    setSyncKey((k) => k + 1);
  };

  const processMove = async (orig: Key, dest: Key, alreadySounded = false) => {
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
      if (!alreadySounded) playMoveSound(moveObj.san);

      const hasOpponentReply = pvStepIndex + 1 < activePvRef.current.length;
      if (!hasOpponentReply) {
        finishPuzzleSuccess(playedUci, isFirstTry, t.brilliantFound(puzzle.engine_solution.best_move_san));
        return;
      }

      setIsOpponentMoving(true);
      setFeedback({ type: "success", message: t.exactReplies(opponentName) });
      later(() => {
        const san = playOpponent(activePvRef.current[pvStepIndex + 1].toLowerCase());
        if (san) setPlayed((p) => [...p, { san, by: "opp" }]);

        if (pvStepIndex + 2 < activePvRef.current.length) {
          setPvStepIndex(pvStepIndex + 2);
          setIsOpponentMoving(false);
          setFeedback({ type: "success", message: t.nextMove });
        } else {
          finishPuzzleSuccess(playedUci, isFirstTry, t.comboDone);
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
      sound.error();
      setEvalWhite(toWhite(puzzle.engine_solution.eval_after_user_move));
      setIsFailed(true);
      setFeedback({ type: "error", message: t.sameBlunder(puzzle.user_move.san, Math.round(puzzle.engine_solution.cpl)) });

      if (!practicing) {
        store
          .submitAttempt({
            username,
            puzzle_id: puzzle.id,
            played_uci: playedUci,
            is_solved: false,
            repeated_old_blunder: true,
            hints_used: hintLevel,
            time_spent_seconds: elapsedSeconds(),
          })
          .catch(console.error);
        onAttemptFinished?.({ isSolved: false, firstTry: false, repeatedOldBlunder: true });
      }
      return;
    }

    // 3. Jugada alternativa: la evalúa el motor
    const userSan = moveObj.san;
    chess.undo();
    setSyncKey((k) => k + 1);
    setIsEvaluating(true);
    setFeedback({ type: "info", message: t.analyzing(userSan) });

    try {
      const evalRes: EvaluateMoveResponse = await store.evaluateMove(puzzle, playedUci, chess.fen());
      setIsEvaluating(false);
      // El texto se compone con los campos del resultado (el `message` viene en español del backend o de trainerLogic)
      const evalMessage = evalRes.is_best
        ? t.evalBest
        : evalRes.is_valid
        ? t.evalGood
        : evalRes.is_historical_blunder
        ? t.sameBlunder(puzzle.user_move.san, Math.round(puzzle.engine_solution.cpl))
        : t.evalLoses(Math.trunc(evalRes.cpl_diff));

      if (evalRes.is_valid) {
        chess.move({ from: orig, to: dest, promotion: "q" });
        setBoardFen(chess.fen());
        setLastMove([orig, dest]);
        setArrows([{ orig, dest, brush: "green" }]);
        setPlayed((p) => [...p, { san: userSan, by: "user" }]);
        if (!alreadySounded) playMoveSound(userSan);

        if (evalRes.opponent_reply_uci) {
          setIsOpponentMoving(true);
          const reply = evalRes.opponent_reply_uci.toLowerCase();
          later(() => {
            const san = playOpponent(reply);
            if (san) setPlayed((p) => [...p, { san, by: "opp" }]);
            finishPuzzleSuccess(playedUci, isFirstTry, evalMessage);
          }, OPPONENT_DELAY_MS);
        } else {
          finishPuzzleSuccess(playedUci, isFirstTry, evalMessage);
        }
      } else {
        mistakesRef.current += 1;
        setArrows([{ orig, dest, brush: "red" }]);
        setEffect("shake");
        sound.error();
        const before = puzzle.engine_solution.eval_before;
        setEvalWhite(toWhite(before - evalRes.cpl_diff / 100));
        setFeedback({ type: "warning", message: evalMessage });
        later(() => {
          setArrows([]);
          setEvalWhite(toWhite(before));
        }, 1400);
      }
    } catch {
      mistakesRef.current += 1;
      setIsEvaluating(false);
      setEffect("shake");
      sound.error();
      setFeedback({ type: "warning", message: t.evalFailed });
      later(() => setArrows([]), 1000);
    }
  };

  /** Vuelve a la posición inicial. Tras ver la solución, entra en modo práctica. */
  const handleReset = () => {
    clearTimers();
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
    setLine(null);
    setPending(null);
    setEvalWhite(toWhite(puzzle.engine_solution.eval_before));
    if (revealed) {
      setPracticing(true);
      setFeedback({ type: "info", message: t.practiceStart });
    } else {
      setFeedback({ type: "idle", message: "" });
    }
    timerStartRef.current = Date.now();
  };

  /* ---------------- Visor de líneas ---------------- */

  const openLine = (kind: LineView["kind"], steps: LineStep[]) => {
    clearTimers();
    setPending(null);
    setLine({ kind, frames: buildLine(puzzle.fen_before, steps), index: 0, playing: true });
  };

  const solutionSteps = () => alternating(solutionUci.slice(0, 5), "user");
  const refutationSteps = (): LineStep[] => [
    { uci: puzzle.user_move.uci, by: "user", isBlunder: true },
    ...alternating(refutationUci, "opp"),
  ];

  const stepLine = (delta: number | "start" | "end") =>
    setLine((l) => {
      if (!l) return l;
      const last = l.frames.length - 1;
      const index = delta === "start" ? 0 : delta === "end" ? last : Math.max(0, Math.min(last, l.index + delta));
      return { ...l, index, playing: false };
    });

  const togglePlay = () =>
    setLine((l) => (l ? { ...l, playing: !l.playing, index: !l.playing && l.index === l.frames.length - 1 ? 0 : l.index } : l));

  const closeLine = () => {
    setLine(null);
    setSyncKey((k) => k + 1);
  };

  // Reproducción automática
  useEffect(() => {
    if (!line?.playing) return;
    if (line.index >= line.frames.length - 1) {
      setLine((l) => (l ? { ...l, playing: false } : l));
      return;
    }
    const t = window.setTimeout(() => setLine((l) => (l ? { ...l, index: l.index + 1 } : l)), line.index === 0 ? 400 : LINE_STEP_MS);
    return () => window.clearTimeout(t);
  }, [line?.playing, line?.index, line?.frames.length]);

  // Sonido en cada paso de la línea
  const lineFrame = line ? line.frames[line.index] : null;
  useEffect(() => {
    if (lineFrame?.san) playMoveSound(lineFrame.san);
  }, [lineFrame]);

  const handleRevealSolution = () => {
    if (revealed || isSolved) return;
    setRevealed(true);
    setHintLevel(3);
    setIsFailed(false);
    setEvalWhite(toWhite(puzzle.engine_solution.eval_before));
    openLine("solution", solutionSteps());

    store
      .submitAttempt({
        username,
        puzzle_id: puzzle.id,
        played_uci: puzzle.engine_solution.best_move_uci.toLowerCase(),
        // Ver la solución no es resolver: el ejercicio vuelve a la cola de repaso.
        is_solved: false,
        repeated_old_blunder: false,
        hints_used: 3,
        time_spent_seconds: elapsedSeconds(),
      })
      .catch(console.error);

    onAttemptFinished?.({ isSolved: false, firstTry: false, repeatedOldBlunder: false });
  };

  const handleExplain = () => {
    if (canExplain) openLine("refutation", refutationSteps());
  };

  const handleAskHint = () => setHintLevel((prev) => Math.min(3, prev + 1));

  // Lo que muestra el tablero: la línea abierta o la partida
  const view = useMemo(() => {
    if (!line || !lineFrame) return null;
    const uci = lineFrame.uci;
    const brush = lineFrame.isBlunder ? "red" : lineFrame.by === "user" ? "green" : "paleBlue";
    const shapes: DrawShape[] = uci ? [{ orig: toKey(uci.slice(0, 2)), dest: toKey(uci.slice(2, 4)), brush }] : [];
    const lm: [Key, Key] | null = uci ? [toKey(uci.slice(0, 2)), toKey(uci.slice(2, 4))] : null;
    const afterBlunder = line.kind === "refutation" && line.index >= 1;
    const evalPlayer = afterBlunder ? puzzle.engine_solution.eval_after_user_move : puzzle.engine_solution.eval_before;
    return { fen: lineFrame.fen, shapes, lastMove: lm, evalWhite: toWhite(evalPlayer) };
  }, [line, lineFrame, puzzle, toWhite]);

  // Pistas visuales: 2 = casilla de origen, 3 = flecha completa
  const shapes = useMemo<DrawShape[]>(() => {
    if (isSolved || isFailed || isOpponentMoving || pending || hintLevel < 2) return arrows;
    const expected = activePvRef.current[pvStepIndex];
    if (!expected) return arrows;
    const from = toKey(expected.slice(0, 2));
    const hint: DrawShape =
      hintLevel >= 3 ? { orig: from, dest: toKey(expected.slice(2, 4)), brush: "yellow" } : { orig: from, brush: "yellow" };
    return [...arrows, hint];
  }, [arrows, hintLevel, isSolved, isFailed, isOpponentMoving, pvStepIndex, pending]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (pending) {
        if (key === "enter") confirmPending();
        else if (key === "escape") cancelPending();
        else return;
      } else if (line) {
        if (key === "arrowright") stepLine(1);
        else if (key === "arrowleft") stepLine(-1);
        else if (key === " ") togglePlay();
        else if (key === "escape") closeLine();
        else return;
      } else if (key === "arrowright") onNext();
      else if (key === "arrowleft") onPrev?.();
      else if (key === "h" && !isSolved && !revealed && hintLevel < 3) handleAskHint();
      else if (key === "r") handleReset();
      else if (key === "s" && !isSolved && !revealed) handleRevealSolution();
      else if (key === "e" && canExplain) handleExplain();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const remainingPlies = isSolved || isFailed || revealed ? 0 : Math.max(0, activePvRef.current.length - played.length);
  // Pistas en el idioma de la interfaz (en español coinciden con las guardadas en el ejercicio)
  const tutorHints = generateHintsForBlunder(
    puzzle.classification.theme,
    puzzle.engine_solution.best_move_san,
    puzzle.engine_solution.best_move_uci,
    lang
  );
  const hints = [
    { level: 1, title: t.hintLevels[0], text: tutorHints.level_1_conceptual, color: "border-amber-400 text-amber-100" },
    { level: 2, title: t.hintLevels[1], text: tutorHints.level_2_directional, color: "border-cyan-400 text-cyan-100" },
    { level: 3, title: t.hintLevels[2], text: tutorHints.level_3_concrete, color: "border-emerald-400 text-emerald-100" },
  ];

  // Mensaje mientras hay una línea abierta
  const lineMessage = (() => {
    if (!line) return null;
    const sans = line.frames.slice(1).map((f) => f.san).join(" ");
    if (line.kind === "solution") {
      return { type: "warning" as const, message: t.lineSolution(puzzle.engine_solution.best_move_san, sans) };
    }
    if (line.index < line.frames.length - 1) {
      return { type: "info" as const, message: t.lineWatching(puzzle.user_move.san, opponentName) };
    }
    return {
      type: "error" as const,
      message: t.lineRefutation({
        move: moveLabel,
        san: puzzle.user_move.san,
        opp: opponentName,
        reply: refutationSan[0] ?? "",
        rest: refutationSan.slice(1).join(" "),
        from: fmtEval(puzzle.engine_solution.eval_before),
        to: fmtEval(puzzle.engine_solution.eval_after_user_move),
        best: puzzle.engine_solution.best_move_san,
      }),
    };
  })();
  const shownFeedback = lineMessage ?? feedback;

  const userStatus = pending
    ? t.status.confirm
    : line
    ? line.kind === "solution"
      ? t.status.watchingSolution
      : t.status.watchingMistake
    : isEvaluating
    ? t.status.evaluating
    : isSolved
    ? t.status.solved
    : isFailed
    ? t.status.repeated
    : practicing
    ? t.status.practicing
    : t.status.yourTurn;
  const userTone = isSolved ? "emerald" : isFailed ? "rose" : isEvaluating || pending ? "amber" : line ? "cyan" : "brass";

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
      {/* ---------- Tablero ---------- */}
      <div className="mx-auto w-full max-w-[600px] lg:col-span-7">
        <PlayerStrip
          name={opponentName}
          colorLabel={opponentColorLabel}
          isWhite={!isUserWhite}
          status={isOpponentMoving ? t.status.thinking : undefined}
          statusTone="cyan"
        />

        <div className="my-2 flex items-stretch gap-2 sm:gap-3">
          <EvalBar evalWhite={view?.evalWhite ?? evalWhite} orientation={orientation} />
          <ChessgroundBoard
            fen={view?.fen ?? boardFen}
            orientation={orientation}
            onMove={handleMove}
            shapes={view?.shapes ?? shapes}
            lastMove={view ? view.lastMove : lastMove}
            syncKey={syncKey}
            viewOnly={isBoardLocked}
            effect={effect}
            onEffectEnd={() => setEffect(null)}
            className="flex-1"
          >
            {pending && <ConfirmMoveCard san={pending.san} onConfirm={confirmPending} onCancel={cancelPending} />}
            {confettiKey && <Confetti key={confettiKey} />}
          </ChessgroundBoard>
        </div>

        {line ? (
          <LineControls
            line={line}
            onStep={stepLine}
            onTogglePlay={togglePlay}
            onClose={closeLine}
          />
        ) : (
          <PlayerStrip
            name={username}
            colorLabel={userColorLabel}
            isWhite={isUserWhite}
            status={userStatus}
            statusTone={userTone}
            youLabel={t.you}
            right={<span className="num hidden text-xs text-ivory-faint sm:inline">{t.move(moveLabel)}</span>}
          />
        )}
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
            <Badge>{m.labels.phase[puzzle.classification.phase] ?? puzzle.classification.phase}</Badge>
            {puzzle.classification.psychological_tag !== "normal" && (
              <Badge tone="amber">
                <Zap className="h-3 w-3" aria-hidden />
                {m.labels.psych[puzzle.classification.psychological_tag]}
              </Badge>
            )}
            {puzzle.is_mastered && (
              <Badge tone="emerald">
                <Award className="h-3 w-3" aria-hidden /> {t.mastered}
              </Badge>
            )}
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-ivory">
            {t.gameAgainst(<span className="text-brass-300">{opponentName}</span>)}
          </h3>
          <p className="mt-0.5 text-xs text-ivory-faint">
            <span className="num">{puzzle.metadata.eco}</span> · {puzzle.metadata.opening_name || t.standardOpening} ·{" "}
            {t.exerciseOf(puzzleIndex + 1, totalPuzzles)}
          </p>
        </div>

        {/* Lo que pasó en la partida */}
        <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-transparent p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
            <History className="h-3.5 w-3.5" aria-hidden /> {t.youPlayed}
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
              {t.thought(<strong className="num font-semibold text-ivory-muted">{puzzle.user_move.time_spent_seconds}s</strong>)}
            </span>
            <span className="num">
              {t.eval} {fmtEval(puzzle.engine_solution.eval_before)} → {fmtEval(puzzle.engine_solution.eval_after_user_move)}
            </span>
            {puzzle.game_url && (
              <a
                href={puzzle.game_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-ivory-muted underline-offset-2 hover:text-brass-300 hover:underline"
              >
                {t.viewGame} <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
          {isImpulsive && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-200/90">
              <Zap className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {t.impulsiveNote}
            </p>
          )}
        </div>

        {/* Feedback */}
        <div aria-live="polite" aria-atomic="true">
          {shownFeedback.message ? (
            <FeedbackBanner type={shownFeedback.type} message={shownFeedback.message} key={shownFeedback.message} />
          ) : (
            <p className="text-sm text-ivory-muted">{t.prompt(<strong className="text-ivory">{userColorLabel}</strong>)}</p>
          )}
        </div>

        {/* Línea jugada */}
        {!line && (played.length > 0 || remainingPlies > 0) && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ivory-faint">{t.yourLine}</div>
            <div className="flex flex-wrap gap-1.5">
              {played.map((pm, i) => (
                <span
                  key={`${pm.san}-${i}`}
                  className={cn(
                    "num animate-pop rounded-lg border px-2 py-1 text-xs font-semibold",
                    pm.by === "user"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                  )}
                >
                  {pm.san}
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
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ivory-faint">{t.hints}</span>
              <div className="flex gap-1" aria-label={t.hintsUsed(hintLevel)}>
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={cn("h-1.5 w-6 rounded-full transition-colors", n <= hintLevel ? "bg-amber-400" : "bg-ink-600")}
                  />
                ))}
              </div>
            </div>
            {hintLevel < 3 && !isSolved && !revealed && (
              <Button variant="ghost" size="sm" onClick={handleAskHint} className="text-amber-300 hover:text-amber-200">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden />
                {t.hint(hintLevel + 1)}
                <Kbd className="ml-1 hidden sm:inline-flex">H</Kbd>
              </Button>
            )}
          </div>

          {hintLevel === 0 ? (
            <p className="text-xs italic text-ivory-faint">{t.hintsEmpty}</p>
          ) : (
            <ol className="space-y-2">
              {hints
                .filter((h) => h.level <= hintLevel)
                .map((h) => (
                  <li key={h.level} className={cn("animate-fade-up border-l-2 py-0.5 pl-3 text-xs leading-relaxed", h.color)}>
                    <span className="font-semibold">{h.title}: </span>
                    {h.text}
                    {h.level === 2 && <span className="text-ivory-faint"> {t.markedSquare}</span>}
                  </li>
                ))}
            </ol>
          )}
        </div>

        {/* Acciones */}
        <div className="space-y-3">
          {!line && (canExplain || isSolved) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {canExplain && (
                <Button variant="danger" onClick={handleExplain}>
                  <HelpCircle className="h-4 w-4" aria-hidden />
                  {t.why}
                  <Kbd className="ml-1 hidden sm:inline-flex">E</Kbd>
                </Button>
              )}
              {(isSolved || revealed) && (
                <Button variant="secondary" onClick={() => openLine("solution", solutionSteps())}>
                  <Play className="h-4 w-4 text-cyan-300" aria-hidden />
                  {t.engineLine}
                </Button>
              )}
            </div>
          )}

          {revealed && !practicing && !line && (
            <Button variant="primary" className="w-full" onClick={handleReset}>
              <Dumbbell className="h-4 w-4" aria-hidden />
              {t.practice}
              <Kbd className="ml-1 hidden sm:inline-flex">R</Kbd>
            </Button>
          )}

          {isSolved || revealed ? (
            <Button variant="success" size="lg" className="w-full" onClick={onNext}>
              {t.next}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant={isFailed ? "primary" : "secondary"} className="flex-1" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                {t.reset}
                <Kbd className="ml-1 hidden sm:inline-flex">R</Kbd>
              </Button>
              <Button variant="ghost" className="flex-1 border border-ink-600" onClick={handleRevealSolution}>
                <Eye className="h-4 w-4" aria-hidden />
                {t.solution}
                <Kbd className="ml-1 hidden sm:inline-flex">S</Kbd>
              </Button>
            </div>
          )}

          <p className="hidden items-center justify-center gap-1.5 text-[11px] text-ivory-faint sm:flex">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> {t.shortcuts.navigate} · <Kbd>H</Kbd> {t.shortcuts.hint} · <Kbd>R</Kbd> {t.shortcuts.reset} · <Kbd>S</Kbd>{" "}
            {t.shortcuts.solution} · <Kbd>E</Kbd> {t.shortcuts.why}
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
  youLabel,
  status,
  statusTone = "brass",
  right,
}: {
  name: string;
  colorLabel: string;
  isWhite: boolean;
  /** Solo en la franja del usuario ("Tú" / "You"). */
  youLabel?: string;
  status?: string;
  statusTone?: keyof typeof STATUS_TONE;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 pl-6 sm:pl-8">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full border",
            isWhite ? "border-ivory-muted bg-[#f6f1e7]" : "border-ink-500 bg-ink-950"
          )}
          aria-hidden
        />
        <span className="max-w-[9rem] truncate text-sm font-semibold text-ivory sm:max-w-none">{name}</span>
        <span className="hidden text-xs text-ivory-faint sm:inline">
          {youLabel ? `${youLabel} · ` : ""}
          {colorLabel}
        </span>
        {status && (
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
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

function LineControls({
  line,
  onStep,
  onTogglePlay,
  onClose,
}: {
  line: LineView;
  onStep: (d: number | "start" | "end") => void;
  onTogglePlay: () => void;
  onClose: () => void;
}) {
  const { m } = useI18n();
  const t = m.trainer.replay;
  const last = line.frames.length - 1;
  const frame = line.frames[line.index];
  const btn = "h-9 w-9 px-0";
  return (
    <div className="flex items-center justify-between gap-2 pl-6 sm:pl-8" role="group" aria-label={t.lineAria}>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" className={btn} onClick={() => onStep("start")} disabled={line.index === 0} aria-label={t.toStart}>
          <SkipBack className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="secondary" size="sm" className={btn} onClick={() => onStep(-1)} disabled={line.index === 0} aria-label={t.prevMove}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="primary" size="sm" className={btn} onClick={onTogglePlay} aria-label={line.playing ? t.pause : t.play}>
          {line.playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        </Button>
        <Button variant="secondary" size="sm" className={btn} onClick={() => onStep(1)} disabled={line.index === last} aria-label={t.nextMove2}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button variant="secondary" size="sm" className={btn} onClick={() => onStep("end")} disabled={line.index === last} aria-label={t.toEnd}>
          <SkipForward className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <span className="num min-w-0 truncate text-xs text-ivory-muted">
        {line.index}/{last}
        {frame.san && <strong className="ml-2 text-ivory">{frame.san}</strong>}
      </span>
      <Button variant="ghost" size="sm" onClick={onClose} aria-label={t.closeLine}>
        <X className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{t.close}</span>
      </Button>
    </div>
  );
}

function ConfirmMoveCard({ san, onConfirm, onCancel }: { san: string; onConfirm: () => void; onCancel: () => void }) {
  const { m } = useI18n();
  const t = m.trainer.replay;
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 animate-pop rounded-xl border border-amber-500/40 bg-ink-900/95 p-3 shadow-card backdrop-blur sm:inset-x-6 sm:bottom-6 sm:p-4">
      <div className="flex items-start gap-2 text-sm text-amber-100">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <span>{t.confirmPrompt((text) => <strong className="font-semibold">{text}</strong>)}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" size="sm" className="flex-1" onClick={onConfirm} autoFocus>
          {t.confirm} <span className="num">{san}</span>
          <Kbd className="ml-1 hidden sm:inline-flex">↵</Kbd>
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={onCancel}>
          {t.change}
          <Kbd className="ml-1 hidden sm:inline-flex">Esc</Kbd>
        </Button>
      </div>
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
