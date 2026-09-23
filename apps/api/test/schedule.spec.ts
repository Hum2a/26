import { describe, expect, it } from "vitest";
import { formatPhaseClock, remainingUntil } from "@26/shared";
import { isLocalApp } from "../src/room/limits.ts";
import {
  acceptAnswer,
  advance,
  earliestDue,
  finishGame,
  fixturePlugin,
  notePresence,
  onAlarm,
  pause,
  resume,
  skipQuestion,
  scheduleBackground,
  startRound,
  type GameStore,
  type RoomClock,
  type RoundResource,
  type ScheduledJob,
} from "../src/room/lifecycle.ts";
import { commitAndArm, type ScheduleStorage } from "../src/room/scheduler.ts";

const roundId = "round-1";

describe("phase lifecycle", () => {
  it("pauses gameplay deadlines, keeps background work, and resumes the remainder", () => {
    const store = lobbyStore();
    startRound(store, 1_000, fixturePlugin({ durations: { intro: 10_000 } }), roundId);
    scheduleBackground(store, { jobId: "cleanup", dueAt: 1_500, now: 1_000 });
    pause(store, 4_000);
    onAlarm(store, 1_500);

    expect(store.readRoom().phase).toBe("intro");
    expect(store.readRoom().paused).toBe(true);
    expect(store.jobs().find((job) => job.jobId === "cleanup")?.status).toBe("done");
    const gameplay = pendingGameplay(store);
    expect(gameplay?.dueAt).toBeNull();
    expect(gameplay?.remainingMs).toBe(7_000);

    resume(store, 9_000);
    expect(store.readRoom().paused).toBe(false);
    expect(pendingGameplay(store)?.dueAt).toBe(16_000);
  });

  it("lets a manual advance win the race with the deadline", () => {
    const store = lobbyStore();
    startRound(
      store,
      0,
      fixturePlugin({ durations: { intro: 0, prompt: 10_000 } }),
      roundId,
    );
    expect(advance(store, 0)).toBe(true);
    onAlarm(store, 0);
    expect(store.readRoom().phase).toBe("prompt");
    expect(pendingGameplay(store)?.dueAt).toBe(10_000);
  });

  it("ignores a repeated alarm for a phase that already moved", () => {
    const store = lobbyStore();
    startRound(
      store,
      0,
      fixturePlugin({ durations: { intro: 0, prompt: 10_000 } }),
      roundId,
    );
    onAlarm(store, 0);
    onAlarm(store, 0);
    expect(store.readRoom().phase).toBe("prompt");
    expect(store.readRoom().phaseGeneration).toBe(3);
  });

  it("closes one late phase and gives the next phase its full time", () => {
    const store = lobbyStore();
    startRound(
      store,
      0,
      fixturePlugin({ durations: { intro: 1_000, prompt: 8_000 } }),
      roundId,
    );
    onAlarm(store, 100_000);
    expect(store.readRoom().phase).toBe("prompt");
    expect(pendingGameplay(store)?.dueAt).toBe(108_000);
    expect(store.readRoom().phase).not.toBe("reveal");
  });

  it("rejects a late answer from the stored deadline before the alarm runs", () => {
    const store = lobbyStore();
    startRound(
      store,
      0,
      fixturePlugin({ durations: { intro: 0, prompt: 0, collect: 5_000 } }),
      roundId,
    );
    onAlarm(store, 0);
    onAlarm(store, 0);
    expect(store.readRoom().phase).toBe("collect");
    expect(acceptAnswer(store, "player-1", 4_999)).toEqual({ ok: true });
    expect(acceptAnswer(store, "player-1", 1_000)).toEqual({
      ok: false,
      reason: "duplicate",
    });
    expect(acceptAnswer(store, "player-2", 5_000)).toEqual({
      ok: false,
      reason: "late",
    });
    expect(store.readRoom().phase).toBe("collect");
  });

  it("holds the phase after collection when the controller is away and not when only the stage is away", () => {
    const held = reachCollect(false, true);
    onAlarm(held, 0);
    expect(held.readRoom().phase).toBe("vote");
    expect(held.readRoom().hold).toBe("controller");
    expect(pendingGameplay(held)).toBeUndefined();

    notePresence(held, { controller: true, stage: true }, 50);
    expect(held.readRoom().hold).toBeNull();
    expect(held.readRoom().phase).toBe("vote");
    expect(pendingGameplay(held)?.dueAt).toBe(5_050);

    const stageAway = reachCollect(true, false);
    onAlarm(stageAway, 0);
    expect(stageAway.readRoom().phase).toBe("vote");
    expect(stageAway.readRoom().hold).toBeNull();
    expect(pendingGameplay(stageAway)?.dueAt).toBe(5_000);
  });

  it("releases round resources when a phase fails to open and stops after the retry cap", () => {
    const store = lobbyStore();
    startRound(store, 0, fixturePlugin({ durations: { intro: 0 } }), roundId);
    store.readRoom().fault = "enter";
    let now = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      onAlarm(store, now);
      const due = store.jobs().find((job) => job.jobType === "gameplay");
      now = due?.dueAt ?? now;
    }
    expect(store.readRoom().phase).toBe("intro");
    expect(store.jobs().some((job) => job.status === "failed")).toBe(true);
    expect(store.resources().every((resource) => resource.releasedAt !== null)).toBe(
      true,
    );
  });

  it("rolls the job back when the alarm write fails, so a commit never lacks a wakeup", async () => {
    const jobs: { dueAt: number | null; status: string }[] = [];
    let alarm: number | null = null;
    let committedAlarm: number | null = null;
    const sql = {
      exec(query: string, dueAt?: number) {
        if (query.includes("INSERT INTO schedule_job")) {
          jobs.push({ dueAt: dueAt ?? null, status: "pending" });
        }
        if (query.includes("MIN(due_at)")) {
          const due = jobs
            .filter((job) => job.status === "pending" && job.dueAt !== null)
            .map((job) => job.dueAt as number);
          return {
            toArray: () => [{ due: due.length > 0 ? Math.min(...due) : null }],
          };
        }
        return { toArray: () => [] };
      },
    };
    const storage = {
      sql,
      async transaction(
        run: (txn: {
          setAlarm: (time: number) => Promise<void>;
          deleteAlarm: () => Promise<void>;
        }) => Promise<void>,
      ) {
        const snapshot = jobs.map((job) => ({ ...job }));
        const previousAlarm = alarm;
        try {
          await run({
            async setAlarm() {
              throw new Error("The alarm could not be armed.");
            },
            async deleteAlarm() {
              alarm = null;
            },
          });
          committedAlarm = alarm;
        } catch (error) {
          jobs.splice(0, jobs.length, ...snapshot);
          alarm = previousAlarm;
          throw error;
        }
      },
    };

    await expect(
      commitAndArm(storage as unknown as ScheduleStorage, () => {
        sql.exec("INSERT INTO schedule_job", 5_000);
      }),
    ).rejects.toThrow("The alarm could not be armed.");
    expect(jobs).toEqual([]);
    expect(alarm).toBeNull();
    expect(committedAlarm).toBeNull();
    expect(earliestDue([])).toBeNull();
  });

  it("returns to the next question after scores and can skip or finish", () => {
    const store = lobbyStore();
    startRound(
      store,
      0,
      {
        kind: "multiple-choice",
        phases: ["intro", "prompt", "collect", "reveal", "scores"],
        durations: {
          intro: 1_000,
          prompt: 1_000,
          collect: 15_000,
          reveal: 1_000,
          scores: 1_000,
          final: 1_000,
        },
        questionCount: 2,
        collectWindows: [15_000, 20_000],
      },
      roundId,
    );
    for (let step = 0; step < 5; step += 1) {
      advance(store, 0);
    }
    expect(store.readRoom().phase).toBe("intro");
    expect(store.readRoom().questionIndex).toBe(1);
    expect(store.readRoom().durations.collect).toBe(20_000);
    advance(store, 0);
    advance(store, 0);
    expect(store.readRoom().phase).toBe("collect");
    expect(skipQuestion(store, 0)).toBe(true);
    expect(store.readRoom().phase).toBe("final");
    expect(finishGame(store, 0)).toBe(true);
    expect(store.readRoom().phase).toBe("podium");
    expect(advance(store, 0)).toBe(false);
  });

  it("finishes after the current question instead of leaving it", () => {
    const store = reachCollect(true, true);
    expect(store.readRoom().phase).toBe("collect");
    expect(finishGame(store, 0)).toBe(true);
    expect(store.readRoom().phase).toBe("collect");
    expect(store.readRoom().finishAfterRound).toBe(true);
    expect(finishGame(store, 0)).toBe(true);
    expect(store.readRoom().phase).toBe("collect");
  });

  it("allows the demo name cloud only in the local app", () => {
    expect(isLocalApp("local")).toBe(true);
    expect(isLocalApp("staging")).toBe(false);
    expect(isLocalApp("production")).toBe(false);
  });

  it("formats a countdown from the server deadline without a stored tick", () => {
    expect(formatPhaseClock(1_500)).toBe("0:02");
    expect(remainingUntil(10_000, 1_000, 1_200, 1_700)).toBe(8_500);
  });
});

function reachCollect(controller: boolean, stage: boolean): MemoryStore {
  const store = lobbyStore();
  store.readRoom().controllerPresent = controller;
  store.readRoom().stagePresent = stage;
  startRound(
    store,
    0,
    fixturePlugin({
      durations: { intro: 0, prompt: 0, collect: 0, vote: 5_000 },
    }),
    roundId,
  );
  onAlarm(store, 0);
  onAlarm(store, 0);
  expect(store.readRoom().phase).toBe("collect");
  return store;
}

function pendingGameplay(store: GameStore): ScheduledJob | undefined {
  return store
    .jobs()
    .find((job) => job.jobType === "gameplay" && job.status === "pending");
}

function lobbyStore(): MemoryStore {
  return new MemoryStore({
    phase: "lobby",
    phaseGeneration: 1,
    scopeGeneration: 1,
    paused: false,
    controllerPresent: true,
    stagePresent: true,
    hold: null,
    roundId: null,
    phases: [],
    durations: {},
    fault: null,
    questionIndex: 0,
    questionCount: 0,
    collectWindows: [],
    finishAfterRound: false,
  });
}

class MemoryStore implements GameStore {
  jobList: ScheduledJob[] = [];
  resourceList: RoundResource[] = [];
  private answers: { playerId: string; phaseGeneration: number; at: number }[] = [];

  constructor(public room: RoomClock) {}

  readRoom(): RoomClock {
    return this.room;
  }

  writeRoom(room: RoomClock): void {
    this.room = room;
  }

  casRoom(expectedGeneration: number, next: RoomClock): boolean {
    if (this.room.phaseGeneration !== expectedGeneration) {
      return false;
    }
    this.room = next;
    return true;
  }

  jobs(): ScheduledJob[] {
    return this.jobList;
  }

  saveJob(job: ScheduledJob): void {
    const index = this.jobList.findIndex((item) => item.jobId === job.jobId);
    if (index >= 0) {
      this.jobList[index] = job;
      return;
    }
    this.jobList.push(job);
  }

  resources(): RoundResource[] {
    return this.resourceList;
  }

  saveResource(resource: RoundResource): void {
    const index = this.resourceList.findIndex(
      (item) => item.resourceId === resource.resourceId,
    );
    if (index >= 0) {
      this.resourceList[index] = resource;
      return;
    }
    this.resourceList.push(resource);
  }

  hasAnswer(playerId: string, phaseGeneration: number): boolean {
    return this.answers.some(
      (answer) =>
        answer.playerId === playerId && answer.phaseGeneration === phaseGeneration,
    );
  }

  saveAnswer(playerId: string, phaseGeneration: number, at: number): void {
    this.answers.push({ playerId, phaseGeneration, at });
  }
}
