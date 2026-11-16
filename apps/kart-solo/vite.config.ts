import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/kart-engine/",
  // Hoisted Fiber/Drei and the native driver must resolve this app's pinned Three.
  resolve: { dedupe: ["three"] },
  plugins: [react()],
  build: { outDir: "../web/public/kart-engine", emptyOutDir: true },
});
