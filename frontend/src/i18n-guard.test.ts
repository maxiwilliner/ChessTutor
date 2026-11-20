/**
 * Guardia contra textos sin traducir: las vistas y componentes no deben contener español fuera de comentarios
 * (todo texto visible va en `src/lib/i18n/messages`). Heurística: caracteres propios del español.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOTS = ["app", "views", "components"].map((d) => path.join(__dirname, d));
/** Excepciones intencionadas. */
const ALLOWED = new Set([
  "app/global-error.tsx", // sin proveedor de idioma: lleva sus textos en los dos idiomas
  "components/layout/LanguageSwitch.tsx", // «Español», el nombre del idioma en su lengua
]);
const SPANISH = /[áéíóúñ¿¡ÁÉÍÓÚÑ]/;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

describe("textos sin traducir", () => {
  it("no hay español en vistas ni componentes", () => {
    const offenders = ROOTS.flatMap(files)
      .filter((f) => !ALLOWED.has(path.relative(__dirname, f)))
      .flatMap((f) =>
        stripComments(readFileSync(f, "utf8"))
          .split("\n")
          .filter((line) => SPANISH.test(line))
          .map((line) => `${path.relative(__dirname, f)}: ${line.trim()}`)
      );
    expect(offenders).toEqual([]);
  });
});
