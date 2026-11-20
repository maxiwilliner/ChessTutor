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
import { CodedError } from "@/lib/errors";

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
        reject(
          new CodedError("backend_unreachable", "No se pudo conectar con el servidor de análisis. Comprueba que el backend esté en marcha.")
        );
      };
    });
  },

  getSummary,
  // En español, el informe del backend (LLM o reglas). En inglés, el de reglas redactado en el navegador
  // hasta que el backend acepte un idioma.
  async getReport(username, lang = "es") {
    if (lang === "es") return getTutorReport(username);
    const [summary, { generateDeterministicTutorReport }] = await Promise.all([getSummary(username), import("@/analysis/tutor")]);
    return generateDeterministicTutorReport(summary, lang);
  },
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
