import type { AppMode } from "./store/types";

/** `NEXT_PUBLIC_MODE=demo` -> demo de coste 0 (todo en el navegador). Por defecto, versión completa con backend. */
export const APP_MODE: AppMode = process.env.NEXT_PUBLIC_MODE === "demo" ? "demo" : "full";
