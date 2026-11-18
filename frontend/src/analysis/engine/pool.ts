/**
 * Pool de procesos Stockfish que hablan UCI (equivalente a StockfishPool de Python).
 * Cada proceso es single-thread; el paralelismo viene de tener varios. El transporte
 * (Web Worker en el navegador, paquete npm en Node) se inyecta.
 *
 * Nunca se queda colgado: si un proceso no arranca, falla o deja de responder, sus trabajos
 * se rechazan con `EngineError`; si mueren todos, también los que quedan en cola.
 */
import type { PositionEvaluation } from "../types";
import { parseInfoLine, terminalEvaluation, toEvaluation, type UciInfo } from "./uci";

export interface UciProcess {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
  /** Error irrecuperable del proceso (p. ej. el Worker no pudo cargar el motor). Opcional. */
  onError?(listener: (error: Error) => void): void;
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

export class EngineError extends Error {}

export const ENGINE_START_TIMEOUT_MS = 20_000;
/** Margen sobre `movetime` para una sola posición (la profundidad puede alargarla en máquinas lentas). */
export const ENGINE_MOVE_TIMEOUT_MS = 30_000;

const START_FAILED =
  "No se pudo iniciar el motor de análisis en tu navegador. Prueba con un navegador actualizado (Chrome, Firefox, Safari o Edge).";

interface Job {
  fen: string;
  limits: EvalLimits;
  resolve: (ev: PositionEvaluation) => void;
  reject: (err: Error) => void;
}

class Slot {
  private waiting: { done: (l: string) => boolean; onOther?: (l: string) => void; resolve: () => void; reject: (e: Error) => void } | null =
    null;
  dead: Error | null = null;
  ready: Promise<void>;

  constructor(readonly proc: UciProcess, startTimeoutMs: number) {
    proc.onLine((line) => {
      const w = this.waiting;
      if (!w) return;
      if (w.done(line)) {
        this.waiting = null;
        w.resolve();
      } else {
        w.onOther?.(line);
      }
    });
    proc.onError?.((err) => this.kill(new EngineError(`${START_FAILED} (${err.message})`)));
    this.ready = this.until("uci", (l) => l === "uciok", undefined, startTimeoutMs, START_FAILED).then(() => {
      proc.send("setoption name Hash value 16");
      return this.until("isready", (l) => l === "readyok", undefined, startTimeoutMs, START_FAILED);
    });
    this.ready.catch(() => undefined); // el error se entrega a quien use el slot
  }

  kill(err: Error) {
    if (this.dead) return;
    this.dead = err;
    const w = this.waiting;
    this.waiting = null;
    w?.reject(err);
    try {
      this.proc.terminate();
    } catch {
      // ya terminado
    }
  }

  /** Envía un comando y espera la línea que cumpla `done`, con tiempo máximo. */
  until(command: string, done: (l: string) => boolean, onOther: ((l: string) => void) | undefined, timeoutMs: number, timeoutMsg: string) {
    if (this.dead) return Promise.reject(this.dead);
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.kill(new EngineError(timeoutMsg)), timeoutMs);
      this.waiting = {
        done,
        onOther,
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      this.proc.send(command);
    });
  }

  async run(fen: string, limits: EvalLimits, moveTimeoutMs: number): Promise<PositionEvaluation> {
    await this.ready;
    this.proc.send(`position fen ${fen}`);
    let last: UciInfo | null = null;
    const go = `go depth ${limits.depth}` + (limits.movetime ? ` movetime ${limits.movetime}` : "");
    await this.until(
      go,
      (l) => l.startsWith("bestmove"),
      (l) => {
        const info = parseInfoLine(l);
        if (info) last = info;
      },
      moveTimeoutMs + (limits.movetime ?? 0),
      "El motor de análisis dejó de responder. Recarga la página e inténtalo de nuevo."
    );
    return toEvaluation(fen, limits.depth, last);
  }
}

export class EnginePool implements Engine {
  private slots: Slot[];
  private idle: Slot[];
  private queue: Job[] = [];

  constructor(
    factory: () => UciProcess,
    size: number,
    private readonly timeouts = { start: ENGINE_START_TIMEOUT_MS, move: ENGINE_MOVE_TIMEOUT_MS }
  ) {
    this.slots = Array.from({ length: Math.max(1, size) }, () => {
      try {
        return new Slot(factory(), timeouts.start);
      } catch (e) {
        // p. ej. `new Worker` lanza si el navegador no admite Workers
        const slot = Object.create(Slot.prototype) as Slot;
        slot.dead = new EngineError(`${START_FAILED} (${(e as Error).message})`);
        slot.ready = Promise.reject(slot.dead);
        slot.ready.catch(() => undefined);
        return slot;
      }
    });
    this.idle = this.slots.filter((s) => !s.dead);
    if (!this.idle.length) this.failAll();
  }

  get size() {
    return this.slots.length;
  }

  /** ¿Queda al menos un motor vivo? */
  get alive() {
    return this.slots.some((s) => !s.dead);
  }

  evaluate(fen: string, limits: EvalLimits): Promise<PositionEvaluation> {
    const terminal = terminalEvaluation(fen);
    if (terminal) return Promise.resolve(terminal);
    if (!this.alive) return Promise.reject(this.slots[0].dead ?? new EngineError(START_FAILED));
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
        .run(job.fen, job.limits, this.timeouts.move)
        .then(job.resolve, (e) => job.reject(e instanceof Error ? e : new Error(String(e))))
        .finally(() => {
          if (!slot.dead) this.idle.push(slot);
          if (!this.alive) this.failAll();
          else this.pump();
        });
    }
  }

  private failAll() {
    const err = this.slots.find((s) => s.dead)?.dead ?? new EngineError(START_FAILED);
    this.queue.forEach((j) => j.reject(err));
    this.queue = [];
  }

  dispose() {
    this.queue.forEach((j) => j.reject(new EngineError("Motor detenido")));
    this.queue = [];
    this.slots.forEach((s) => s.kill(new EngineError("Motor detenido")));
  }
}
