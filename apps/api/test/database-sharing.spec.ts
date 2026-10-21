import { afterEach, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../src/auth/create-database.ts";

const opened: AppDatabase[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((database) => database.close()));
});

it("gives every caller its own Neon pool, so no request reuses another's I/O", async () => {
  // Constructing a pool does not connect, so no network is needed.
  const env = {
    APP_ENV: "staging",
    DATABASE_URL: "postgres://user:pass@db.example.invalid/app",
  } as const;
  const first = await openDatabase(env);
  const second = await openDatabase(env);
  opened.push(first, second);
  expect(first.kind).toBe("neon");
  expect(second).not.toBe(first);
});

it("keeps one local PGlite database for every request", async () => {
  const env = { APP_ENV: "local", LOCAL_DATABASE_ID: "sharing-test" } as const;
  const first = await openDatabase(env);
  const second = await openDatabase(env);
  expect(first.kind).toBe("pglite");
  expect(second).toBe(first);
  opened.push(first);
});
