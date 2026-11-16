import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/pipeline.json";
import { parseGamePgn, parseTimeControl, parseClockString } from "./parser";
import type { NormalizedGame } from "./types";

describe("parser (equivalencia con parser.py)", () => {
  it("helpers", () => {
    expect(parseTimeControl("180+2")).toEqual([180, 2]);
    expect(parseTimeControl("1/86400")).toEqual([0, 0]);
    expect(parseClockString("0:09:58.7")).toBeCloseTo(598.7);
  });

  fixture.games.forEach((g, i) => {
    it(`partida ${i + 1}`, () => {
      const expected = g.normalized as unknown as NormalizedGame;
      const game = parseGamePgn(g.pgn, fixture.username)!;
      expect(game).not.toBeNull();
      // end_time lo aporta el JSON de Chess.com, no el PGN: se compara aparte en el agregador.
      const omitEnd = ({ end_time, moves, ...rest }: NormalizedGame) => (void end_time, void moves, rest);
      expect(omitEnd(game)).toEqual(omitEnd(expected));
      const moves = game.moves;
      const expMoves = expected.moves;
      expect(moves.length).toBe(expMoves.length);
      moves.forEach((m, j) => {
        const e = expMoves[j];
        expect({ ply: m.ply, san: m.san, uci: m.uci, turn: m.turn, fen_before: m.fen_before, fen_after: m.fen_after }).toEqual({
          ply: e.ply, san: e.san, uci: e.uci, turn: e.turn, fen_before: e.fen_before, fen_after: e.fen_after,
        });
        expect(m.clock_remaining_seconds).toBeCloseTo(e.clock_remaining_seconds, 2);
        expect(m.time_spent_seconds).toBeCloseTo(e.time_spent_seconds, 2);
      });
    });
  });
});
