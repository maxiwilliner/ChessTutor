import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { KnightMark } from "@/components/layout/KnightMark";
import { MobileTabBar, NavLinks } from "@/components/layout/NavLinks";
import { DemoBanner, DemoFooterControls } from "@/components/layout/DemoNotice";
import { APP_MODE } from "@/lib/mode";
import { CF_ANALYTICS_TOKEN, SITE_URL } from "@/lib/site";
import { FeedbackLink } from "@/components/layout/FeedbackLink";
import Script from "next/script";
import { Telemetry } from "@/components/layout/Telemetry";

const TAGLINE =
  "Analiza tus partidas de Chess.com con Stockfish, descubre las 3 fugas que más Elo te cuestan y entrena las posiciones exactas donde fallaste.";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "ChessTutor · Tu profesor personal de ajedrez",
    template: "%s · ChessTutor",
  },
  description: TAGLINE,
  metadataBase: new URL(SITE_URL),
  applicationName: "ChessTutor",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "ChessTutor",
    title: "ChessTutor · Deja de repetir los mismos errores",
    description: TAGLINE,
  },
  twitter: { card: "summary_large_image", title: "ChessTutor · Deja de repetir los mismos errores", description: TAGLINE },
};

export const viewport: Viewport = {
  themeColor: "#0B0F15",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`dark ${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col text-ivory">
        <Telemetry />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brass-400 focus:px-3 focus:py-2 focus:text-ink-950"
        >
          Saltar al contenido
        </a>

        <header className="sticky top-0 z-50 border-b border-ink-600/60 bg-ink-900/75 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="group flex items-center gap-2.5" aria-label="ChessTutor, inicio">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brass-500/30 bg-gradient-to-b from-brass-400/20 to-brass-400/5 text-brass-300 transition-colors group-hover:text-brass-200">
                <KnightMark className="h-6 w-6" />
              </span>
              <span className="font-display text-xl font-semibold tracking-tight text-ivory">
                Chess<span className="text-brass-400">Tutor</span>
              </span>
            </Link>
            <NavLinks />
          </div>
        </header>
        {APP_MODE === "demo" && <DemoBanner />}

        <main
          id="contenido"
          className={`mx-auto w-full max-w-7xl flex-1 px-4 pt-5 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8 ${APP_MODE === "demo" ? "pb-12" : "pb-28"}`}
        >
          {children}
        </main>

        <footer
          className={
            APP_MODE === "demo"
              ? "border-t border-ink-600/50 pb-28 pt-6 text-center text-xs text-ivory-faint sm:pb-6"
              : "hidden border-t border-ink-600/50 py-6 text-center text-xs text-ivory-faint sm:block"
          }
        >
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <span>ChessTutor · Análisis con Stockfish · Datos públicos de Chess.com · No afiliado a Chess.com</span>
              <Link href="/privacidad" className="hover:text-brass-300">
                Privacidad
              </Link>
              <FeedbackLink className="text-xs" />
            </div>
            {APP_MODE === "demo" && <DemoFooterControls />}
          </div>
        </footer>

        <MobileTabBar />
        {CF_ANALYTICS_TOKEN && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={JSON.stringify({ token: CF_ANALYTICS_TOKEN })}
          />
        )}
      </body>
    </html>
  );
}
