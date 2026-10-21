import { Buffer } from "node:buffer";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createServer,
  defineConfig,
  type Connect,
  type Plugin,
  type PreviewServer,
  type ViteDevServer,
} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { DEFAULT_THEME_ID, themeDocumentHead } from "./src/theme/themes.ts";

// Same value as `clientApiKeyHeader` in packages/shared/src/client-api-key.ts.
const clientApiKeyHeader = "x-26-client-key";

const localAuthPrefixes = ["/api/auth", "/api/admin", "/api/dev", "/api/stage"];
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const devVarsPath = fileURLToPath(new URL("../api/.dev.vars", import.meta.url));

function readEnvValue(filePath: string, name: string): string {
  if (!existsSync(filePath)) {
    return "";
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return "";
}

function readDevVar(name: string): string {
  return readEnvValue(devVarsPath, name);
}

function resolveClientApiKeyForBuild(): string {
  const fromProcess = process.env.VITE_CLIENT_API_KEY?.trim();
  if (fromProcess) {
    return fromProcess;
  }
  const target = process.env.CLOUDFLARE_ENV?.trim();
  if (target === "staging" || target === "production") {
    return readEnvValue(path.join(repoRoot, `.env.${target}`), "VITE_CLIENT_API_KEY");
  }
  return (
    readEnvValue(path.join(repoRoot, ".env.local"), "VITE_CLIENT_API_KEY") ||
    readDevVar("CLIENT_API_KEY")
  );
}

/** The short commit id, with "+" when the tree has uncommitted changes. */
function resolveBuildId(): string {
  try {
    const commit = execSync("git rev-parse --short HEAD", { cwd: repoRoot })
      .toString()
      .trim();
    const dirty =
      execSync("git status --porcelain", { cwd: repoRoot }).toString().trim().length >
      0;
    return dirty ? `${commit}+` : commit;
  } catch {
    return "unknown";
  }
}

// PGlite's initdb cannot run inside the Worker runtime. Local dev and preview
// answer administrator routes from this Node process, which can open the
// development database. The Worker still owns every other route.
function localAuthInNode(): Plugin {
  const apiEntry = fileURLToPath(new URL("../api/src/index.ts", import.meta.url));
  return {
    name: "local-auth-in-node",
    configureServer(server) {
      attachLocalAuth(server, apiEntry);
      warmLocalAuth(server, apiEntry);
    },
    configurePreviewServer(server) {
      attachLocalAuth(server, apiEntry);
      warmLocalAuth(server, apiEntry);
    },
  };
}

/**
 * The first administrator request loads the API, starts PGlite and runs the
 * auth migrations. That can take longer than the browser waits, so a page
 * opened straight after `npm run dev` said sign-in was unreachable. Do that
 * work as soon as the server listens instead.
 */
function warmLocalAuth(server: ViteDevServer | PreviewServer, apiEntry: string) {
  server.httpServer?.once("listening", () => {
    const began = Date.now();
    void loadLocalApp(apiEntry)
      .then((app) =>
        app.fetch(
          new Request("http://localhost/api/admin/session", {
            headers: clientApiHeadersForNode(),
          }),
          localAuthEnv(),
        ),
      )
      .then(() => {
        console.info(`Local sign-in ready in ${Date.now() - began}ms.`);
      })
      .catch((error: unknown) => {
        // The first real request retries the same work and reports any failure.
        localApp = undefined;
        console.error(
          "Local sign-in warm-up failed.",
          error instanceof Error ? `${error.name}: ${error.message}` : "Error",
        );
      });
  });
}

function clientApiHeadersForNode(): Record<string, string> {
  const key = readDevVar("CLIENT_API_KEY");
  return key ? { [clientApiKeyHeader]: key } : {};
}

type LocalApp = { fetch: (request: Request, env: unknown) => Promise<Response> };

let localApp: Promise<LocalApp> | undefined;

function loadLocalApp(apiEntry: string): Promise<LocalApp> {
  localApp ??= (async () => {
    const loader = await createServer({
      configFile: false,
      appType: "custom",
      server: { middlewareMode: true },
      resolve: {
        alias: {
          // The Node auth loader never constructs a room. Workerd supplies the real class.
          "cloudflare:workers": fileURLToPath(
            new URL("../api/test/cloudflare-workers-stub.ts", import.meta.url),
          ),
        },
      },
      ssr: { noExternal: ["@26/shared"] },
    });
    const loaded = (await loader.ssrLoadModule(apiEntry)) as { app: LocalApp };
    return loaded.app;
  })();
  return localApp;
}

function attachLocalAuth(server: ViteDevServer | PreviewServer, apiEntry: string) {
  server.middlewares.use(async (req, res, next) => {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const handled =
      !path.startsWith("/api/admin/rooms") &&
      path !== "/api/admin/content" &&
      !path.startsWith("/api/admin/content/") &&
      localAuthPrefixes.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      );
    if (!handled) {
      next();
      return;
    }
    try {
      const app = await loadLocalApp(apiEntry);
      const response = await app.fetch(await nodeToWebRequest(req), localAuthEnv());
      await writeNodeResponse(res, response);
    } catch (error) {
      console.error(
        "Local auth middleware failed.",
        error instanceof Error ? `${error.name}: ${error.message}` : "Error",
      );
      if (!res.headersSent) {
        res.statusCode = 503;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error: "misconfigured",
            message: "Authentication is not configured for this environment.",
          }),
        );
      }
    }
  });
}

function localAuthEnv() {
  const unavailable = () => {
    throw new Error("Local auth middleware does not serve assets.");
  };
  return {
    APP_ENV: "local",
    ADMIN_EMAIL: readDevVar("ADMIN_EMAIL") || "humzab1711@hotmail.com",
    BETTER_AUTH_SECRET: "",
    BETTER_AUTH_URL: "",
    DATABASE_URL: "",
    // Explicit ephemeral auth database for isolated local browser checks.
    LOCAL_DATABASE_ID: process.env.LOCAL_DATABASE_ID,
    RESEND_API_KEY: "",
    RESEND_FROM: "",
    CLIENT_API_KEY: readDevVar("CLIENT_API_KEY"),
    ASSETS: { fetch: unavailable, connect: unavailable },
  };
}

async function nodeToWebRequest(req: Connect.IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost:4173";
  const url = new URL(req.url ?? "/", `http://${host}`);
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : Buffer.from(await readRawBody(req));
  return new Request(url, { method, headers, body });
}

function readRawBody(req: Connect.IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => {
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    req.on("error", reject);
  });
}

async function writeNodeResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  const cookies = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });
  if (cookies.length > 0) {
    res.setHeader("set-cookie", cookies);
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

function partyThemes(): Plugin {
  return {
    name: "party-themes",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const { style, themeColor } = themeDocumentHead();
        const themeColorTag = `<meta name="theme-color" content="${themeColor}" />`;
        let next = html;
        if (/<meta\s+name="theme-color"/i.test(next)) {
          next = next.replace(
            /<meta\s+name="theme-color"\s+content="[^"]*"\s*\/?>/i,
            themeColorTag,
          );
        }
        if (next.includes('id="party-themes"')) {
          return next;
        }
        const tags = [
          /<meta\s+name="theme-color"/i.test(next) ? "" : themeColorTag,
          `<style id="party-themes">\n${style}\n    </style>`,
        ]
          .filter((tag) => tag.length > 0)
          .join("\n    ");
        const withTheme = next.replace(/<html\b([^>]*)>/, (_match, attrs: string) => {
          if (/\bdata-theme=/.test(attrs)) {
            return `<html${attrs}>`;
          }
          return `<html${attrs} data-theme="${DEFAULT_THEME_ID}">`;
        });
        return withTheme.replace("</head>", `    ${tags}\n  </head>`);
      },
    },
  };
}

export default defineConfig({
  envDir: repoRoot,
  define: {
    "import.meta.env.VITE_CLIENT_API_KEY": JSON.stringify(
      resolveClientApiKeyForBuild(),
    ),
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(resolveBuildId()),
  },
  plugins: [
    partyThemes(),
    localAuthInNode(),
    react(),
    tailwindcss(),
    cloudflare({ configPath: "../api/wrangler.jsonc" }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
