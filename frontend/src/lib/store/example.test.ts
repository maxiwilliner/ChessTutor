import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { ANALYSIS_VERSION } from "@/analysis/version";
import { EXAMPLE_PLAYER } from "@/lib/example";
import { examplePath, type ExampleFile } from "./local";

describe("ejemplo pre-analizado publicado", () => {
  const file = path.join(__dirname, "../../../public", examplePath(EXAMPLE_PLAYER.username, EXAMPLE_PLAYER.timeClass));

  it("existe y es de la versión actual del análisis (si no: npm run example:build)", () => {
    expect(existsSync(file)).toBe(true);
    const ex = JSON.parse(readFileSync(file, "utf8")) as ExampleFile;
    expect(ex.analysis_version).toBe(ANALYSIS_VERSION);
    expect(ex.summary.games?.length).toBeGreaterThan(0);
    expect(ex.puzzles.length).toBeGreaterThan(0);
    expect(ex.puzzles.every((p) => p.id.startsWith("bb_"))).toBe(true);
  });
});
