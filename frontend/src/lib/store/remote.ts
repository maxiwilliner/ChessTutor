/** Versión completa: todo pasa por la API del backend. */
import {
  createAnalysisEventSource,
  evaluateMove,
  getProfile,
  getPuzzles,
  getSummary,
  getTrainerStats,
  getTutorReport,
  submitPuzzleAttempt,
} from "@/lib/api";
import type { ProgressEvent } from "@/analysis/pipeline";
import type { DataStore } from "./types";

export const remoteStore: DataStore = {
  mode: "full",

  analyze({ username, timeClass, limit, onProgress, signal }) {
    return new Promise((resolve, reject) => {
      const sse = createAnalysisEventSource(username, timeClass, limit);
      signal?.addEventListener("abort", () => {
        sse.close();
        reject(new DOMException("Análisis cancelado", "AbortError"));
      });
      sse.onmessage = (event) => {
        const data = JSON.parse(event.data) as ProgressEvent;
        if (data.stage === "error") {
          sse.close();
          reject(new Error(data.message));
          return;
        }
        onProgress(data);
        if (data.stage === "complete") {
          sse.close();
          resolve();
        }
      };
      sse.onerror = () => {
        sse.close();
        reject(new Error("No se pudo conectar con el servidor de análisis. Comprueba que el backend esté en marcha."));
      };
    });
  },

  getSummary,
  getReport: getTutorReport,
  async getProfile(username) {
    try {
      return await getProfile(username);
    } catch {
      return null;
    }
  },
  getPuzzles,
  getTrainerStats,
  submitAttempt: submitPuzzleAttempt,
  evaluateMove: (puzzle, playedUci, fen) => evaluateMove({ puzzle_id: puzzle.id, played_uci: playedUci, fen }),
};
