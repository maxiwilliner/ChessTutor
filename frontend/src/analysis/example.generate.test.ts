/**
 * Genera el ejemplo pre-analizado de la demo (`public/example/<usuario>-<ritmo>.json`).
 * Solo corre con GENERATE_EXAMPLE=1:  npm run example:build
 * Regenéralo cada vez que subas ANALYSIS_VERSION (un test lo comprueba).
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { createNodeEngine } from "./engine/node";
import { runAnalysis } from "./pipeline";
import { ANALYSIS_VERSION } from "./version";
import { EXAMPLE_PLAYER } from "@/lib/example";
import { examplePath, type ExampleFile } from "@/lib/store/local";

const GAMES = 10;

describe.runIf(process.env.GENERATE_EXAMPLE)("ejemplo pre-analizado", () => {
  it(
    "analiza y guarda el ejemplo",
    async () => {
      // El cargador de Stockfish para Node sustituye `fetch` (para leer el .wasm): se guarda el original antes
      // y se reinstala después, con un User-Agent identificable (Chess.com lo pide a los clientes automáticos).
      const realFetch = globalThis.fetch;
      const engine = await createNodeEngine();
      const engineFetch = globalThis.fetch;
      globalThis.fetch = (input, init) =>
        realFetch(input, { ...init, headers: { ...((init?.headers as Record<string, string>) ?? {}), "User-Agent": "ChessTutor-example-builder" } });
      try {
        const { username, timeClass } = EXAMPLE_PLAYER;
        const result = await runAnalysis({
          username,
          timeClass,
          limit: GAMES,
          engine,
          onProgress: (e) => e.stage === "evaluating" && console.log(e.message),
        });
        const file: ExampleFile = {
          analysis_version: ANALYSIS_VERSION,
          created_at: new Date().toISOString(),
          username,
          time_class: timeClass,
          summary: { ...result.summary, engine_profile: "standard" },
          report: result.report,
          puzzles: result.puzzles,
        };
        const out = path.join(__dirname, "../../public", examplePath(username, timeClass));
        mkdirSync(path.dirname(out), { recursive: true });
        writeFileSync(out, JSON.stringify(file));
        console.log(`${result.games.length} partidas, ${result.puzzles.length} ejercicios -> ${out}`);
        expect(result.games.length).toBe(GAMES);
      } finally {
        engine.dispose();
        globalThis.fetch = engineFetch;
      }
    },
    20 * 60_000
  );
});
