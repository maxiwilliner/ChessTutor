import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diagnóstico",
  description: "Tus 3 fugas de Elo, psicología del reloj, repertorio de aperturas y plan de estudio semanal.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
