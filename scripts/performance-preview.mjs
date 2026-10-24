import { preview } from "vite";
import { fileURLToPath } from "node:url";

// Explicit front-end audit server. The normal preview includes Worker/auth;
// this serves the same client build in isolation, with no API simulation.
const server = await preview({
  configFile: false,
  root: fileURLToPath(new URL("../apps/web", import.meta.url)),
  build: { outDir: "dist/client" },
  preview: { host: "127.0.0.1", port: 4174, strictPort: true },
});
server.printUrls();
