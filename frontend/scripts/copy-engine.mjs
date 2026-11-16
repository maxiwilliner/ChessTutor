/**
 * Copia Stockfish 19 lite (WASM, single-thread) a public/engine para servirlo como Web Worker.
 * Stockfish es GPL-3.0: se copia también su licencia y se enlaza el código fuente desde la web.
 */
import { copyFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("stockfish/package.json"));
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "engine");
mkdirSync(out, { recursive: true });

for (const file of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
  copyFileSync(join(pkgDir, "bin", file), join(out, file));
}
copyFileSync(join(pkgDir, "Copying.txt"), join(out, "COPYING.txt"));
console.log("Stockfish copiado a public/engine");
