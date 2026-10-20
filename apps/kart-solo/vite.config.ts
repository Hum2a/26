import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/kart-engine/",
  plugins: [react()],
  build: { outDir: "../web/public/kart-engine", emptyOutDir: true },
});
