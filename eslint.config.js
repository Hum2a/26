import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const processEnvRestriction = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message: "Read Worker bindings from the request environment, not process.env.",
};

const injectedNowRestriction = {
  selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
  message:
    "Inject now: number into shared logic. Date.now() belongs at the Durable Object edge, not in reducers.",
};

const webAuthImportRestriction = {
  group: [
    "**/apps/api/**",
    "**/create-auth",
    "**/create-auth.ts",
    "better-auth/plugins",
    "better-auth/db",
    "better-auth/db/*",
    "better-auth/adapters",
    "better-auth/adapters/*",
    "better-auth/api",
  ],
  message: "The web app cannot import server auth code.",
};

const heavyClientModules = {
  paths: [
    {
      name: "three",
      message:
        "Import three only from apps/web/src/kart. Lazy-load KartCanvas from guest and stage play.",
    },
    {
      name: "three/webgpu",
      message: "Three.js stays inside the kart canvas bundle.",
    },
    {
      name: "stockfish",
      message:
        "Do not import the stockfish npm package. Use apps/web/src/chess/stockfish-worker.ts and /chess-engine/.",
    },
  ],
  patterns: [webAuthImportRestriction],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.wrangler/**",
      "**/.mf/**",
      "**/.vite/**",
      "**/.data/**",
      ".codex/**",
      "artifacts/**",
      "apps/web/public/kart-engine/**",
      "coverage/**",
      "blob-report/**",
      "playwright-report/**",
      "test-results/**",
      "apps/api/worker-configuration.d.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      globals: { ...globals.browser },
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-restricted-imports": ["error", heavyClientModules],
    },
  },
  {
    files: ["apps/web/src/kart/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: heavyClientModules.paths.filter((item) =>
            item.name.startsWith("stockfish"),
          ),
          patterns: [webAuthImportRestriction],
        },
      ],
    },
  },
  {
    files: ["apps/api/**/*.ts", "packages/shared/**/*.ts"],
    languageOptions: {
      globals: { ...globals.worker },
    },
  },
  {
    files: ["apps/api/src/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", processEnvRestriction],
    },
  },
  {
    files: ["packages/shared/src/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", processEnvRestriction, injectedNowRestriction],
    },
  },
  eslintConfigPrettier,
);
