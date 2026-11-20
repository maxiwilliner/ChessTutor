/** Números, porcentajes y fechas según el idioma (Intl). */
import { LOCALE, type Lang } from "./paths";

export interface Formatters {
  /** Número con decimales fijos: 93,3 / 93.3 */
  num: (n: number, digits?: number) => string;
  /** Número con hasta `maxDigits` decimales: 4,7 / 4.7 / 3 */
  numMax: (n: number, maxDigits?: number) => string;
  /** Porcentaje a partir de un valor 0-100: «93,3 %» / «93.3%» */
  pct: (n: number, maxDigits?: number) => string;
  /** Con signo: +4,5 / −3 */
  signed: (n: number, digits?: number) => string;
  /** Fecha corta desde un timestamp en segundos: «5 nov» / «Nov 5» */
  shortDate: (unixSeconds: number) => string;
  /** Rango de fechas (timestamps en segundos): «12 oct – 14 nov 2026» */
  dateRange: (fromSeconds: number, toSeconds: number) => string;
  /** Mes y año desde "2026-10": «oct 2026» / «Oct 2026» */
  monthYear: (isoMonth: string) => string;
  /** Duración aproximada: «~40 s», «~2 min» */
  duration: (seconds: number) => string;
  /** Segundos con hasta 1 decimal: «3 s», «5,4 s» */
  seconds: (s: number) => string;
}

export function makeFormatters(lang: Lang): Formatters {
  const locale = LOCALE[lang];
  const num = (n: number, digits = 0) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const numMax = (n: number, maxDigits = 1) => n.toLocaleString(locale, { maximumFractionDigits: maxDigits });
  const date = (s: number, opts: Intl.DateTimeFormatOptions) => new Date(s * 1000).toLocaleDateString(locale, opts);

  return {
    num,
    numMax,
    pct: (n, maxDigits = 1) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: maxDigits }).format(n / 100),
    signed: (n, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n), digits)}`,
    shortDate: (s) => date(s, { day: "numeric", month: "short" }),
    dateRange: (from, to) => {
      const a = new Date(from * 1000);
      const b = new Date(to * 1000);
      if (a.toDateString() === b.toDateString()) return date(to, { day: "numeric", month: "short", year: "numeric" });
      const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
      return fmt.formatRange(a, b);
    },
    monthYear: (iso) => {
      const [y, m] = iso.split("-").map(Number);
      if (!y || !m) return iso;
      return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
    },
    duration: (seconds) => (seconds < 60 ? `~${Math.round(seconds)} s` : `~${Math.round(seconds / 60)} min`),
    seconds: (s) => `${numMax(s, 1)} s`,
  };
}
