"use client";

/**
 * Sonidos del entrenador sintetizados con Web Audio (sin archivos ni licencias).
 * El AudioContext se crea en el primer sonido, que siempre sigue a un gesto del usuario.
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "chesstutor_sound";
const EVENT = "chesstutor:sound";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

export function isSoundOn(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // sin almacenamiento: dura la sesión
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Estado del sonido, sincronizado entre componentes. */
export function useSoundOn(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(isSoundOn());
    const sync = () => setOn(isSoundOn());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [on, setSoundOn];
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !isSoundOn()) return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Golpe de madera: ruido filtrado muy corto. */
function knock(freq: number, gain: number, at = 0) {
  const ac = audio();
  if (!ac) return;
  if (!noise) {
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.08), ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  }
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t);
}

function tone(freq: number, duration: number, gain: number, at = 0, type: OscillatorType = "sine") {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export const sound = {
  move: () => knock(1800, 0.9),
  capture: () => {
    knock(1400, 1);
    knock(900, 0.7, 0.045);
  },
  check: () => {
    knock(1800, 0.9);
    tone(880, 0.12, 0.08, 0.02, "triangle");
  },
  success: () => {
    tone(659.25, 0.22, 0.12);
    tone(783.99, 0.22, 0.12, 0.09);
    tone(1046.5, 0.35, 0.12, 0.18);
  },
  error: () => {
    tone(196, 0.28, 0.16, 0, "triangle");
    tone(146.83, 0.32, 0.12, 0.06, "triangle");
  },
};

/** Sonido según la SAN de la jugada (jaque/mate, captura o normal). */
export function playMoveSound(san: string | null | undefined) {
  if (!san) return;
  if (san.includes("+") || san.includes("#")) sound.check();
  else if (san.includes("x")) sound.capture();
  else sound.move();
}
