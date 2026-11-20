import { describe, expect, it } from "vitest";
import { LANG_BOOT_SCRIPT, LANG_STORAGE_KEY, langFromPath, localizePath, stripLang, switchLangPath } from "./paths";

describe("rutas por idioma", () => {
  it("detecta el idioma de la ruta", () => {
    expect(langFromPath("/")).toBe("en");
    expect(langFromPath("/dashboard")).toBe("en");
    expect(langFromPath("/es")).toBe("es");
    expect(langFromPath("/es/trainer")).toBe("es");
    expect(langFromPath("/estadisticas")).toBe("en"); // no es el prefijo /es
  });

  it("quita y pone el prefijo conservando query y hash", () => {
    expect(stripLang("/es")).toBe("/");
    expect(stripLang("/es?username=x")).toBe("/?username=x");
    expect(stripLang("/es/dashboard?username=x#reloj")).toBe("/dashboard?username=x#reloj");
    expect(localizePath("/", "es")).toBe("/es");
    expect(localizePath("/?username=x", "es")).toBe("/es?username=x");
    expect(localizePath("/trainer?username=x&puzzle=bb_1", "es")).toBe("/es/trainer?username=x&puzzle=bb_1");
    expect(localizePath("/es/trainer", "en")).toBe("/trainer");
    expect(localizePath("/es/trainer", "es")).toBe("/es/trainer");
  });

  it("no toca enlaces externos", () => {
    expect(localizePath("https://www.chess.com/game/1", "es")).toBe("https://www.chess.com/game/1");
    expect(localizePath("//cdn.example.com/x", "es")).toBe("//cdn.example.com/x");
  });

  it("cambia de idioma en la misma página", () => {
    expect(switchLangPath("/dashboard?username=x", "es")).toBe("/es/dashboard?username=x");
    expect(switchLangPath("/es/dashboard?username=x", "en")).toBe("/dashboard?username=x");
    expect(switchLangPath("/es", "en")).toBe("/");
  });
});

/** Ejecuta el script de arranque con un navegador simulado y devuelve a dónde redirige (o null). */
function boot(path: string, opts: { stored?: string | null; languages?: string[] } = {}) {
  let replaced: string | null = null;
  const html = { lang: "en" };
  const [pathname, search = ""] = path.split("?");
  const location = { pathname, search: search ? `?${search}` : "", hash: "", replace: (u: string) => (replaced = u) };
  const localStorage = { getItem: (k: string) => (k === LANG_STORAGE_KEY ? opts.stored ?? null : null) };
  const navigator = { languages: opts.languages ?? ["en-US"], language: (opts.languages ?? ["en-US"])[0] };
  new Function("location", "localStorage", "navigator", "document", LANG_BOOT_SCRIPT)(location, localStorage, navigator, {
    documentElement: html,
  });
  return { replaced, lang: html.lang };
}

describe("script de arranque (antes de pintar)", () => {
  it("navegador en inglés: se queda en inglés", () => {
    expect(boot("/").replaced).toBeNull();
  });

  it("navegador en español: salta a /es conservando la ruta y la query", () => {
    expect(boot("/", { languages: ["es-ES", "en"] }).replaced).toBe("/es");
    expect(boot("/dashboard?username=x", { languages: ["es-419"] }).replaced).toBe("/es/dashboard?username=x");
  });

  it("la elección guardada manda sobre el navegador", () => {
    expect(boot("/", { stored: "en", languages: ["es-ES"] }).replaced).toBeNull();
    expect(boot("/trainer", { stored: "es", languages: ["en-US"] }).replaced).toBe("/es/trainer");
  });

  it("en /es no redirige nunca y marca lang=es", () => {
    expect(boot("/es/trainer", { stored: "en" })).toEqual({ replaced: null, lang: "es" });
  });
});
