/**
 * Diccionarios: recorre todas las entradas (llamando a las funciones con argumentos de ejemplo) para comprobar que
 * el inglés no tiene restos en español y que los dos idiomas tienen la misma forma.
 */
import { describe, expect, it } from "vitest";
import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { en, es } from "./messages";

const SPANISH = /[áéíóúñ¿¡ÁÉÍÓÚÑ]/;
/** Argumentos de ejemplo, en orden de prueba: textos, funciones de formato (textos destacados) y objetos. */
const ATTEMPTS: unknown[][] = [
  ["7", "3", "2", "1"],
  [(t: ReactNode) => t, (t: ReactNode) => t],
  [{ username: "player", timeClass: "rapid", status: 500, move: "12.", san: "Nf3", opp: "rival", reply: "Qh4", rest: "Bc4", from: "+1.0", to: "-2.0", best: "Bc4" }],
];

/** Texto de una entrada: cadenas tal cual, funciones con argumentos de ejemplo y JSX renderizado. */
function render(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (isValidElement(value)) return renderToStaticMarkup(value);
  if (typeof value === "function") {
    for (const args of ATTEMPTS) {
      try {
        return render((value as (...a: unknown[]) => unknown)(...args));
      } catch {
        // probar el siguiente tipo de argumentos
      }
    }
    throw new Error(`No se pudo evaluar la entrada: ${value.toString().slice(0, 80)}`);
  }
  return "";
}

function walk(node: unknown, path: string[], out: [string, string][]) {
  if (node && typeof node === "object" && !Array.isArray(node) && !isValidElement(node)) {
    for (const [k, v] of Object.entries(node)) walk(v, [...path, k], out);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, [...path, String(i)], out));
  } else {
    out.push([path.join("."), render(node)]);
  }
  return out;
}

describe("diccionarios", () => {
  const enEntries = walk(en, [], []);
  const esEntries = walk(es, [], []);

  it("inglés y español tienen las mismas claves (también en listas)", () => {
    expect(esEntries.map(([k]) => k)).toEqual(enEntries.map(([k]) => k));
  });

  it("ninguna entrada vacía", () => {
    const empty = [...enEntries, ...esEntries].filter(([k, v]) => !v.trim() && k !== "labels.none");
    expect(empty).toEqual([]);
  });

  it("el inglés no tiene restos en español", () => {
    expect(enEntries.filter(([, v]) => SPANISH.test(v))).toEqual([]);
  });
});
