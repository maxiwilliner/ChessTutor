import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { classifyTacticalMotif, detectFork, detectHangingPiece, detectKingSafety, detectPinExploitation } from "./tactical";
import { tagMovePsychology } from "./clock";

// Mismas posiciones que backend/tests/test_heuristics.py y test_scoring.py
describe("heurísticas tácticas", () => {
  it("pieza colgada", () => {
    const b = new Chess("rnbqkb1r/1ppppppp/p7/8/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1");
    expect(detectHangingPiece(b, "e2e4")).toBe(false);
    expect(detectHangingPiece(b, "c3b5")).toBe(true);
  });

  it("clavada relativa", () => {
    expect(detectPinExploitation(new Chess("4q2k/4n3/8/8/8/8/8/4R1K1 b - - 0 1"), "e7g6")).toBe(true);
  });

  it("clavada absoluta al rey", () => {
    // El caballo de e7 está clavado al rey de e8 por la torre de e1
    const b = new Chess("4k3/4n3/8/8/8/8/8/4R1K1 b - - 0 1");
    expect(detectPinExploitation(b, "e8d8")).toBe(false);
  });

  it("horquilla", () => {
    expect(detectFork(new Chess("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1"), "d5c7")).toBe(true);
    const theme = classifyTacticalMotif("r3k3/8/8/8/1n6/8/8/R3K2Q w - - 0 1", "h1h3", 300, -200, ["b4c2"], 30);
    expect(theme).toBe("fork_overlooked");
  });

  it("seguridad del rey", () => {
    // Rey blanco en e1 en la jugada 20 sin peones en la columna e
    const b = new Chess("4k3/pppp1ppp/8/8/8/8/PPPP1PPP/4K3 w - - 0 20");
    expect(detectKingSafety(b, "w", 20)).toBe(true);
    expect(detectKingSafety(b, "w", 10)).toBe(false);
  });
});

describe("psicología del reloj", () => {
  it("umbrales relativos al ritmo", () => {
    expect(tagMovePsychology(2, 180, true, 600)).toBe("impulsive");
    expect(tagMovePsychology(4, 25, true, 600)).toBe("time_trouble");
    expect(tagMovePsychology(15, 120, true, 600)).toBe("normal");
    expect(tagMovePsychology(1, 500, false, 600)).toBe("normal");
    expect(tagMovePsychology(2, 40, true, 60)).toBe("normal");
    expect(tagMovePsychology(0.8, 40, true, 60)).toBe("impulsive");
    expect(tagMovePsychology(1.5, 8, true, 60)).toBe("time_trouble");
  });
});
