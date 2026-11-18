import { describe, expect, it } from "vitest";
import { EngineError, EnginePool, type UciProcess } from "./pool";

const FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

/** Proceso UCI falso con comportamiento configurable. */
function fakeProcess(mode: "ok" | "silent" | "error" | "throws" | "hangs-on-go"): () => UciProcess {
  return () => {
    if (mode === "throws") throw new Error("sin Workers");
    let line: (l: string) => void = () => undefined;
    let error: (e: Error) => void = () => undefined;
    return {
      onLine: (l) => (line = l),
      onError: (e) => (error = e),
      terminate: () => undefined,
      send: (cmd) =>
        setTimeout(() => {
          if (mode === "error") return error(new Error("404"));
          if (mode === "silent") return;
          if (cmd === "uci") line("uciok");
          if (cmd === "isready") line("readyok");
          if (cmd.startsWith("go") && mode === "ok") {
            line("info depth 5 score cp 20 pv e7e5");
            line("bestmove e7e5");
          }
        }, 1),
    };
  };
}

const fast = { start: 50, move: 50 };

describe("EnginePool no se cuelga", () => {
  it("funciona en el caso normal", async () => {
    const pool = new EnginePool(fakeProcess("ok"), 2, fast);
    await expect(pool.evaluate(FEN, { depth: 5 })).resolves.toMatchObject({ best_move_uci: "e7e5", score_cp: -20 });
  });

  it.each(["silent", "error", "throws"] as const)("motor que no arranca (%s) -> EngineError", async (mode) => {
    const pool = new EnginePool(fakeProcess(mode), 2, fast);
    await expect(pool.evaluate(FEN, { depth: 5 })).rejects.toBeInstanceOf(EngineError);
    expect(pool.alive).toBe(false);
    await expect(pool.evaluate(FEN, { depth: 5 })).rejects.toBeInstanceOf(EngineError);
  });

  it("motor que deja de responder a mitad -> EngineError y la cola se vacía", async () => {
    const pool = new EnginePool(fakeProcess("hangs-on-go"), 1, fast);
    const jobs = [pool.evaluate(FEN, { depth: 5 }), pool.evaluate(FEN, { depth: 5 })];
    for (const j of jobs) await expect(j).rejects.toBeInstanceOf(EngineError);
  });
});
