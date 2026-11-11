import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Sparkles, Trophy, Dumbbell } from "lucide-react";

export const metadata: Metadata = {
  title: "ChessTutor | Tu Profesor Personal de Ajedrez",
  description: "Diagnóstico pedagógico con Stockfish 16, detección de patrones psicológicos y entrenamiento interactivo de tus propios errores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
        {/* Navigation Bar */}
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                ChessTutor
              </span>
            </Link>

            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="text-slate-400 hover:text-white transition">
                Inicio
              </Link>
              <Link href="/dashboard" className="text-slate-400 hover:text-white transition flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Diagnóstico
              </Link>
              <Link href="/trainer" className="text-slate-400 hover:text-white transition flex items-center gap-1.5">
                <Dumbbell className="w-4 h-4 text-emerald-400" />
                Blunder Replay
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            ChessTutor &copy; {new Date().getFullYear()} · Cálculo con Stockfish 16 & python-chess · Conectado a la API de Chess.com
          </div>
        </footer>
      </body>
    </html>
  );
}

