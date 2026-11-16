/**
 * Pool de procesos Stockfish que hablan UCI (equivalente a StockfishPool de Python).
 * Cada proceso es single-thread; el paralelismo viene de tener varios. El transporte
 * (Web Worker en el navegador, paquete npm en Node) se inyecta.
 */
import type { PositionEvaluation } from "../types";
import { parseInfoLine, terminalEvaluation, toEvaluation, type UciInfo } from "./uci";

export interface UciProcess {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
  terminate(): void;
}

export interface EvalLimits {
  depth: number;
  /** Tope de tiempo en ms (el que llegue antes, como Limit(depth, time) en python-chess). */
  movetime?: number;
}

export interface Engine {
  evaluate(fen: string, limits: EvalLimits): Promise<PositionEvaluation>;
  readonly size: number;
  dispose(): void;
}

interface Job {
  fen: string;
  limits: EvalLimits;
  resolve: (ev: PositionEvaluation) => void;
  reject: (err: Error) => void;
}

class Slot {
  private waiting: ((line: string) => boolean) | null = null;
  ready: Promise<void>;

  constructor(readonly proc: UciProcess) {
    proc.onLine((line) => {
      if (this.waiting && this.waiting(line)) this.waiting = null;
    });
    this.ready = this.until("uci", (l) => l === "uciok")
      .then(() => {
        proc.send("setoption name Hash value 16");
        return this.until("isready", (l) => l === "readyok");
      });
  }

  /** Envía un comando y espera la línea que cumpla `done`. */
  until(command: string, done: (line: string) => boolean, onOther?: (line: string) => void): Promise<void> {
    return new Promise((resolve) => {
      this.waiting = (line) => {
        if (done(line)) {
          resolve();
          return true;
        }
        onOther?.(line);
        return false;
      };
      this.proc.send(command);
    });
  }

  async run(fen: string, limits: EvalLimits): Promise<PositionEvaluation> {
    await this.ready;
    this.proc.send(`position fen ${fen}`);
    let last: UciInfo | null = null;
    const go = `go depth ${limits.depth}` + (limits.movetime ? ` movetime ${limits.movetime}` : "");
    await this.until(go, (l) => l.startsWith("bestmove"), (l) => {
      const info = parseInfoLine(l);
      if (info) last = info;
    });
    return toEvaluation(fen, limits.depth, last);
  }
}

export class EnginePool implements Engine {
  private slots: Slot[];
  private idle: Slot[];
  private queue: Job[] = [];

  constructor(factory: () => UciProcess, size: number) {
    this.slots = Array.from({ length: Math.max(1, size) }, () => new Slot(factory()));
    this.idle = [...this.slots];
  }

  get size() {
    return this.slots.length;
  }

  evaluate(fen: string, limits: EvalLimits): Promise<PositionEvaluation> {
    const terminal = terminalEvaluation(fen);
    if (terminal) return Promise.resolve(terminal);
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, limits, resolve, reject });
      this.pump();
    });
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const slot = this.idle.pop()!;
      const job = this.queue.shift()!;
      slot
        .run(job.fen, job.limits)
        .then(job.resolve, (e) => job.reject(e instanceof Error ? e : new Error(String(e))))
        .finally(() => {
          this.idle.push(slot);
          this.pump();
        });
    }
  }

  dispose() {
    this.queue.forEach((j) => j.reject(new Error("Motor detenido")));
    this.queue = [];
    this.slots.forEach((s) => s.proc.terminate());
  }
}
