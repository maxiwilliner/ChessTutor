"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Key } from "chessground/types";
import { DrawShape } from "chessground/draw";
import { ChessgroundBoard } from "./ChessgroundBoard";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Trampa Blackburne-Shilling: 4.Nxe5?? parece ganar un peón y acaba en mate. */
const START_FEN = "r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const LINE = ["f3e5", "d8g5", "e5f7", "g5g2", "h1f1", "g2e4", "c4e2", "d4f3"];
const STEP_MS = 1300;
const PAUSE_STEPS = 3;

interface Frame {
  fen: string;
  san: string;
  uci: string;
}

/** Tablero decorativo que reproduce en bucle un blunder y su castigo. */
export function DemoBoard({ className }: { className?: string }) {
  const frames = useMemo<Frame[]>(() => {
    const chess = new Chess(START_FEN);
    return LINE.map((uci) => {
      const mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
      return { fen: chess.fen(), san: mv.san, uci };
    });
  }, []);

  // -1 = posición inicial
  const [step, setStep] = useState(-1);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setStep(frames.length - 1);
      return;
    }
    const id = window.setInterval(() => {
      setStep((s) => (s >= frames.length - 1 + PAUSE_STEPS ? -1 : s + 1));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [frames.length]);

  const visible = Math.min(step, frames.length - 1);
  const frame = visible >= 0 ? frames[visible] : null;
  const fen = frame ? frame.fen : START_FEN;
  const lastMove = frame ? ([frame.uci.slice(0, 2), frame.uci.slice(2, 4)] as [Key, Key]) : null;
  const shapes = useMemo<DrawShape[]>(() => {
    if (!frame) return [];
    const whiteMove = visible % 2 === 0;
    return [{ orig: frame.uci.slice(0, 2) as Key, dest: frame.uci.slice(2, 4) as Key, brush: whiteMove ? "red" : "green" }];
  }, [frame, visible]);
  const isMate = visible === frames.length - 1;

  return (
    <figure className={cn("relative", className)}>
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-brass-400/10 blur-2xl" aria-hidden />
      <div className="relative">
        <ChessgroundBoard fen={fen} viewOnly shapes={shapes} lastMove={lastMove} showCoordinates={false}>
          {isMate && (
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center">
              <span className="animate-pop rounded-full border border-rose-400/40 bg-ink-950/85 px-3 py-1 text-xs font-semibold text-rose-200 backdrop-blur">
                Jaque mate en 4 jugadas
              </span>
            </div>
          )}
        </ChessgroundBoard>
      </div>
      <figcaption className="relative mt-4 flex flex-wrap items-center gap-1.5">
        {frames.map((f, i) => {
          const moveNo = 4 + Math.floor(i / 2);
          const white = i % 2 === 0;
          return (
            <span
              key={f.uci}
              className={cn(
                "num rounded-md px-1.5 py-0.5 text-xs transition-colors duration-300",
                i > visible && "text-ink-500",
                i <= visible && white && "text-ivory",
                i <= visible && !white && "text-emerald-300",
                i === 0 && i <= visible && "bg-rose-500/15 text-rose-300",
                i === visible && i !== 0 && "bg-ink-750"
              )}
            >
              {white && <span className="text-ivory-faint">{moveNo}. </span>}
              {f.san}
              {i === 0 && "??"}
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}
