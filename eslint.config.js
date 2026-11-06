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
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
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
            },
          ],
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
    files: ["apps/api/src/**/*.ts", "packages/shared/src/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", processEnvRestriction],
    },
  },
  eslintConfigPrettier,
);
