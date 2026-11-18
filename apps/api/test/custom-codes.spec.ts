import { env, evictDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";

it("reserves a normalised custom code, replays it after eviction and refuses collisions", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const input = {
    requestId: crypto.randomUUID(),
    digest: "custom-code",
    now: new Date().toISOString(),
    joinCode: " humza1 ",
  };
  const first = await registry.createLobby(input);
  expect(first).toMatchObject({ ok: true, result: { joinCode: "HUMZA1" } });
  await evictDurableObject(registry);
  expect(await registry.createLobby(input)).toEqual(first);
  expect(await registry.resolve("humza1")).toEqual(
    first.ok ? { gameId: first.result.gameId } : null,
  );
  expect(
    await registry.createLobby({ ...input, requestId: crypto.randomUUID() }),
  ).toMatchObject({ ok: false, error: "invalid" });
  expect(await registry.createLobby({ ...input, joinCode: "HUMZA2" })).toMatchObject({
    ok: false,
    error: "digest_mismatch",
  });
});
it("rejects malformed codes before reserving a room", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  for (const joinCode of ["ABC", "TOO-LONG", "AB CDE", "<CODE>"])
    expect(
      await registry.createLobby({
        requestId: crypto.randomUUID(),
        digest: "invalid",
        now: new Date().toISOString(),
        joinCode,
      }),
    ).toMatchObject({ ok: false, error: "invalid" });
});
