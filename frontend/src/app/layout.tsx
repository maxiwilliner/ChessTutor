import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { MobileTabBar } from "@/components/layout/NavLinks";
import { DemoBanner } from "@/components/layout/DemoNotice";
import { SiteFooter, SiteHeader, SkipLink } from "@/components/layout/SiteChrome";
import { Telemetry } from "@/components/layout/Telemetry";
import { I18nProvider } from "@/lib/i18n";
import { siteMetadata } from "@/lib/i18n/metadata";
import { LANG_BOOT_SCRIPT } from "@/lib/i18n/paths";
import { APP_MODE } from "@/lib/mode";
import { CF_ANALYTICS_TOKEN, SITE_URL } from "@/lib/site";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

/** Inglés por defecto; la versión en español vive en /es (`app/es/layout.tsx`). */
export const metadata: Metadata = {
  ...siteMetadata("en"),
  metadataBase: new URL(SITE_URL),
};

export const viewport: Viewport = {
  themeColor: "#0B0F15",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // `lang` lo corrige el script de arranque en /es antes de pintar (de ahí suppressHydrationWarning)
    <html lang="en" className={`dark ${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col text-ivory">
        <Telemetry />
        <I18nProvider>
          <SkipLink />
          <SiteHeader />
          {APP_MODE === "demo" && <DemoBanner />}

          <main
            id="contenido"
            className={`mx-auto w-full max-w-7xl flex-1 px-4 pt-5 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8 ${APP_MODE === "demo" ? "pb-12" : "pb-28"}`}
          >
            {children}
          </main>

          <SiteFooter />
          <MobileTabBar />
        </I18nProvider>
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
