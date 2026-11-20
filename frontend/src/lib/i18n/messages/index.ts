/**
 * Diccionarios. Cada archivo de esta carpeta exporta `{ en, es }` de un área, con `es: typeof en`, así que
 * TypeScript exige que los dos idiomas tengan exactamente las mismas claves.
 */
import type { Lang } from "../paths";
import common from "./common";
import home from "./home";
import dashboard from "./dashboard";
import trainer from "./trainer";
import privacy from "./privacy";

export const en = {
  ...common.en,
  home: home.en,
  dashboard: dashboard.en,
  trainer: trainer.en,
  privacy: privacy.en,
};

export type Messages = typeof en;

export const es: Messages = {
  ...common.es,
  home: home.es,
  dashboard: dashboard.es,
  trainer: trainer.es,
  privacy: privacy.es,
};

export const MESSAGES: Record<Lang, Messages> = { en, es };
