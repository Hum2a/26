import { describe, expect, it } from "vitest";
import {
  nextWall,
  wallRushQueue,
  wallRushShowMs,
  type WallQueueState,
} from "@26/shared";

function state(overrides: Partial<WallQueueState> = {}): WallQueueState {
  return {
    enabled: true,
    placement: "breaks",
    showMs: 8_000,
    phase: "lobby",
    showing: null,
    queued: [],
    lastShownAt: {},
    ...overrides,
  };
}

const post = (postId: string, playerId: string, queuedAt: number) => ({
  postId,
  playerId,
  queuedAt,
});

describe("photo wall queue", () => {
  it("stays quiet with nothing queued", () => {
    expect(nextWall(state(), "tick", 1_000)).toEqual({
      showing: null,
      finished: null,
      started: null,
      wakeAt: null,
    });
  });

  it("starts the oldest approval and wakes when it ends", () => {
    const step = nextWall(
      state({ queued: [post("b", "bilal", 20), post("a", "amina", 10)] }),
      "tick",
      1_000,
    );
    expect(step).toEqual({
      showing: { postId: "a", playerId: "amina", untilAt: 9_000 },
      finished: null,
      started: "a",
      wakeAt: 9_000,
    });
  });

  it("takes turns between players instead of draining one player's photos", () => {
    const step = nextWall(
      state({
        queued: [
          post("a2", "amina", 10),
          post("a3", "amina", 11),
          post("b1", "bilal", 50),
        ],
        lastShownAt: { amina: 500 },
      }),
      "tick",
      1_000,
    );
    // Bilal has never been shown, so he goes before Amina's older photos.
    expect(step.started).toBe("b1");
    const later = nextWall(
      state({
        queued: [post("a2", "amina", 10), post("c1", "chen", 60)],
        lastShownAt: { amina: 500, chen: 900 },
      }),
      "tick",
      1_000,
    );
    // Amina's last photo started longer ago than Chen's.
    expect(later.started).toBe("a2");
  });

  it("keeps the current photo until its time is up, then moves on", () => {
    const current = { postId: "a", playerId: "amina", untilAt: 9_000 };
    const early = nextWall(
      state({ showing: current, queued: [post("b", "bilal", 20)] }),
      "tick",
      8_999,
    );
    expect(early).toEqual({
      showing: current,
      finished: null,
      started: null,
      wakeAt: 9_000,
    });
    const done = nextWall(
      state({ showing: current, queued: [post("b", "bilal", 20)] }),
      "tick",
      9_000,
    );
    expect(done).toMatchObject({ finished: "a", started: "b", wakeAt: 17_000 });
  });

  it("waits for a break during questions, but lets the current photo finish", () => {
    const queued = [post("a", "amina", 10)];
    for (const phase of ["prompt", "predict", "collect", "vote", "reveal", "facts"]) {
      expect(nextWall(state({ phase, queued }), "tick", 1_000).started).toBeNull();
    }
    for (const phase of ["lobby", "intro", "scores", "final", "podium"]) {
      expect(nextWall(state({ phase, queued }), "tick", 1_000).started).toBe("a");
    }
    const current = { postId: "z", playerId: "zed", untilAt: 9_000 };
    expect(
      nextWall(state({ phase: "collect", showing: current, queued }), "tick", 5_000)
        .showing,
    ).toEqual(current);
  });

  it("shows during questions in the corner placement", () => {
    expect(
      nextWall(
        state({
          phase: "collect",
          placement: "corner",
          queued: [post("a", "amina", 10)],
        }),
        "tick",
        1_000,
      ).started,
    ).toBe("a");
  });

  it("skips, forces and switches off on the host's word", () => {
    const current = { postId: "a", playerId: "amina", untilAt: 9_000 };
    const queued = [post("b", "bilal", 20)];
    expect(nextWall(state({ showing: current, queued }), "skip", 2_000)).toMatchObject({
      finished: "a",
      started: "b",
    });
    expect(nextWall(state({ phase: "collect", queued }), "force", 2_000).started).toBe(
      "b",
    );
    expect(
      nextWall(state({ enabled: false, showing: current, queued }), "tick", 2_000),
    ).toEqual({ showing: null, finished: "a", started: null, wakeAt: null });
  });

  it("shortens each photo when there is a rush", () => {
    const queued = Array.from({ length: wallRushQueue + 1 }, (_, index) =>
      post(`p${index}`, `player${index}`, index),
    );
    const step = nextWall(state({ queued }), "tick", 0);
    expect(step.wakeAt).toBe(wallRushShowMs);
    const calm = nextWall(state({ queued: queued.slice(0, wallRushQueue) }), "tick", 0);
    expect(calm.wakeAt).toBe(8_000);
  });
});
