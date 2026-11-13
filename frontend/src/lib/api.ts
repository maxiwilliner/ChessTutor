import {
  PlayerDiagnosisSummary,
  BlunderBankItem,
  TutorPedagogicalReport,
  PuzzleAttemptRequest,
  PuzzleAttemptResponse,
  EvaluateMoveRequest,
  EvaluateMoveResponse,
  TrainerStatsResponse,
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function getProfile(username: string) {
  const res = await fetch(`${API_BASE}/chesscom/profile/${username}`);
  if (!res.ok) throw new Error(`Usuario '${username}' no encontrado`);
  return res.json();
}

export async function getSummary(username: string): Promise<PlayerDiagnosisSummary> {
  const res = await fetch(`${API_BASE}/analysis/summary/${username}`);
  if (!res.ok) throw new Error("No se encontró análisis previo para este usuario");
  return res.json();
}

export interface GetPuzzlesFilter {
  theme?: string;
  top_leak_only?: boolean;
  status?: "all" | "unsolved" | "mastered" | "review_due";
  limit?: number;
}

export async function getPuzzles(username: string, filter?: GetPuzzlesFilter): Promise<BlunderBankItem[]> {
  const query = new URLSearchParams();
  if (filter?.theme) query.append("theme", filter.theme);
  if (filter?.top_leak_only) query.append("top_leak_only", "true");
  if (filter?.status && filter.status !== "all") query.append("status", filter.status);
  if (filter?.limit) query.append("limit", filter.limit.toString());

  const queryString = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE}/analysis/puzzles/${encodeURIComponent(username)}${queryString}`);
  if (!res.ok) throw new Error("No se encontraron ejercicios");
  return res.json();
}

export async function getTrainerStats(username: string): Promise<TrainerStatsResponse> {
  const res = await fetch(`${API_BASE}/trainer/stats/${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error("No se pudieron cargar las estadísticas del entrenador");
  return res.json();
}

export async function submitPuzzleAttempt(attempt: PuzzleAttemptRequest): Promise<PuzzleAttemptResponse> {
  const res = await fetch(`${API_BASE}/trainer/attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attempt),
  });
  if (!res.ok) throw new Error("Error registrando el intento del ejercicio");
  return res.json();
}

export async function evaluateMove(req: EvaluateMoveRequest): Promise<EvaluateMoveResponse> {
  const res = await fetch(`${API_BASE}/trainer/evaluate-move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error("Error evaluando la jugada alternativa");
  return res.json();
}

export async function getTutorReport(username: string): Promise<TutorPedagogicalReport> {
  const res = await fetch(`${API_BASE}/tutor/report/${username}`);
  if (!res.ok) throw new Error("No se pudo generar el reporte del tutor");
  return res.json();
}

export function createAnalysisEventSource(username: string, timeClass: string = "rapid", limit: number = 15): EventSource {
  return new EventSource(`${API_BASE}/analysis/stream?username=${encodeURIComponent(username)}&time_class=${timeClass}&limit=${limit}`);
}

