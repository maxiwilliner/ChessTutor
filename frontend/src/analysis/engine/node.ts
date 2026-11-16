/** Motor para Node (tests y scripts): mismo Stockfish WASM vía el paquete npm `stockfish`. No se usa en el navegador. */
import { createRequire } from "module";
import { copyFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { EnginePool, type UciProcess } from "./pool";

interface NpmEngine {
  listener: (line: string) => void;
  /** Nombre en el paquete 19.x; versiones posteriores lo exponen como `sendCommand`. */
  processCommand?: (cmd: string) => void;
  sendCommand?: (cmd: string) => void;
  terminate: () => void;
}

const FLAVOR = "stockfish-19-lite-single";

/**
 * El cargador de Node busca el binario como `stockfish.wasm` junto al script, así que se copia
 * el motor a un directorio temporal con ese nombre (sin tocar node_modules).
 */
function stageEngine(require: NodeRequire): string {
  const bin = join(dirname(require.resolve("stockfish/package.json")), "bin");
  const dir = mkdtempSync(join(tmpdir(), "chesstutor-sf-"));
  copyFileSync(join(bin, `${FLAVOR}.js`), join(dir, `${FLAVOR}.js`));
  copyFileSync(join(bin, `${FLAVOR}.wasm`), join(dir, `${FLAVOR}.wasm`));
  copyFileSync(join(bin, `${FLAVOR}.wasm`), join(dir, "stockfish.wasm"));
  return join(dir, `${FLAVOR}.js`);
}

/**
 * El cargador de Node del paquete comparte estado global: solo funciona un motor por proceso
 * (la segunda instancia llega sin `processCommand`). En el navegador cada Web Worker es independiente.
 */
export async function createNodeEngine(): Promise<EnginePool> {
  const require = createRequire(import.meta.url);
  const init = require("stockfish") as (path: string) => Promise<NpmEngine>;
  const e = await init(stageEngine(require));
  return new EnginePool((): UciProcess => {
    return {
      send: (cmd) => (e.processCommand ?? e.sendCommand)!.call(e, cmd),
      onLine: (listener) => {
        e.listener = (line) => line && listener(line.trim());
      },
      terminate: () => e.terminate(),
    };
  }, 1);
}
