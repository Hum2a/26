import { writeRoundState } from "../src/questions/round-state.ts";
import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it, vi } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { createGameStore } from "../src/questions/multiple-choice.ts";
import { onAlarm, pause, resume, publicClock } from "../src/room/lifecycle.ts";
import {
  acceptKartInput,
  readKart,
  KartInputBuffer,
  recoverKart,
  useKartItem,
  releaseKartInputs,
  changeKartEffects,
  changeKartLook,
  changeKartSetting,
  readRoomKartSettings,
  changeKartHandling,
  readRoomKartHandling,
} from "../src/questions/kart/kart.ts";
import { questionFor } from "../src/questions/registry.ts";
import { kartNeutral, createDrivingBody, reduceKart } from "@26/shared";

it("keeps accepted recap private while racing, then persists a receipted host end across eviction", async () => {
  const { stub, players, now, credential } = await setup();
  const host = await stub.snapshotFor("control");
  expect(host.kartRecap?.reason).toBe("racing");
  for (const audience of ["stage", "guest"] as const) {
    const snapshot = await stub.snapshotFor(
      audience,
      audience === "guest" ? players[0] : undefined,
    );
    expect(snapshot.kartRecap).toBeUndefined();
    const presentation = snapshot.play?.kart?.presentation;
    expect(
      presentation?.version === 1 ? presentation.recap : undefined,
    ).toBeUndefined();
  }
  const command = { ...credential, requestId: crypto.randomUUID(), nowMs: now + 1000 };
  const refused = await stub.advanceRound({
    ...command,
    secret: "wrong-credential",
    requestId: crypto.randomUUID(),
  });
  expect(refused.ok).toBe(false);
  const first = await stub.advanceRound(command);
  expect(first.ok).toBe(true);
  await evictDurableObject(stub);
  expect(await stub.advanceRound(command)).toEqual(first);
  const ended = await stub.snapshotFor("control");
  expect(ended.kartRecap?.reason).toBe("host-ended");
  for (const audience of ["stage", "guest"] as const) {
    const snapshot = await stub.snapshotFor(
      audience,
      audience === "guest" ? players[0] : undefined,
    );
    expect(snapshot.kartRecap).toBeUndefined();
    const presentation = snapshot.play?.kart?.presentation;
    expect(presentation?.version === 1 ? presentation.recap?.reason : undefined).toBe(
      "host-ended",
    );
    expect(JSON.stringify(presentation)).not.toMatch(
      /input|credential|secret|email|face|crossingsMs/,
    );
  }
});

for (const action of ["kart-course-on", "kart-course-off"] as const)
  it(`${action}: persists a change once, replays its receipt and refuses outside a kart round`, async () => {
    const { stub, now, credential } = await setup();
    if (action === "kart-course-off")
      await runInDurableObject(stub, (_instance, state) => {
        const q = questionFor(createSqlStore(state.storage.sql).readRoom());
        if (q?.kind !== "kart") throw new Error("Kart required");
        const race = readKart(state.storage.sql, q.id)!;
        const driver = race.drivers[0]!;
        driver.physics = {
          ...createDrivingBody(driver.x, driver.z, driver.heading),
          height: 4,
          verticalSpeed: 2,
        };
        writeRoundState(state.storage.sql, q.id, "kart-race", race);
      });
    const command = {
      ...credential,
      action,
      requestId: crypto.randomUUID(),
      nowMs: now + 10,
    };
    const versionBefore = (await stub.snapshotFor("control")).stateVersion;
    const first = await stub.hostAction(command);
    expect(first.ok).toBe(true);
    expect((await stub.snapshotFor("control")).stateVersion).toBeGreaterThan(
      versionBefore,
    );
    await evictDurableObject(stub);
    expect(await stub.hostAction(command)).toEqual(first);
    for (const audience of ["control", "stage"] as const) {
      const snapshot = await stub.snapshotFor(audience);
      expect(snapshot.play?.kart?.courseEnabled).toBe(action === "kart-course-on");
      if (audience === "control")
        expect(snapshot.kartCourseHistory).toEqual([
          { atMs: now + 10, enabled: action === "kart-course-on" },
        ]);
      else expect(snapshot.kartCourseHistory).toBeUndefined();
      expect(snapshot.play?.kart?.participants[0]).not.toHaveProperty("physics");
      if (action === "kart-course-off")
        expect(snapshot.play?.kart?.participants[0]?.height).toBe(0);
    }
    expect(
      (
        await stub.snapshotFor(
          "guest",
          (await stub.snapshotFor("control")).players[0]!.playerId,
        )
      ).kartCourseHistory,
    ).toBeUndefined();
    await stub.advanceRound({
      ...credential,
      requestId: crypto.randomUUID(),
      nowMs: now + 20,
    });
    const refused = await stub.hostAction({
      ...command,
      requestId: crypto.randomUUID(),
      nowMs: now + 30,
    });
    expect(refused.ok).toBe(false);
  });

for (const mode of ["map", "overview", "follow", "director"] as const)
  it(`kart stage ${mode}: persists, replays once, keeps history private and refuses after the round`, async () => {
    const { stub, now, credential, players } = await setup();
    const versionBefore = (await stub.snapshotFor("control")).stateVersion;
    const command = {
      ...credential,
      action: `kart-stage-${mode}`,
      requestId: crypto.randomUUID(),
      nowMs: now + 10,
    };
    const first = await stub.hostAction(command);
    expect(first.ok).toBe(true);
    await evictDurableObject(stub);
    expect(await stub.hostAction(command)).toEqual(first);
    const host = await stub.snapshotFor("control");
    expect(host.kartStageHistory).toEqual([{ atMs: now + 10, mode }]);
    expect(host.stateVersion).toBeGreaterThan(versionBefore);
    expect(host.play!.kart!.spectator?.mode).toBe(mode);
    expect(host.play!.kart!.spectator?.revision).toBe(1);
    for (const audience of ["guest", "stage"] as const) {
      const view = await stub.snapshotFor(
        audience,
        audience === "guest" ? players[0] : undefined,
      );
      expect(view.kartStageHistory).toBeUndefined();
      expect(JSON.stringify(view.play!.kart!.spectator)).not.toMatch(
        /secret|credential|history|input/,
      );
    }
    for (let i = 0; i < 3; i++)
      await stub.advanceRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 20 + i,
      });
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 30,
        })
      ).ok,
    ).toBe(false);
  });

for (const action of ["kart-opponents-on", "kart-opponents-off"] as const)
  it(`${action}: commits once, survives eviction, hides history and refuses outside a race`, async () => {
    const { stub, now, credential } = await setup();
    const versionBefore = (await stub.snapshotFor("control")).stateVersion;
    const command = {
      ...credential,
      action,
      requestId: crypto.randomUUID(),
      nowMs: now + 10,
    };
    const first = await stub.hostAction(command);
    expect(first.ok).toBe(true);
    await evictDurableObject(stub);
    expect(await stub.hostAction(command)).toEqual(first);
    const host = await stub.snapshotFor("control");
    expect(host.kartOpponentHistory).toEqual([
      { atMs: now + 10, enabled: action === "kart-opponents-on" },
    ]);
    expect(host.stateVersion).toBeGreaterThan(versionBefore);
    const phone = await stub.snapshotFor("guest", host.players[0]!.playerId);
    expect(phone.kartOpponentHistory).toBeUndefined();
    expect((await stub.snapshotFor("stage")).kartOpponentHistory).toBeUndefined();
    expect(phone.play?.kart?.participants).toHaveLength(1);
    expect(phone.play?.kart?.nearby?.length ?? 0).toBe(
      action === "kart-opponents-on" ? 1 : 0,
    );
    expect(JSON.stringify(phone.play?.kart?.nearby ?? [])).not.toMatch(
      /input|sequence|power|secret|credential/,
    );
    await stub.advanceRound({
      ...credential,
      requestId: crypto.randomUUID(),
      nowMs: now + 20,
    });
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 30,
        })
      ).ok,
    ).toBe(false);
  });

for (const action of ["kart-effects-on", "kart-effects-off"] as const)
  it(`${action}: commits once, survives eviction, hides history and refuses outside a race`, async () => {
    const { stub, now, credential } = await setup();
    const versionBefore = (await stub.snapshotFor("control")).stateVersion;
    const command = {
      ...credential,
      action,
      requestId: crypto.randomUUID(),
      nowMs: now + 10,
    };
    const first = await stub.hostAction(command);
    expect(first.ok).toBe(true);
    await evictDurableObject(stub);
    expect(await stub.hostAction(command)).toEqual(first);
    const host = await stub.snapshotFor("control");
    expect(host.kartEffectsHistory).toEqual([
      { atMs: now + 10, enabled: action === "kart-effects-on" },
    ]);
    expect(host.stateVersion).toBeGreaterThan(versionBefore);
    const phone = await stub.snapshotFor("guest", host.players[0]!.playerId);
    expect(phone.kartEffectsHistory).toBeUndefined();
    expect((await stub.snapshotFor("stage")).kartEffectsHistory).toBeUndefined();
    expect(phone.play?.kart?.effectsEnabled).toBe(action === "kart-effects-on");
    expect((await stub.snapshotFor("stage")).play?.kart?.effectsEnabled).toBe(
      action === "kart-effects-on",
    );
    await stub.advanceRound({
      ...credential,
      requestId: crypto.randomUUID(),
      nowMs: now + 20,
    });
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 30,
        })
      ).ok,
    ).toBe(action === "kart-effects-off");
    await runInDurableObject(stub, (_instance, state) => {
      const store = createSqlStore(state.storage.sql);
      store.writeRoom({ ...store.readRoom(), phase: "lobby" });
    });
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 40,
        })
      ).ok,
    ).toBe(false);
  });

it("bounds private effects history, validates again in the domain and refuses unauthorised commands", async () => {
  const { stub, now, credential } = await setup();
  expect(
    (
      await stub.hostAction({
        credentialId: "",
        secret: "",
        action: "kart-effects-on",
        requestId: crypto.randomUUID(),
        nowMs: now + 1,
      })
    ).ok,
  ).toBe(false);
  for (let i = 0; i < 22; i++)
    expect(
      (
        await stub.hostAction({
          ...credential,
          action: i % 2 ? "kart-effects-on" : "kart-effects-off",
          requestId: crypto.randomUUID(),
          nowMs: now + 10 + i,
        })
      ).ok,
    ).toBe(true);
  const host = await stub.snapshotFor("control");
  expect(host.kartEffectsHistory).toHaveLength(20);
  expect(host.kartEffectsHistory![0]!.atMs).toBe(now + 12);
  await runInDurableObject(stub, (_instance, state) => {
    expect(() =>
      changeKartEffects(state.storage.sql, "true" as unknown as boolean, now),
    ).toThrow("valid effects setting");
    expect(() => changeKartEffects(state.storage.sql, true, NaN)).toThrow(
      "valid effects setting",
    );
  });
  expect((await stub.snapshotFor("control")).kartEffectsHistory).toEqual(
    host.kartEffectsHistory,
  );
});

for (const lookPreset of ["race", "off"] as const)
  it(`kart look ${lookPreset}: commits once, survives eviction and keeps change history private`, async () => {
    const { stub, now, credential, players } = await setup();
    const before = await stub.snapshotFor("control");
    expect(before.play?.kart?.look).toBeUndefined();
    const command = {
      ...credential,
      action: "kart-look",
      lookPreset,
      requestId: crypto.randomUUID(),
      nowMs: now + 10,
    };
    expect((await stub.hostAction({ ...command, secret: "wrong" })).ok).toBe(false);
    const first = await stub.hostAction(command);
    expect(first.ok).toBe(true);
    await evictDurableObject(stub);
    expect(await stub.hostAction(command)).toEqual(first);
    expect(
      (
        await stub.hostAction({
          ...command,
          lookPreset: lookPreset === "off" ? "race" : "off",
        })
      ).ok,
    ).toBe(false);
    const host = await stub.snapshotFor("control");
    expect(host.stateVersion).toBeGreaterThan(before.stateVersion);
    expect(host.kartLookHistory).toEqual([{ atMs: now + 10, preset: lookPreset }]);
    for (const audience of ["control", "guest", "stage"] as const) {
      const snapshot = await stub.snapshotFor(
        audience,
        audience === "guest" ? players[0] : undefined,
      );
      expect(snapshot.play?.kart?.look).toBe(lookPreset);
      expect(snapshot.play?.kart).not.toHaveProperty("lookHistory");
      if (audience !== "control") {
        expect(snapshot.kartLookHistory).toBeUndefined();
        expect(JSON.stringify(snapshot)).not.toContain("kartLookHistory");
      }
    }
    await stub.advanceRound({
      ...credential,
      requestId: crypto.randomUUID(),
      nowMs: now + 20,
    });
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 30,
        })
      ).ok,
    ).toBe(lookPreset === "off");
    await runInDurableObject(stub, (_instance, state) => {
      const store = createSqlStore(state.storage.sql);
      store.writeRoom({ ...store.readRoom(), phase: "lobby" });
    });
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 40,
        })
      ).ok,
    ).toBe(false);
  });

it("bounds look history and rejects invalid presets again inside the room and domain", async () => {
  const { stub, now, credential } = await setup();
  for (let i = 0; i < 22; i++)
    expect(
      (
        await stub.hostAction({
          ...credential,
          action: "kart-look",
          lookPreset: i % 2 ? "daylight" : "off",
          requestId: crypto.randomUUID(),
          nowMs: now + 10 + i,
        })
      ).ok,
    ).toBe(true);
  const host = await stub.snapshotFor("control");
  expect(host.kartLookHistory).toHaveLength(20);
  expect(host.kartLookHistory![0]).toEqual({ atMs: now + 12, preset: "off" });
  for (const lookPreset of [undefined, null, {}, "neutral", "private-unbounded-json"])
    expect(
      (
        await stub.hostAction({
          ...credential,
          action: "kart-look",
          lookPreset,
          requestId: crypto.randomUUID(),
          nowMs: now + 40,
        })
      ).ok,
    ).toBe(false);
  await runInDurableObject(stub, (_instance, state) => {
    for (const preset of [undefined, null, {}, "neutral"])
      expect(() => changeKartLook(state.storage.sql, preset, now)).toThrow(
        "valid kart look",
      );
    for (const at of [-1, 1.5, NaN, Infinity])
      expect(() => changeKartLook(state.storage.sql, "off", at)).toThrow(
        "valid kart look",
      );
  });
  expect((await stub.snapshotFor("control")).kartLookHistory).toEqual(
    host.kartLookHistory,
  );
});

it("keeps look safety-off available for an ended race through prompt, reveal and scores", async () => {
  const { stub, now, credential } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const store = createSqlStore(state.storage.sql);
    const q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const race = readKart(state.storage.sql, q.id)!;
    race.ended = true;
    race.look = "race";
    writeRoundState(state.storage.sql, q.id, "kart-race", race);
  });
  for (const [index, phase] of (["prompt", "reveal", "scores"] as const).entries()) {
    await runInDurableObject(stub, (_instance, state) => {
      const store = createSqlStore(state.storage.sql);
      store.writeRoom({ ...store.readRoom(), phase });
    });
    const command = {
      ...credential,
      action: "kart-look",
      lookPreset: "off",
      requestId: crypto.randomUUID(),
      nowMs: now + 10 + index,
    };
    const off = await stub.hostAction(command);
    expect(off.ok).toBe(true);
    expect(await stub.hostAction(command)).toEqual(off);
    expect((await stub.snapshotFor("stage")).play?.kart?.look).toBe("off");
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          lookPreset: "race",
        })
      ).ok,
    ).toBe(false);
  }
});

it("kart-setting: commits once, survives eviction, reaches phones and stage, keeps history private", async () => {
  const { stub, now, credential } = await setup();
  const versionBefore = (await stub.snapshotFor("control")).stateVersion;
  const command = {
    ...credential,
    action: "kart-setting",
    kartSetting: { key: "prediction", value: "off" },
    requestId: crypto.randomUUID(),
    nowMs: now + 10,
  };
  const first = await stub.hostAction(command);
  expect(first.ok).toBe(true);
  await evictDurableObject(stub);
  expect(await stub.hostAction(command)).toEqual(first);
  const host = await stub.snapshotFor("control");
  expect(host.stateVersion).toBeGreaterThan(versionBefore);
  expect(host.kartSettings).toEqual({ prediction: "off" });
  expect(host.kartSettingsHistory).toEqual([
    { atMs: now + 10, key: "prediction", value: "off" },
  ]);
  const phone = await stub.snapshotFor("guest", host.players[0]!.playerId);
  const stage = await stub.snapshotFor("stage");
  for (const view of [phone, stage]) {
    expect(view.play?.kart?.settings).toEqual({ prediction: "off" });
    expect(view.kartSettingsHistory).toBeUndefined();
    expect(view.kartSettings).toBeUndefined();
  }
  // A second key keeps the first and adds to the history.
  expect(
    (
      await stub.hostAction({
        ...command,
        kartSetting: { key: "glide", value: "off" },
        requestId: crypto.randomUUID(),
        nowMs: now + 20,
      })
    ).ok,
  ).toBe(true);
  expect((await stub.snapshotFor("stage")).play?.kart?.settings).toEqual({
    prediction: "off",
    glide: "off",
  });
  // Invalid values are refused by the room itself.
  for (const kartSetting of [
    { key: "prediction", value: "sometimes" },
    { key: "speed", value: "fast" },
    "prediction=off",
  ])
    expect(
      (
        await stub.hostAction({
          ...command,
          kartSetting,
          requestId: crypto.randomUUID(),
          nowMs: now + 30,
        })
      ).ok,
    ).toBe(false);
});

it("kart-setting outside a race becomes the room default and stays bounded", async () => {
  const { stub, now } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const store = createSqlStore(sql);
    store.writeRoom({ ...store.readRoom(), phase: "lobby" });
    changeKartSetting(sql, { key: "frameCap", value: "30" }, now);
    expect(readRoomKartSettings(sql).settings).toEqual({ frameCap: "30" });
    for (let i = 0; i < 25; i++)
      changeKartSetting(
        sql,
        { key: "steering", value: i % 2 ? "slider" : "pad-strip" },
        now + i + 1,
      );
    expect(readRoomKartSettings(sql).history).toHaveLength(20);
    expect(() =>
      changeKartSetting(sql, { key: "frameCap", value: "120" }, now),
    ).toThrow("valid kart setting");
    expect(() => changeKartSetting(sql, { key: "glide", value: "on" }, -1)).toThrow();
  });
});

it("a failing alarm re-arms instead of leaving the room stuck", async () => {
  const { stub } = await setup();
  await runInDurableObject(stub, async (instance, state) => {
    const room = instance as unknown as {
      runDueJobs: () => Promise<void>;
      alarm: () => Promise<void>;
    };
    const original = room.runDueJobs.bind(instance);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    room.runDueJobs = async () => {
      throw new Error("transient failure");
    };
    await state.storage.deleteAlarm();
    const before = Date.now();
    await room.alarm();
    const next = await state.storage.getAlarm();
    expect(next).not.toBeNull();
    expect(next!).toBeGreaterThanOrEqual(before + 1_000);
    expect(next!).toBeLessThanOrEqual(Date.now() + 3_000);
    expect(String(errors.mock.calls[0]?.[0])).toContain('"area":"alarm"');
    errors.mockRestore();
    room.runDueJobs = original;
  });
});

async function setup(names = ["Amina", "Bilal"], collect = true) {
  // Keep automatic wall-clock alarms in the future; tests explicitly drive the injected clock.
  const now = Date.now() + 60_000,
    created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
      requestId: crypto.randomUUID(),
      digest: await payloadDigest({ action: "create" }),
      now: new Date(now).toISOString(),
    });
  if (!created.ok) throw new Error(created.message);
  const room = created.result,
    stub = env.PARTY_ROOM.getByName(room.gameId);
  const players = [];
  for (const nickname of names) {
    const p = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    if (!p.ok) throw new Error(p.message);
    players.push(p.playerId);
  }
  const credential = {
    credentialId: room.control.credentialId,
    secret: room.control.secret,
  };
  expect(
    (
      await stub.startKartRehearsal({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now,
      })
    ).ok,
  ).toBe(true);
  // Actual first quiz -> actual second kart intro, using the same authoritative phase graph.
  for (let n = 1; n <= 5; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  expect((await stub.snapshotFor("stage")).play?.question.kind).toBe("kart");
  for (let n = 6; collect && n <= 7; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  return { stub, players, now: now + (collect ? 7 : 5), credential };
}

it("freezes receipted handling before racing, survives eviction, replays once and keeps private history off phones and stage", async () => {
  const { stub, players, credential, now } = await setup(undefined, false);
  const command = {
    ...credential,
    action: "kart-handling",
    handlingPreset: "bounce-v1",
    requestId: crypto.randomUUID(),
    nowMs: now + 1,
  };
  const first = await stub.hostAction(command);
  expect(first.ok).toBe(true);
  await evictDurableObject(stub);
  expect(await stub.hostAction(command)).toEqual(first);
  const host = await stub.snapshotFor("control");
  expect(host.kartHandling).toEqual({
    next: "bounce-v1",
    current: "bounce-v1",
    frozen: false,
  });
  expect(host.kartHandlingHistory).toEqual([{ atMs: now + 1, preset: "bounce-v1" }]);
  for (let n = 2; n <= 3; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  expect((await stub.snapshotFor("control")).kartHandling?.frozen).toBe(true);
  expect(await stub.hostAction(command)).toEqual(first);
  for (const paused of [false, true]) {
    if (paused)
      expect(
        (
          await stub.pauseRound({
            ...credential,
            requestId: crypto.randomUUID(),
            nowMs: now + 4,
          })
        ).ok,
      ).toBe(true);
    const refused = await stub.hostAction({
      ...command,
      handlingPreset: "slide-v1",
      requestId: crypto.randomUUID(),
      nowMs: now + 5,
    });
    expect(refused.ok).toBe(false);
    expect((await stub.snapshotFor("control")).kartHandling).toEqual({
      next: "bounce-v1",
      current: "bounce-v1",
      frozen: true,
    });
    expect((await stub.snapshotFor("control")).kartHandlingHistory).toHaveLength(1);
  }
  for (const audience of ["stage", "guest"] as const) {
    const view = await stub.snapshotFor(
      audience,
      audience === "guest" ? players[0] : undefined,
    );
    expect(view.kartHandling).toBeUndefined();
    expect(view.kartHandlingHistory).toBeUndefined();
    if (audience === "guest") {
      const metadata = view.play!.kart!.presentation;
      expect(metadata?.version === 2 && metadata.handling).toEqual({
        preset: "bounce-v1",
        stunMs: 0,
        cooldownMs: 0,
      });
    } else expect(view.play!.kart!.presentation).toBeUndefined();
  }
  expect(
    (
      await stub.hostAction({
        ...command,
        secret: "wrong",
        requestId: crypto.randomUUID(),
      })
    ).ok,
  ).toBe(false);
  expect(
    (
      await stub.resumeRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 6,
      })
    ).ok,
  ).toBe(true);
  expect(
    (
      await stub.advanceRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 7,
      })
    ).ok,
  ).toBe(true);
  const next = await stub.hostAction({
    ...command,
    handlingPreset: "slide-v1",
    requestId: crypto.randomUUID(),
    nowMs: now + 8,
  });
  expect(next.ok).toBe(true);
  expect((await stub.snapshotFor("control")).kartHandling).toEqual({
    next: "slide-v1",
    current: "bounce-v1",
    frozen: true,
  });
});

it("validates and bounds handling again in the room/domain, with receipt payload conflicts and default retention", async () => {
  const { stub, credential, now } = await setup(undefined, false);
  const command = {
    ...credential,
    action: "kart-handling",
    handlingPreset: "bounce-v1",
    requestId: crypto.randomUUID(),
    nowMs: now + 1,
  };
  expect((await stub.hostAction(command)).ok).toBe(true);
  expect((await stub.hostAction({ ...command, handlingPreset: "slide-v1" })).ok).toBe(
    false,
  );
  for (const value of [undefined, null, "unknown", {}, { restitution: 500 }])
    expect(
      (
        await stub.hostAction({
          ...command,
          handlingPreset: value,
          requestId: crypto.randomUUID(),
        })
      ).ok,
    ).toBe(false);
  await runInDurableObject(stub, (_room, state) => {
    const sql = state.storage.sql;
    for (const invalid of [undefined, "invalid", {}, 1])
      expect(() => changeKartHandling(sql, invalid, now)).toThrow();
    expect(() => changeKartHandling(sql, "slide-v1", NaN)).toThrow();
    for (let n = 0; n < 24; n++)
      changeKartHandling(sql, n % 2 ? "bounce-v1" : "slide-v1", now + n + 2);
    expect(readRoomKartHandling(sql).history).toHaveLength(20);
    expect(readRoomKartHandling(sql).preset).toBe("bounce-v1");
    const q = questionFor(createSqlStore(sql).readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const legacy = readKart(sql, q.id)!;
    delete legacy.physicsVersion;
    delete legacy.handling;
    writeRoundState(sql, q.id, "kart-race", legacy);
    expect(() => changeKartHandling(sql, "bounce-v1", now + 30)).toThrow("older grid");
    expect(readKart(sql, q.id)!.handling).toBeUndefined();
    expect(readRoomKartHandling(sql).history).toHaveLength(20);
  });
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("control")).kartHandlingHistory).toHaveLength(20);
});

it("bounds each driver's transient controls without letting invalid or noisy inputs evict a peer", () => {
  const buffer = new KartInputBuffer();
  const input = { raceId: "race", sequence: 1, ...kartNeutral };
  buffer.push("quiet", input, 0);
  buffer.push("noisy", input, 0);
  for (let n = 1; n <= 1000; n++) {
    buffer.push("noisy", { ...input, sequence: n + 1 }, n * 100);
    buffer.push("quiet", { ...input, sequence: n + 1, steer: 9 }, n * 100);
  }
  buffer.push("noisy", input, 100_100);
  const arrivals = buffer.drain();
  expect(arrivals.filter((entry) => entry.playerId === "quiet")).toEqual([
    { playerId: "quiet", raw: input, at: 0 },
  ]);
  expect(arrivals.filter((entry) => entry.playerId === "noisy")).toHaveLength(4);
  expect((arrivals.at(-1)!.raw as typeof input).sequence).toBe(1001);
  expect(buffer.drain()).toEqual([]);
});

it("releases persisted throttle and drift at pause while retaining the reconnect cursor", async () => {
  const { stub, players, now, credential } = await setup();
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const store = createSqlStore(state.storage.sql);
    const q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    expect(
      acceptKartInput(
        state.storage.sql,
        store,
        players[0]!,
        { ...kartNeutral, raceId, sequence: 7, gas: true, drift: true },
        q,
        now,
      ),
    ).toBe(true);
  });
  expect(
    (
      await stub.pauseRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 100,
      })
    ).ok,
  ).toBe(true);
  await evictDurableObject(stub);
  const paused = (await stub.snapshotFor("guest", players[0])).play!.kart!;
  expect(paused.elapsedMs).toBe(100);
  expect(paused.inputCursor).toBe(7);
  expect(
    (
      await stub.resumeRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 10_000,
      })
    ).ok,
  ).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const q = questionFor(createSqlStore(sql).readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    onAlarm(createGameStore(sql), now + 10_100);
    const driver = readKart(sql, q.id)!.drivers[0]!;
    expect(driver.input).toEqual(kartNeutral);
    expect(driver.wasDrifting).toBe(false);
    expect(driver.boostMs).toBe(0);
    expect(driver.sequence).toBe(7);
    expect(
      acceptKartInput(
        sql,
        createSqlStore(sql),
        players[0]!,
        { ...kartNeutral, raceId, sequence: 8, gas: true },
        q,
        now + 10_100,
      ),
    ).toBe(true);
  });
});

it("accepts authenticated-driver controls, rejects stale/forged/late inputs and survives eviction", async () => {
  const { stub, players, now } = await setup();
  const raceId = (await stub.snapshotFor("guest", players[0])).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const input = {
      raceId,
      sequence: 1,
      ...kartNeutral,
      gas: true,
      steer: 0.2381,
    };
    expect(acceptKartInput(sql, store, players[0]!, input, q, now)).toBe(true);
    expect(
      acceptKartInput(sql, store, players[0]!, { ...input, sequence: 2 }, q, now + 1),
    ).toBe(false);
    expect(acceptKartInput(sql, store, players[0]!, input, q, now + 100)).toBe(false);
    expect(
      acceptKartInput(sql, store, players[1]!, { ...input, timeMs: 1 }, q, now + 100),
    ).toBe(false);
    expect(acceptKartInput(sql, store, "not-in-race", input, q, now + 100)).toBe(false);
    expect(
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { ...input, sequence: 3, raceId: "old" },
        q,
        now + 100,
      ),
    ).toBe(false);
    onAlarm(createGameStore(sql), now + 200);
    expect(readKart(sql, q.id)!.drivers[0]!.speed).toBeGreaterThan(0);
    const clock = publicClock(store);
    expect(clock.deadlineAt).toBe(now + 45_000);
    pause(store, now + 250);
    onAlarm(createGameStore(sql), now + 5000);
    expect(readKart(sql, q.id)!.elapsedMs).toBe(200);
    expect(
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { ...input, sequence: 4 },
        q,
        now + 5000,
      ),
    ).toBe(false);
  });
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("guest", players[0])).paused).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql);
    resume(store, now + 10_000);
    onAlarm(createGameStore(sql), now + 10_200);
    const q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    expect(readKart(sql, q.id)!.elapsedMs).toBe(450);
    const deadline = publicClock(store).deadlineAt!;
    expect(deadline).toBe(now + 54_750);
    expect(
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { raceId, sequence: 5, ...kartNeutral },
        q,
        deadline,
      ),
    ).toBe(false);
    onAlarm(createGameStore(sql), deadline + 100);
    expect(store.readRoom().phase).toBe("reveal"); // One transition, even when tick and cutoff are both due.
    expect(readKart(sql, q.id)!.drivers.every((d) => d.status === "DNF")).toBe(true);
    expect(
      sql
        .exec<{ n: number }>(
          "SELECT COUNT(*) n FROM score_ledger WHERE question_id = ?",
          q.id,
        )
        .toArray()[0]!.n,
    ).toBe(2);
    onAlarm(createGameStore(sql), deadline + 200);
    expect(
      sql
        .exec<{ n: number }>(
          "SELECT COUNT(*) n FROM score_ledger WHERE question_id = ?",
          q.id,
        )
        .toArray()[0]!.n,
    ).toBe(2);
  });
  const view = (await stub.snapshotFor("stage")).play!;
  expect(view.kart?.ended).toBe(true);
  expect(JSON.stringify(view.kart)).not.toContain("sequence");
});

it("persists lap winners once, ignores client times, and continues to scores and the final podium", async () => {
  const { stub, players, now, credential } = await setup();
  const raceId = (await stub.snapshotFor("guest", players[0])).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    for (
      let elapsed = 0;
      elapsed < 45_000 && store.readRoom().phase === "collect";
      elapsed += 100
    ) {
      acceptKartInput(
        sql,
        store,
        players[0]!,
        {
          raceId,
          sequence: elapsed + 1,
          ...kartNeutral,
          gas: true,
          steer: 0.2381,
        },
        q,
        now + elapsed,
      );
      onAlarm(createGameStore(sql), now + elapsed + 100);
    }
    expect(readKart(sql, q.id)!.drivers[0]!.status).toBe("FINISHED");
    expect(store.readRoom().phase).toBe("reveal");
    const rows = sql
      .exec<{ points: number }>(
        "SELECT points FROM score_ledger WHERE question_id = ? ORDER BY points DESC",
        q.id,
      )
      .toArray();
    expect(rows.map((r) => r.points)).toEqual([100, 0]);
  });
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("guest", players[0])).play?.selfAward).toBe(100);
  for (let n = 0; n < 3; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + 46_000 + n,
        })
      ).ok,
    ).toBe(true);
  expect((await stub.snapshotFor("stage")).phase).toBe("facts");
  expect(
    (
      await stub.finishRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 46_010,
      })
    ).ok,
  ).toBe(true);
  expect((await stub.snapshotFor("stage")).phase).toBe("podium");
});

it("persists full-room control queues before a tick and replays them after eviction without cross-driver leakage", async () => {
  const { stub, players, now } = await setup(
    Array.from({ length: 100 }, (_, i) => `Driver ${i + 1}`),
  );
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    for (let offset = 0; offset <= 100; offset += 100)
      for (const [i, playerId] of players.entries()) {
        expect(
          acceptKartInput(
            sql,
            store,
            playerId,
            {
              raceId,
              sequence: offset / 100 + 1,
              ...kartNeutral,
              gas: i % 2 === 0,
              steer: 0.24,
            },
            q,
            now + offset,
          ),
        ).toBe(true);
      }
    expect(readKart(sql, q.id)!.elapsedMs).toBe(0); // Inputs are queued, not optimistically simulated.
  });
  await evictDurableObject(stub);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    onAlarm(createGameStore(sql), now + 200);
    const saved = readKart(sql, q.id)!;
    expect(saved.drivers).toHaveLength(100);
    expect(saved.elapsedMs).toBe(200);
    for (const [i, driver] of saved.drivers.entries()) {
      expect(driver.sequence).toBe(2);
      expect(driver.speed > 0).toBe(i % 2 === 0);
    }
    // Throttle expires at 500ms; exponential coasting needs time to settle. The
    // karts that throttled on GO also got a start boost, so they coast from higher.
    onAlarm(createGameStore(sql), now + 6000);
    expect(readKart(sql, q.id)!.drivers.every((d) => Math.abs(d.speed) < 0.1)).toBe(
      true,
    );
    expect(readKart(sql, q.id)!.drivers.every((d) => d.inputUntil === 500)).toBe(true);
  });
  const guest = (await stub.snapshotFor("guest", players[99])).play!.kart!;
  expect(guest.participantCount).toBe(100);
  expect(guest.participants).toHaveLength(1);
  expect(guest.participants[0]!.playerId).toBe(players[99]);
  expect(guest.inputCursor).toBe(2);
  expect(guest.leaderboard).toHaveLength(9); // Top eight plus this phone's own place.
  expect(JSON.stringify(guest)).not.toContain("inputUntil");
});

it("persists recovery across eviction and rejects stale races and spectator identities", async () => {
  const { stub, players, now } = await setup();
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    expect(recoverKart(sql, store, q, "spectator", raceId, now).ok).toBe(false);
    expect(recoverKart(sql, store, q, players[0]!, "old", now).ok).toBe(false);
    expect(recoverKart(sql, store, q, players[0]!, raceId, now).ok).toBe(true);
    expect(recoverKart(sql, store, q, players[0]!, raceId, now + 100).ok).toBe(false);
  });
  await evictDurableObject(stub);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      q = questionFor(createSqlStore(sql).readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const driver = readKart(sql, q.id)!.drivers[0]!;
    expect(driver.lastRecoveryAt).toBe(0);
    expect(driver.input).toEqual(kartNeutral);
    expect(driver.progress).toBe(0);
    expect(readKart(sql, q.id)!.contactHistory).toHaveLength(1);
    expect(readKart(sql, q.id)!.contactHistory![0]).toMatchObject({
      kind: "recovery",
      playerId: players[0],
    });
  });
  expect((await stub.snapshotFor("control")).kartContactHistory).toHaveLength(1);
  expect((await stub.snapshotFor("stage")).kartContactHistory).toBeUndefined();
  expect(
    (await stub.snapshotFor("guest", players[0])).kartContactHistory,
  ).toBeUndefined();
});

it("persists short impacts through eviction and keeps exact contact history control-only", async () => {
  const { stub, players } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      q = questionFor(createSqlStore(sql).readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const race = readKart(sql, q.id)!;
    const driver = race.drivers[0]!;
    driver.x = 49;
    driver.z = 0;
    driver.heading = 0;
    driver.physics = { ...createDrivingBody(49, 0, 0), vx: 100 };
    writeRoundState(
      sql,
      q.id,
      "kart-race",
      reduceKart(race, { type: "tick", elapsedMs: 200 }),
    );
  });
  await evictDurableObject(stub);
  const host = await stub.snapshotFor("control");
  expect(host.kartContactHistory).toHaveLength(1);
  expect(host.kartContactHistory![0]).toMatchObject({
    kind: "impact",
    playerId: players[0],
    atMs: 20,
  });
  const stage = await stub.snapshotFor("stage");
  expect(stage.kartContactHistory).toBeUndefined();
  expect(stage.play?.kart?.presentation).toBeUndefined();
  for (const player of players) {
    const phone = await stub.snapshotFor("guest", player);
    expect(phone.kartContactHistory).toBeUndefined();
    const metadata = phone.play?.kart?.presentation;
    expect(metadata?.version).toBe(2);
    if (metadata?.version !== 2) throw new Error("Contact envelope required");
    expect(metadata.contacts).toHaveLength(player === players[0] ? 1 : 0);
    expect(JSON.stringify(metadata)).not.toMatch(
      /physics|history|speed|lastSafe|"x"|"z"/,
    );
  }
});

it("persists spent items and oil through eviction, keeps inventories private and rejects replay", async () => {
  const { stub, players, now } = await setup();
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const race = readKart(sql, q.id)!;
    race.drivers[0]!.power!.item = "oil";
    race.drivers[1]!.power!.item = "shield";
    writeRoundState(sql, q.id, "kart-race", race);
    expect(useKartItem(sql, store, q, "spectator", raceId, now).ok).toBe(false);
    expect(useKartItem(sql, store, q, players[0]!, "old-race", now).ok).toBe(false);
    expect(useKartItem(sql, store, q, players[0]!, raceId, now).ok).toBe(true);
    expect(useKartItem(sql, store, q, players[0]!, raceId, now).ok).toBe(false);
  });
  await evictDurableObject(stub);
  const stage = (await stub.snapshotFor("stage")).play!.kart!;
  expect(stage.powers!.selfItem).toBeNull();
  expect(stage.powers!.oils).toHaveLength(1);
  const other = (await stub.snapshotFor("guest", players[1])).play!.kart!;
  expect(other.powers!.selfItem).toBe("shield");
  expect(other.powers!.effects).toHaveLength(1);
  expect(JSON.stringify(stage)).not.toContain('"item":"shield"');
});

for (const blocked of ["paused", "held"] as const)
  it(
    "drops controls received under a stale ingress hint before leaving " + blocked,
    async () => {
      const { stub, players, now, credential } = await setup();
      await runInDurableObject(stub, async (instance, state) => {
        const pairs = [new WebSocketPair(), new WebSocketPair(), new WebSocketPair()];
        for (const [index, pair] of pairs.entries()) {
          state.acceptWebSocket(pair[1], [index === 2 ? "control" : "guest"]);
          pair[1].serializeAttachment({
            role: index === 2 ? "control" : "guest",
            principalId: index === 2 ? credential.credentialId : players[index],
            deliverySeq: 0,
          });
          pair[0].accept();
        }
        try {
          const raceId = (await instance.snapshotFor("stage")).play!.kart!.raceId;
          const packet = (sequence: number) =>
            JSON.stringify({
              kind: "command",
              name: "kart-input",
              requestId: crypto.randomUUID(),
              input: {
                ...kartNeutral,
                raceId,
                sequence,
                gas: true,
                drift: true,
              },
            });
          // Prime the real ingress cache and durably flush the first driver's input.
          await instance.webSocketMessage(pairs[0]![1], packet(7));
          await instance.alarm();
          expect(
            (await instance.snapshotFor("guest", players[0])).play!.kart!.inputCursor,
          ).toBe(7);
          state.storage.transactionSync(() => {
            const sql = state.storage.sql,
              store = createSqlStore(sql),
              q = questionFor(store.readRoom());
            if (q?.kind !== "kart") throw new Error("Kart required");
            releaseKartInputs(sql, store, q, now + 100);
            if (blocked === "paused") pause(store, now + 100);
            else
              store.writeRoom({
                ...store.readRoom(),
                hold: "controller",
                controllerPresent: false,
              });
          });
          // Deliberately withhold a broadcast: eligibility may still look open.
          await instance.webSocketMessage(pairs[1]![1], packet(8));
          if (blocked === "paused") {
            expect(
              (
                await instance.resumeRound({
                  ...credential,
                  requestId: crypto.randomUUID(),
                  nowMs: now + 10_000,
                })
              ).ok,
            ).toBe(true);
          } else {
            // The real presence path sees the already connected host and releases its hold.
            await instance.webSocketClose(pairs[1]![1], 1000, "rehearsal", true);
          }
          await instance.alarm();
          const view = await instance.snapshotFor("guest", players[1]);
          expect(view.paused).toBe(false);
          expect(view.held).toBe(false);
          expect(view.play!.kart!.inputCursor ?? 0).toBe(0);
          const sql = state.storage.sql,
            q = questionFor(createSqlStore(sql).readRoom());
          if (q?.kind !== "kart") throw new Error("Kart required");
          expect(
            readKart(sql, q.id)!.drivers.find(
              (driver) => driver.playerId === players[1],
            )!.input,
          ).toEqual(kartNeutral);
        } finally {
          for (const pair of pairs) {
            pair[0].close();
            pair[1].close();
          }
        }
      });
    },
  );
