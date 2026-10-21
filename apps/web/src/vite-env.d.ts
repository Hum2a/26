/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_API_KEY?: string;
  /** Short commit id baked in at build time, so a report can be tied to a deploy. */
  readonly VITE_BUILD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
