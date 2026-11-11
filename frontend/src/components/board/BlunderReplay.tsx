"use client";

import React, { useState, useEffect } from "react";
import { BlunderBankItem } from "@/types/api";
import { ChessgroundBoard } from "./ChessgroundBoard";
import { Key } from "chessground/types";
import { Lightbulb, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, Eye, ShieldAlert } from "lucide-react";

interface BlunderReplayProps {
  puzzle: BlunderBankItem;
  puzzleIndex: number;
  totalPuzzles: number;
  onNext: () => void;
}

export const BlunderReplay: React.FC<BlunderReplayProps> = ({
  puzzle,
  puzzleIndex,
  totalPuzzles,
  onNext,
}) => {
  const [boardFen, setBoardFen] = useState(puzzle.fen_before);
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning" | "idle";
    message: string;
  }>({ type: "idle", message: "" });
  const [solved, setSolved] = useState(false);
  const [arrows, setArrows] = useState<any[]>([]);

  useEffect(() => {
    // Reset state on puzzle change
    setBoardFen(puzzle.fen_before);
    setHintLevel(0);
    setFeedback({ type: "idle", message: "" });
    setSolved(false);
    setArrows([]);
  }, [puzzle]);

  const handleMove = (orig: Key, dest: Key) => {
    const playedUci = `${orig}${dest}`;
    const targetBestUci = puzzle.engine_solution.best_move_uci.toLowerCase();
    const targetUserUci = puzzle.user_move.uci.toLowerCase();

    // User played the exact best move
    if (playedUci === targetBestUci || playedUci.startsWith(targetBestUci.slice(0, 4))) {
      setFeedback({
        type: "success",
        message: `¡Brillante! Encontraste ${puzzle.engine_solution.best_move_san}. Recuperas la ventaja con precisión.`,
      });
      setSolved(true);
      // Draw green arrow for best move
      setArrows([
        {
          orig: targetBestUci.slice(0, 2) as Key,
          dest: targetBestUci.slice(2, 4) as Key,
          brush: "green",
        },
      ]);
      return;
    }

    // User repeated their past mistake
    if (playedUci === targetUserUci) {
      setFeedback({
        type: "error",
        message: `¡Cuidado! Esa fue la jugada que hiciste en tu partida real (${puzzle.user_move.san}) y te costó ${puzzle.engine_solution.cpl} centipeones.`,
      });
      // Draw red arrow
      setArrows([
        {
          orig: targetUserUci.slice(0, 2) as Key,
          dest: targetUserUci.slice(2, 4) as Key,
          brush: "red",
        },
      ]);
      // Reset position after brief delay
      setTimeout(() => {
        setBoardFen(puzzle.fen_before);
      }, 900);
      return;
    }

    // Legal move but suboptimal
    setFeedback({
      type: "warning",
      message: "Jugada legal, pero hay una continuación táctica mucho más contundente.",
    });
    setTimeout(() => {
      setBoardFen(puzzle.fen_before);
    }, 900);
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
    setSolved(true);
  };

  const handleAskHint = () => {
    setHintLevel((prev) => Math.min(3, prev + 1));
  };

  const orientation = puzzle.metadata.user_color;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Board Column */}
      <div className="lg:col-span-7 flex flex-col items-center">
        <div className="w-full max-w-[460px] flex justify-between items-center mb-2 px-1">
          <div className="text-sm font-semibold text-slate-400">
            Ejercicio {puzzleIndex + 1} de {totalPuzzles}
          </div>
          <div className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono">
            {puzzle.metadata.eco} · {puzzle.classification.phase.toUpperCase()}
          </div>
        </div>

        <ChessgroundBoard
          fen={boardFen}
          orientation={orientation}
          turnColor={puzzle.turn}
          onMove={handleMove}
          shapes={arrows}
          viewOnly={solved}
        />

        <div className="w-full max-w-[460px] mt-3 flex justify-between items-center text-xs text-slate-400">
          <span>Juegan {puzzle.turn === "white" ? "Blancas" : "Negras"}</span>
          <span className="font-mono">Movimiento {puzzle.move_number}</span>
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
            <p className="text-sm text-slate-400 mt-1">
              Partida contra <span className="text-slate-200 font-semibold">{puzzle.metadata.black}</span> (
              {puzzle.metadata.opening_name})
            </p>
          </div>

          {/* Past Mistake Summary */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <div className="text-xs text-red-300 font-medium">Tu jugada en la partida:</div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-base font-bold text-red-400 font-mono">
                {puzzle.move_number}. {puzzle.user_move.san}
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
              className={`rounded-xl p-3.5 mb-4 text-sm flex items-start gap-2.5 ${
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
              {hintLevel < 3 && !solved && (
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
        <div className="flex gap-3 pt-2">
          {!solved ? (
            <>
              <button
                onClick={() => setBoardFen(puzzle.fen_before)}
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
  );
};

