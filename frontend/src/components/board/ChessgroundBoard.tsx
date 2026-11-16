"use client";

import React, { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import { Api } from "chessground/api";
import { Config } from "chessground/config";
import { DrawShape } from "chessground/draw";
import { Key } from "chessground/types";
import { Chess } from "chess.js";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/motion";

export type BoardEffect = "shake" | "glow" | null;

interface ChessgroundBoardProps {
  fen: string;
  orientation?: "white" | "black";
  /** @deprecated El turno se deduce del FEN. */
  turnColor?: "white" | "black";
  onMove?: (orig: Key, dest: Key) => void;
  viewOnly?: boolean;
  shapes?: DrawShape[];
  lastMove?: [Key, Key] | null;
  /** Cambiarlo fuerza a resincronizar el tablero con `fen` (p. ej. tras deshacer una jugada). */
  syncKey?: number;
  effect?: BoardEffect;
  onEffectEnd?: () => void;
  showCoordinates?: boolean;
  className?: string;
  /** Capa superpuesta (p. ej. cuenta atrás anti-impulso). */
  children?: React.ReactNode;
}

function boardState(fen: string) {
  const dests = new Map<Key, Key[]>();
  let turn: "white" | "black" = fen.split(" ")[1] === "b" ? "black" : "white";
  let inCheck = false;
  try {
    const chess = new Chess(fen);
    turn = chess.turn() === "w" ? "white" : "black";
    inCheck = chess.inCheck();
    if (!chess.isGameOver()) {
      for (const move of chess.moves({ verbose: true })) {
        const from = move.from as Key;
        const list = dests.get(from) ?? [];
        list.push(move.to as Key);
        dests.set(from, list);
      }
    }
  } catch {
    // FEN parcial o inválido: tablero sin destinos
  }
  return { dests, turn, inCheck };
}

export const ChessgroundBoard: React.FC<ChessgroundBoardProps> = ({
  fen,
  orientation = "white",
  onMove,
  viewOnly = false,
  shapes = [],
  lastMove,
  syncKey = 0,
  effect = null,
  onEffectEnd,
  showCoordinates = true,
  className,
  children,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgApiRef = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const buildConfig = (): Config => {
    const { dests, turn, inCheck } = boardState(fen);
    const cfg: Config = {
      fen,
      orientation,
      turnColor: turn,
      check: inCheck ? turn : false,
      coordinates: showCoordinates,
      viewOnly: false, // mantener en false para que los eventos sigan enlazados
      movable: {
        free: false,
        color: viewOnly ? undefined : turn,
        dests: viewOnly ? new Map() : dests,
        showDests: !viewOnly,
        events: {
          after: (orig, dest) => onMoveRef.current?.(orig, dest),
        },
      },
      draggable: { enabled: !viewOnly, showGhost: true },
      selectable: { enabled: !viewOnly },
      drawable: { enabled: true, visible: true, autoShapes: shapes },
      highlight: { lastMove: true, check: true },
      animation: { enabled: !prefersReducedMotion(), duration: 260 },
    };
    if (lastMove !== undefined) cfg.lastMove = lastMove ?? undefined;
    return cfg;
  };

  // Crear una sola vez; destruir al desmontar.
  useEffect(() => {
    if (!boardRef.current) return;
    cgApiRef.current = Chessground(boardRef.current, buildConfig());

    // Redibujar al cambiar el tamaño (diferido a rAF para no provocar bucles de ResizeObserver).
    let lastWidth = boardRef.current.clientWidth;
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (!width || width === lastWidth) return;
      lastWidth = width;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => cgApiRef.current?.redrawAll());
    });
    ro.observe(boardRef.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      try {
        cgApiRef.current?.destroy();
      } catch {
        // ignorar
      }
      cgApiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar en cada cambio de estado.
  useEffect(() => {
    const api = cgApiRef.current;
    if (!api) return;
    api.set(buildConfig());
    api.setAutoShapes(shapes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, orientation, viewOnly, shapes, lastMove, syncKey, showCoordinates]);

  return (
    <div className={cn("relative w-full", className)}>
      <div
        onAnimationEnd={onEffectEnd}
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-xl border-[5px] border-ink-700 bg-[#a07a55] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)] ring-1 ring-brass-500/20",
          effect === "shake" && "animate-shake border-rose-500/70",
          effect === "glow" && "animate-glow border-emerald-500/70"
        )}
      >
        <div ref={boardRef} className="absolute inset-0" />
        {children}
      </div>
    </div>
  );
};
