import { describe, expect, it } from "vitest";
import { alternating, buildLine } from "./lineViewer";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("visor de líneas", () => {
  it("un fotograma por jugada, con SAN, bando, capturas y jaques", () => {
    const frames = buildLine(START, alternating(["e2e4", "d7d5", "e4d5", "d8d5", "f1b5"], "user"));
    expect(frames).toHaveLength(6);
    expect(frames[0]).toMatchObject({ fen: START, uci: null, san: null });
    expect(frames.slice(1).map((f) => f.san)).toEqual(["e4", "d5", "exd5", "Qxd5", "Bb5+"]);
    expect(frames.slice(1).map((f) => f.by)).toEqual(["user", "opp", "user", "opp", "user"]);
    expect(frames[3].capture).toBe(true);
    expect(frames[5].check).toBe(true);
  });

  it("refutación: marca el error y alterna desde el rival", () => {
    const frames = buildLine(START, [{ uci: "f2f3", by: "user", isBlunder: true }, ...alternating(["e7e5", "g2g4", "d8h4"], "opp")]);
    expect(frames.map((f) => f.by)).toEqual([null, "user", "opp", "user", "opp"]);
    expect(frames[1].isBlunder).toBe(true);
    expect(frames[4].san).toBe("Qh4#");
  });

  it("se detiene en la primera jugada ilegal", () => {
    expect(buildLine(START, alternating(["e2e4", "e2e4"], "user"))).toHaveLength(2);
  });
});
