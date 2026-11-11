import { PlayerDiagnosisSummary, BlunderBankItem, TutorPedagogicalReport } from "@/types/api";

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

export async function getPuzzles(username: string): Promise<BlunderBankItem[]> {
  const res = await fetch(`${API_BASE}/analysis/puzzles/${username}`);
  if (!res.ok) throw new Error("No se encontraron ejercicios");
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

