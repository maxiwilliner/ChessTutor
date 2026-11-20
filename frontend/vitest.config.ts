import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // JSX de los diccionarios con el runtime automático, como en Next
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
