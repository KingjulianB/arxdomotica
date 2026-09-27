import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" — required because the add-on is served behind Home Assistant's
// ingress at a dynamic path prefix (X-Ingress-Path); absolute root paths break.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
  },
});
