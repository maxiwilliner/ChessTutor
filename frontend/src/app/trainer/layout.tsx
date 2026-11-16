import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Entrenador",
  description: "Resuelve las posiciones reales donde cometiste blunders, con pistas progresivas y repetición espaciada.",
};

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
