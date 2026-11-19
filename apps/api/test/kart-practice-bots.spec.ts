import { expect, it } from "vitest";
import {
  createPracticeBots,
  createPracticePlayerLap,
  defaultCourseSettings,
  practiceBotSlipstreamActors,
  practiceStandings,
  recoverPracticePlayerLap,
  stepPracticeBots,
  stepPracticePlayerLap,
  stepSlipstream,
} from "@26/shared";
import { importedSurfaceAt } from "../../../packages/shared/src/kart/kart-track.ts";

it("places up to 7 bots on clear road grid slots without overlapping the player", () => {
  expect(createPracticeBots({ count: 0, mode: "free" })).toEqual([]);
  expect(
    createPracticeBots({ count: 3, mode: "free", practiceFeatureId: "launch-pad" }),
  ).toEqual([]);

  for (const mode of ["free", "trial-1", "trial-3"] as const) {
    const bots = createPracticeBots({ count: 7, mode });
    expect(bots).toHaveLength(7);
    const playerPos = mode === "free" ? { x: 0, z: 0 } : { x: 0, z: 8 };
    for (const bot of bots) {
      expect(importedSurfaceAt(bot.body.x, bot.body.z)).toBe("road");
      expect(
        Math.hypot(bot.body.x - playerPos.x, bot.body.z - playerPos.z),
      ).toBeGreaterThanOrEqual(3);
      if (mode !== "free") expect(bot.body.z).toBeGreaterThan(0);
    }
  }
});

it("drives bots round Mario circuit continuously in free drive and finishes timed races", () => {
  let freeBots = createPracticeBots({ count: 2, mode: "free" });
  for (let ms = 0; ms < 80_000; ms += 20) {
    freeBots = stepPracticeBots(freeBots, {
      stepMs: 20,
      elapsedMs: ms,
      mode: "free",
      handling: "slide-v1",
      courseSettings: defaultCourseSettings,
      oils: [],
    });
  }
  for (const bot of freeBots) {
    expect(bot.finished).toBe(false);
    expect(bot.lapsDone).toBeGreaterThanOrEqual(1);
    expect(bot.progress).toBeGreaterThan(1);
  }

  let trialBots = createPracticeBots({ count: 2, mode: "trial-1" });
  for (let ms = 0; ms < 80_000; ms += 20) {
    trialBots = stepPracticeBots(trialBots, {
      stepMs: 20,
      elapsedMs: ms,
      mode: "trial-1",
      handling: "slide-v1",
      courseSettings: defaultCourseSettings,
      oils: [],
    });
  }
  for (const bot of trialBots) {
    expect(bot.finished).toBe(true);
    expect(bot.finishTimeMs).toBeGreaterThan(50_000);
    expect(bot.lapsDone).toBe(1);
  }
});

it("slows a bot on an oil slick and exposes slipstream actors while racing", () => {
  let bots = createPracticeBots({ count: 1, mode: "free" });
  for (let ms = 0; ms < 2000; ms += 20) {
    bots = stepPracticeBots(bots, {
      stepMs: 20,
      elapsedMs: ms,
      mode: "free",
      handling: "slide-v1",
      courseSettings: defaultCourseSettings,
      oils: [],
    });
  }
  const bot = bots[0]!;
  const beforeSpeed = Math.hypot(bot.body.vx, bot.body.vz);
  expect(beforeSpeed).toBeGreaterThan(10);

  const actors = practiceBotSlipstreamActors(bots);
  expect(actors).toHaveLength(1);
  const draft = stepSlipstream(
    { draftMs: 0, slipstreamMs: 0 },
    {
      playerId: "solo",
      x: bot.body.x - Math.cos(bot.body.heading) * 6,
      z: bot.body.z - Math.sin(bot.body.heading) * 6,
      heading: bot.body.heading,
      speed: beforeSpeed,
    },
    actors,
    500,
  );
  expect(draft.draftMs).toBe(500);

  const hitBots = stepPracticeBots(bots, {
    stepMs: 20,
    elapsedMs: 2000,
    mode: "free",
    handling: "slide-v1",
    courseSettings: defaultCourseSettings,
    oils: [
      {
        id: "oil-1",
        owner: "solo",
        x: bot.body.x,
        z: bot.body.z,
        createdAt: 1000,
        expiresAt: 10_000,
      },
    ],
  });
  expect(hitBots[0]!.slowedUntil).toBeGreaterThan(2020);
  expect(Math.hypot(hitBots[0]!.body.vx, hitBots[0]!.body.vz)).toBeLessThan(
    beforeSpeed * 0.6,
  );
});

it("ranks finished karts by finish time and racing karts by progress", () => {
  const bots = createPracticeBots({ count: 2, mode: "trial-1" });
  bots[0] = {
    ...bots[0]!,
    finished: true,
    finishTimeMs: 62_000,
    progress: 1,
    lapsDone: 1,
  };
  bots[1] = {
    ...bots[1]!,
    finished: false,
    progress: 0.75,
    lapsDone: 0,
  };
  const table = practiceStandings(
    { progress: 1, lapsDone: 1, finished: true, timeMs: 61_000 },
    bots,
  );
  expect(table.map((row) => [row.name, row.place])).toEqual([
    ["You", 1],
    [bots[0]!.name, 2],
    [bots[1]!.name, 3],
  ]);
});

it("rewinds free-drive lap count to the anchor lap on recovery without double-counting", () => {
  const preFinishAnchor = {
    cursor: { angle: 5, distance: 390, checkpoint: 2 },
    lap: 0,
  };
  const initial = createPracticePlayerLap(0, 0);
  expect(initial.lapsDone).toBe(0);
  const recovered = recoverPracticePlayerLap(
    preFinishAnchor.cursor,
    preFinishAnchor.lap,
  );
  expect(recovered.lapsDone).toBe(0);
  expect(recovered.cursor).toEqual(preFinishAnchor.cursor);
  expect(recovered.progress).toBeGreaterThan(0);
  expect(recovered.progress).toBeLessThan(1);

  const afterLine = stepPracticePlayerLap(recovered, {
    x: 0,
    z: 8,
    speed: 30,
    stepMs: 20,
  });
  expect(afterLine.lapsDone).toBeLessThanOrEqual(1);
});
