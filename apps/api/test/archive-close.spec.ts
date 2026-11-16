import { expect, it, vi } from "vitest";
import { postgresArchive } from "../src/archive/store";
import type { AppDatabase } from "../src/auth/create-database";

it("a writer opened for one archive attempt can release its connection", async () => {
  const close = vi.fn(async () => {});
  const database = {
    kind: "neon",
    label: "test",
    executor: { query: vi.fn(async () => [{ version: 1 }]), transaction: vi.fn() },
    auth: {} as AppDatabase["auth"],
    close,
  } as unknown as AppDatabase;
  const writer = postgresArchive(database);
  await writer.close?.();
  expect(close).toHaveBeenCalledOnce();
});
