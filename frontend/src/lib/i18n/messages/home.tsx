/** Portada: buscador, ejemplo y "cómo funciona". */
import type { ReactNode } from "react";
import type { Rich } from "./common";

const en = {
  badgeDemo: "Stockfish in your browser + your Chess.com history",
  badgeFull: "Stockfish + your Chess.com history",
  title: (em: Rich) => <>Stop repeating {em("the same")} mistakes.</>,
  intro: "We analyze your real games, find the 3 leaks costing you the most Elo, and put you to work on the exact positions where you went wrong.",
  usernameLabel: "Chess.com username",
  usernamePlaceholder: "hikaru, magnuscarlsen or yours",
  continueAs: (name: ReactNode) => <>Continue as {name}</>,
  exampleQuestion: "Don't play on Chess.com?",
  exampleCta: "Try Hikaru's blitz games",
  paceLegend: "Time control",
  gamesLegend: "Games",
  gamesAria: "Number of games",
  submit: "Analyze my games",
  preparing: "Getting ready…",
  stepsTitle: "Three steps, zero generic theory",
  steps: [
    {
      title: "We download your games",
      text: "We read your public Chess.com history, including how long you spent on every move.",
    },
    {
      title: "Stockfish finds the pattern",
      text: "We measure how much your winning chances drop on every move and classify why: a hanging piece, a fork, impulsiveness or time trouble.",
    },
    {
      title: "You train your own mistakes",
      text: "You go back to the exact position where you went wrong, with progressive hints and spaced repetition until you master it.",
    },
  ],
  mateIn4: "Checkmate in 4 moves",
};

const es: typeof en = {
  badgeDemo: "Stockfish en tu navegador + tu historial de Chess.com",
  badgeFull: "Stockfish + tu historial de Chess.com",
  title: (em: Rich) => <>Deja de repetir {em("los mismos")} errores.</>,
  intro: "Analizamos tus partidas reales, encontramos las 3 fugas que más Elo te cuestan y te ponemos a resolver las posiciones exactas donde fallaste.",
  usernameLabel: "Usuario de Chess.com",
  usernamePlaceholder: "hikaru, magnuscarlsen o el tuyo",
  continueAs: (name: ReactNode) => <>Continuar como {name}</>,
  exampleQuestion: "¿No juegas en Chess.com?",
  exampleCta: "Prueba con las partidas blitz de Hikaru",
  paceLegend: "Ritmo",
  gamesLegend: "Partidas",
  gamesAria: "Número de partidas",
  submit: "Analizar mis partidas",
  preparing: "Preparando…",
  stepsTitle: "Tres pasos, cero teoría genérica",
  steps: [
    {
      title: "Descargamos tus partidas",
      text: "Leemos tu historial público de Chess.com, incluido el tiempo que gastaste en cada jugada.",
    },
    {
      title: "Stockfish encuentra el patrón",
      text: "Medimos cuánto cae tu probabilidad de ganar en cada jugada y clasificamos el motivo: pieza colgada, horquilla, impulsividad o apuro de tiempo.",
    },
    {
      title: "Entrenas tus propios errores",
      text: "Vuelves a la posición exacta donde fallaste, con pistas progresivas y repetición espaciada hasta dominarla.",
    },
  ],
  mateIn4: "Jaque mate en 4 jugadas",
};

const home = { en, es };
export default home;
