"use client";

import React, { useState, useEffect, useRef } from "react";
import { BlunderBankItem, EvaluateMoveResponse } from "@/types/api";
import { ChessgroundBoard } from "./ChessgroundBoard";
import { Key } from "chessground/types";
import { Chess } from "chess.js";
import { evaluateMove, submitPuzzleAttempt } from "@/lib/api";
import {
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Eye,
  ShieldAlert,
  Clock,
  Zap,
  Play,
  Award,
} from "lucide-react";

interface BlunderReplayProps {
  puzzle: BlunderBankItem;
  puzzleIndex: number;
  totalPuzzles: number;
  username: string;
  onNext: () => void;
  onAttemptFinished?: (result: {
    isSolved: boolean;
    firstTry: boolean;
    repeatedOldBlunder: boolean;
  }) => void;
}

export const BlunderReplay: React.FC<BlunderReplayProps> = ({
  puzzle,
  puzzleIndex,
  totalPuzzles,
  username,
  onNext,
  onAttemptFinished,
}) => {
  // Board & Move State
  const [boardFen, setBoardFen] = useState(puzzle.fen_before);
  const chessRef = useRef<Chess>(new Chess(puzzle.fen_before));
  const [arrows, setArrows] = useState<any[]>([]);

  // Sequence tracking
  // Trim pv_uci to maximum 5 plies (half-moves) for interactive practice
  const activePvRef = useRef<string[]>([]);
  const [pvStepIndex, setPvStepIndex] = useState<number>(0);

  // Status & Lock Flags
  const isImpulsive = puzzle.classification.psychological_tag === "impulsive";
  const [antiImpulseCount, setAntiImpulseCount] = useState<number>(isImpulsive ? 5 : 0);
  const [isOpponentMoving, setIsOpponentMoving] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [isFailed, setIsFailed] = useState<boolean>(false);
  const [showingEngineContinuation, setShowingEngineContinuation] = useState<boolean>(false);

  // Time & Attempts
  const timerStartRef = useRef<number>(0);
  const attemptsCountRef = useRef<number>(0);
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning" | "idle";
    message: string;
  }>({ type: "idle", message: "" });

  // Initialize & reset when puzzle changes
  useEffect(() => {
    chessRef.current = new Chess(puzzle.fen_before);
    setBoardFen(puzzle.fen_before);
    setArrows([]);
    setHintLevel(0);
    setIsSolved(false);
    setIsFailed(false);
    setIsOpponentMoving(false);
    setIsEvaluating(false);
    setShowingEngineContinuation(false);
    setFeedback({ type: "idle", message: "" });
    setPvStepIndex(0);
    attemptsCountRef.current = 0;

    // Prepare active sequence: up to 5 plies
    const pvMoves = puzzle.engine_solution.pv_uci && puzzle.engine_solution.pv_uci.length > 0
      ? puzzle.engine_solution.pv_uci
      : [puzzle.engine_solution.best_move_uci];
    activePvRef.current = pvMoves.slice(0, 5);

    // Anti-Impulse Countdown timer
    if (isImpulsive) {
      setAntiImpulseCount(5);
      const interval = setInterval(() => {
        setAntiImpulseCount((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            timerStartRef.current = Date.now();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setAntiImpulseCount(0);
      timerStartRef.current = Date.now();
    }
  }, [puzzle]);

  // Strict interaction lock
  const isBoardLocked =
    antiImpulseCount > 0 || isOpponentMoving || isEvaluating || isSolved || isFailed;

  // User vs Opponent identification
  const isUserWhite = puzzle.metadata.user_color === "white";
  const opponentName = isUserWhite ? puzzle.metadata.black : puzzle.metadata.white;
  const userColorLabel = isUserWhite ? "Blancas" : "Negras";
  const opponentColorLabel = isUserWhite ? "Negras" : "Blancas";
  const orientation = puzzle.metadata.user_color || puzzle.turn || "white";

  // Move handler
  const handleMove = async (orig: Key, dest: Key) => {
    if (isBoardLocked) return;

    attemptsCountRef.current += 1;
    const isFirstTry = attemptsCountRef.current === 1 && hintLevel === 0;
    const playedUci = `${orig}${dest}`.toLowerCase();
    const chess = chessRef.current;

    // Validate legal move via chess.js
    let moveObj = null;
    try {
      moveObj = chess.move({ from: orig, to: dest, promotion: "q" });
    } catch (e) {
      // Illegal move
      return;
    }

    if (!moveObj) return;

    // Check against current expected move in activePv
    const expectedPvUci = activePvRef.current[pvStepIndex]?.toLowerCase();

    // 1. Exact match on Main Line (PV)
    if (expectedPvUci && (playedUci === expectedPvUci || playedUci.startsWith(expectedPvUci.slice(0, 4)))) {
      setBoardFen(chess.fen());
      setArrows([
        {
          orig: orig,
          dest: dest,
          brush: "green",
        },
      ]);

      const hasOpponentReply = pvStepIndex + 1 < activePvRef.current.length;

      if (hasOpponentReply) {
        // Execute opponent reply after 600ms
        setIsOpponentMoving(true);
        setFeedback({
          type: "success",
          message: `¡Exacto! ${opponentName} responde a tu amenaza...`,
        });

        setTimeout(() => {
          const oppUci = activePvRef.current[pvStepIndex + 1].toLowerCase();
          const oppOrig = oppUci.slice(0, 2) as Key;
          const oppDest = oppUci.slice(2, 4) as Key;

          try {
            chess.move({ from: oppOrig, to: oppDest, promotion: "q" });
            setBoardFen(chess.fen());
            setArrows([
              {
                orig: oppOrig,
                dest: oppDest,
                brush: "blue",
              },
            ]);
          } catch (e) {
            // In case of move parse failure
          }

          const hasNextUserMove = pvStepIndex + 2 < activePvRef.current.length;

          if (hasNextUserMove) {
            setPvStepIndex(pvStepIndex + 2);
            setIsOpponentMoving(false);
            setFeedback({
              type: "success",
              message: "¡Excelente! Encuentra la siguiente jugada para rematar la ventaja.",
            });
          } else {
            // Sequence completed!
            finishPuzzleSuccess(playedUci, isFirstTry, "¡Brillante! Has completado toda la combinación táctica y recuperado la ventaja.");
          }
        }, 600);
      } else {
        // Single move puzzle solved
        finishPuzzleSuccess(playedUci, isFirstTry, `¡Brillante! Encontraste ${puzzle.engine_solution.best_move_san}.`);
      }
      return;
    }

    // 2. Check if repeated historical blunder (on first user turn)
    const targetUserBlunderUci = puzzle.user_move.uci.toLowerCase();
    if (pvStepIndex === 0 && (playedUci === targetUserBlunderUci || playedUci.startsWith(targetUserBlunderUci.slice(0, 4)))) {
      // Undo move on board representation
      chess.undo();
      setBoardFen(chess.fen());
      setArrows([
        {
          orig: orig,
          dest: dest,
          brush: "red",
        },
      ]);

      setIsFailed(true);
      const elapsed = Math.max(1, (Date.now() - timerStartRef.current) / 1000);
      setFeedback({
        type: "error",
        message: `¡Cuidado! Esa fue la jugada que hiciste en tu partida real (${puzzle.user_move.san}) y te costó ${puzzle.engine_solution.cpl} centipeones.`,
      });

      // Submit attempt
      submitPuzzleAttempt({
        username,
        puzzle_id: puzzle.id,
        played_uci: playedUci,
        is_solved: false,
        repeated_old_blunder: true,
        hints_used: hintLevel,
        time_spent_seconds: elapsed,
      }).catch(console.error);

      if (onAttemptFinished) {
        onAttemptFinished({
          isSolved: false,
          firstTry: false,
          repeatedOldBlunder: true,
        });
      }
      return;
    }

    // 3. Alternative move: Evaluate dynamically via backend Stockfish
    // Revert the tentative move on chess instance for now
    chess.undo();
    setIsEvaluating(true);
    setFeedback({
      type: "idle",
      message: "Analizando tu jugada con el motor pedagógico...",
    });

    try {
      const evalRes: EvaluateMoveResponse = await evaluateMove({
        puzzle_id: puzzle.id,
        played_uci: playedUci,
        fen: chess.fen(),
      });

      setIsEvaluating(false);

      if (evalRes.is_valid) {
        // Valid alternative! Play move
        chess.move({ from: orig, to: dest, promotion: "q" });
        setBoardFen(chess.fen());
        setArrows([{ orig, dest, brush: "green" }]);

        if (evalRes.opponent_reply_uci) {
          setIsOpponentMoving(true);
          const oppUci = evalRes.opponent_reply_uci.toLowerCase();
          const oppOrig = oppUci.slice(0, 2) as Key;
          const oppDest = oppUci.slice(2, 4) as Key;

          setTimeout(() => {
            try {
              chess.move({ from: oppOrig, to: oppDest, promotion: "q" });
              setBoardFen(chess.fen());
              setArrows([{ orig: oppOrig, dest: oppDest, brush: "blue" }]);
            } catch (e) {
              // ignore
            }
            finishPuzzleSuccess(playedUci, isFirstTry, evalRes.message);
          }, 600);
        } else {
          finishPuzzleSuccess(playedUci, isFirstTry, evalRes.message);
        }
      } else {
        // Suboptimal move
        setArrows([{ orig, dest, brush: "red" }]);
        setFeedback({
          type: "warning",
          message: evalRes.message,
        });
        setTimeout(() => {
          setArrows([]);
        }, 1200);
      }
    } catch (err: any) {
      setIsEvaluating(false);
      setFeedback({
        type: "warning",
        message: "Jugada legal, pero no es la combinación táctica ganadora.",
      });
      setTimeout(() => {
        setArrows([]);
      }, 1000);
    }
  };

  const finishPuzzleSuccess = (lastUci: string, isFirstTry: boolean, message: string) => {
    setIsOpponentMoving(false);
    setIsSolved(true);
    setFeedback({
      type: "success",
      message,
    });

    const elapsed = Math.max(1, (Date.now() - timerStartRef.current) / 1000);

    // Persist attempt
    submitPuzzleAttempt({
      username,
      puzzle_id: puzzle.id,
      played_uci: lastUci,
      is_solved: true,
      repeated_old_blunder: false,
      hints_used: hintLevel,
      time_spent_seconds: elapsed,
    }).catch(console.error);

    if (onAttemptFinished) {
      onAttemptFinished({
        isSolved: true,
        firstTry: isFirstTry,
        repeatedOldBlunder: false,
      });
    }
  };

  const handleReset = () => {
    chessRef.current = new Chess(puzzle.fen_before);
    setBoardFen(puzzle.fen_before);
    setPvStepIndex(0);
    setIsSolved(false);
    setIsFailed(false);
    setIsOpponentMoving(false);
    setIsEvaluating(false);
    setArrows([]);
    setFeedback({ type: "idle", message: "" });
    timerStartRef.current = Date.now();
  };

  const handleRevealSolution = () => {
    const bestUci = puzzle.engine_solution.best_move_uci.toLowerCase();
    setArrows([
      {
        orig: bestUci.slice(0, 2) as Key,
        dest: bestUci.slice(2, 4) as Key,
        brush: "blue",
      },
    ]);
    setHintLevel(3);
    setFeedback({
      type: "warning",
      message: `Solución: ${puzzle.engine_solution.best_move_san}. Variante recomendada: ${puzzle.engine_solution.pv_san.join(" ")}`,
    });
    setIsSolved(true);
    setIsFailed(false);

    submitPuzzleAttempt({
      username,
      puzzle_id: puzzle.id,
      played_uci: bestUci,
      is_solved: true,
      repeated_old_blunder: false,
      hints_used: 3,
      time_spent_seconds: Math.max(1, (Date.now() - timerStartRef.current) / 1000),
    }).catch(console.error);
  };

  const handleAskHint = () => {
    setHintLevel((prev) => Math.min(3, prev + 1));
  };

  const handleShowFullContinuation = () => {
    setShowingEngineContinuation(true);
    // Play full pv_san in feedback
    setFeedback({
      type: "success",
      message: `Continuación completa del motor: ${puzzle.engine_solution.pv_san.join(" ")}`,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Board Column */}
      <div className="lg:col-span-7 flex flex-col items-center">
        {/* Anti-Impulse Countdown Banner */}
        {antiImpulseCount > 0 && (
          <div className="w-full max-w-[460px] mb-3 bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl p-3 flex items-center justify-between text-amber-300 animate-pulse">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Modo Anti-Impulso: ¡Calcula antes de mover!</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/30 font-mono font-extrabold text-sm text-white">
              <Clock className="w-4 h-4 text-amber-300" />
              <span>{antiImpulseCount}s</span>
            </div>
          </div>
        )}

        <div className="w-full max-w-[460px] flex justify-between items-center mb-2 px-1">
          <div className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <span>Ejercicio {puzzleIndex + 1} de {totalPuzzles}</span>
            {puzzle.is_mastered && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Award className="w-3 h-3" /> Dominado
              </span>
            )}
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
            {puzzle.metadata.eco} · {puzzle.classification.phase.toUpperCase()}
          </div>
        </div>

        {/* Board Component */}
        <ChessgroundBoard
          fen={boardFen}
          orientation={orientation}
          turnColor={puzzle.turn}
          onMove={handleMove}
          shapes={arrows}
          viewOnly={isBoardLocked}
        />

        <div className="w-full max-w-[460px] mt-3 flex justify-between items-center text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-medium text-slate-200">
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block border ${
                  isUserWhite ? "bg-white border-slate-300" : "bg-slate-900 border-slate-600 shadow-sm"
                }`}
              />
              <span>Tu turno ({userColorLabel})</span>
            </span>
            {isOpponentMoving && (
              <span className="text-cyan-400 font-semibold animate-pulse">
                ({opponentName} está respondiendo...)
              </span>
            )}
            {isEvaluating && (
              <span className="text-amber-400 font-semibold animate-pulse">
                (Evaluando jugada alternativa...)
              </span>
            )}
          </div>
          <span className="font-mono">
            Movimiento {puzzle.turn === "black" ? `${puzzle.move_number}...` : `${puzzle.move_number}.`}
          </span>
        </div>
      </div>

      {/* Control & Pedagogical Panel */}
      <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="border-b border-slate-700 pb-4 mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Repetición de Error Real
            </h3>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-300">
                Partida contra <span className="text-white font-bold">{opponentName}</span>
              </p>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300">
                  Tú: <strong className={isUserWhite ? "text-slate-100" : "text-amber-300"}>{userColorLabel}</strong>
                </span>
                <span className="text-slate-500">vs</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-400">
                  Rival: <span className="text-slate-200">{opponentName} ({opponentColorLabel})</span>
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {puzzle.metadata.opening_name || "Apertura estándar"} ({puzzle.metadata.eco})
            </p>
          </div>

          {/* Past Mistake Summary */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <div className="text-xs text-red-300 font-medium">Tu jugada en la partida:</div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-base font-bold text-red-400 font-mono">
                {puzzle.turn === "black" ? `${puzzle.move_number}... ` : `${puzzle.move_number}. `}{puzzle.user_move.san}
              </span>
              <span className="text-xs text-red-300 bg-red-950/60 px-2 py-0.5 rounded">
                -{puzzle.engine_solution.cpl} CPL
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-2 flex gap-4">
              <span>Tiempo invertido: {puzzle.user_move.time_spent_seconds}s</span>
              <span>Tema: {puzzle.classification.theme.replace("_", " ")}</span>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback.message && (
            <div
              className={`rounded-xl p-3.5 mb-4 text-sm flex items-start gap-2.5 transition-all ${
                feedback.type === "success"
                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30"
                  : feedback.type === "error"
                  ? "bg-rose-500/20 text-rose-200 border border-rose-500/30"
                  : "bg-amber-500/20 text-amber-200 border border-amber-500/30"
              }`}
            >
              {feedback.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              {feedback.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              {feedback.type === "warning" && <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
              <div>{feedback.message}</div>
            </div>
          )}

          {/* Progressive Hints Section */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pistas del Profesor ({hintLevel}/3)
              </span>
              {hintLevel < 3 && !isSolved && (
                <button
                  onClick={handleAskHint}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Pedir Pista {hintLevel + 1}
                </button>
              )}
            </div>

            {hintLevel === 0 && (
              <p className="text-xs text-slate-500 italic">
                Encuentra la mejor jugada para tu posición. Si te atascas, pide una pista conceptual.
              </p>
            )}

            {hintLevel >= 1 && (
              <div className="text-xs text-amber-200/90 mb-2 border-l-2 border-amber-400 pl-2 py-0.5">
                <span className="font-semibold text-amber-300">Pista 1: </span>
                {puzzle.tutor_hints.level_1_conceptual}
              </div>
            )}

            {hintLevel >= 2 && (
              <div className="text-xs text-cyan-200/90 mb-2 border-l-2 border-cyan-400 pl-2 py-0.5">
                <span className="font-semibold text-cyan-300">Pista 2: </span>
                {puzzle.tutor_hints.level_2_directional}
              </div>
            )}

            {hintLevel >= 3 && (
              <div className="text-xs text-emerald-200/90 border-l-2 border-emerald-400 pl-2 py-0.5">
                <span className="font-semibold text-emerald-300">Pista 3: </span>
                {puzzle.tutor_hints.level_3_concrete}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {/* Optional Engine Continuation Button */}
          {isSolved && puzzle.engine_solution.pv_uci && puzzle.engine_solution.pv_uci.length > 3 && !showingEngineContinuation && (
            <button
              onClick={handleShowFullContinuation}
              className="w-full py-2 px-3 rounded-xl bg-slate-700/60 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              Ver continuación completa del motor
            </button>
          )}

          <div className="flex gap-3">
            {!isSolved ? (
              <>
                <button
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm font-medium flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reiniciar
                </button>
                <button
                  onClick={handleRevealSolution}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium flex items-center justify-center gap-2 transition"
                >
                  <Eye className="w-4 h-4" />
                  Ver Solución
                </button>
              </>
            ) : (
              <button
                onClick={onNext}
                className="w-full py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/30"
              >
                Siguiente Ejercicio
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
