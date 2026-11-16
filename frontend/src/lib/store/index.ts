import type { DataStore } from "./types";
import { localStore } from "./local";
import { remoteStore } from "./remote";
import { APP_MODE } from "@/lib/mode";

export { APP_MODE };

export const store: DataStore = APP_MODE === "demo" ? localStore : remoteStore;

export type { DataStore, AppMode } from "./types";
