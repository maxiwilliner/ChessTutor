import type { Config } from "tailwindcss";

/**
 * Sistema de diseño "Noche de torneo":
 * tinta profunda (fondos), marfil (texto), latón (marca) y colores semánticos de Tailwind
 * (emerald = acierto, rose = blunder, amber = reloj/advertencia, cyan = rival).
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090D",
          900: "#0B0F15",
          850: "#0F141C",
          800: "#141A24",
          750: "#19202C",
          700: "#1F2733",
          600: "#2A3342",
          500: "#3A4556",
        },
        ivory: {
          DEFAULT: "#F3EDE2",
          muted: "#BDB6AA",
          faint: "#8A8479",
        },
        brass: {
          200: "#F3DFB2",
          300: "#EBCB8B",
          400: "#DDB463",
          500: "#C99A45",
          600: "#A87C30",
          700: "#7F5D24",
          900: "#2E2412",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(243,237,226,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.6)",
        brass: "0 10px 30px -10px rgba(221,180,99,0.45)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-7px)" },
          "40%, 80%": { transform: "translateX(7px)" },
        },
        glow: {
          "0%": { boxShadow: "0 0 0 0 rgba(52,211,153,0.55)" },
          "100%": { boxShadow: "0 0 0 22px rgba(52,211,153,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        grow: {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
        confetti: {
          "0%": { transform: "translate(0, 0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translate(var(--dx), var(--dy)) rotate(var(--rot))", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        pop: "pop 0.25s ease-out both",
        shake: "shake 0.42s ease-in-out",
        glow: "glow 1s ease-out",
        shimmer: "shimmer 1.6s infinite",
        confetti: "confetti 0.95s cubic-bezier(0.15, 0.6, 0.4, 1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
