"use client";

import React, { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import { Api } from "chessground/api";
import { Config } from "chessground/config";
import { Key } from "chessground/types";
import { Chess } from "chess.js";

interface ChessgroundBoardProps {
  fen: string;
  orientation?: "white" | "black";
  turnColor?: "white" | "black";
  onMove?: (orig: Key, dest: Key) => void;
  viewOnly?: boolean;
  shapes?: any[];
  className?: string;
}

export const ChessgroundBoard: React.FC<ChessgroundBoardProps> = ({
  fen,
  orientation = "white",
  turnColor = "white",
  onMove,
  viewOnly = false,
  shapes = [],
  className = "",
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgApiRef = useRef<Api | null>(null);

  // Compute legal destination squares for movable pieces using chess.js
  const getDests = (currentFen: string) => {
    const dests = new Map<Key, Key[]>();
    try {
      const chess = new Chess(currentFen);
      if (chess.isGameOver()) return dests;

      const moves = chess.moves({ verbose: true });
      for (const move of moves) {
        const from = move.from as Key;
        const to = move.to as Key;
        if (!dests.has(from)) {
          dests.set(from, []);
        }
        dests.get(from)!.push(to);
      }
    } catch (e) {
      // Invalid or partial FEN fallback
    }
    return dests;
  };

  useEffect(() => {
    if (!boardRef.current) return;

    const dests = getDests(fen);

    const config: Config = {
      fen,
      orientation,
      turnColor,
      viewOnly,
      movable: {
        free: false,
        color: viewOnly ? undefined : turnColor,
        dests: viewOnly ? new Map() : dests,
        events: {
          after: (orig, dest) => {
            if (onMove) {
              onMove(orig, dest);
            }
          },
        },
      },
      drawable: {
        enabled: true,
        visible: true,
        autoShapes: shapes,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      animation: {
        enabled: true,
        duration: 250,
      },
    };

    if (!cgApiRef.current) {
      cgApiRef.current = Chessground(boardRef.current, config);
    } else {
      cgApiRef.current.set(config);
    }
  }, [fen, orientation, turnColor, viewOnly, shapes]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div
        ref={boardRef}
        className="w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] rounded-lg shadow-2xl border-4 border-slate-700 overflow-hidden"
      />
    </div>
  );
};

