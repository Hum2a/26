import { describe, expect, it } from "vitest";
import { demoQuestions } from "../src/questions/demo-set.ts";
import { pointsFor } from "../src/questions/multiple-choice.ts";
import {
  applyScoreModifiers,
  modifierOrder,
  questionModifiers,
  scoreModifiers,
  slotDecision,
} from "../src/troll/catalogue.ts";
import {
  pause,
  resume,
  type GameStore,
  type ScheduledJob,
} from "../src/room/lifecycle.ts";

describe("troll scoring rules", () => {
  it("doubles only a question that lists the modifier, and leaves a miss at zero", () => {
    expect(applyScoreModifiers(80, "correct", ["double"], ["double"])).toEqual({
      points: 160,
      detail: "correct*double",
    });
    expect(applyScoreModifiers(0, "miss", ["double"], ["double"])).toEqual({
      points: 0,
      detail: "miss*nothing",
    });
    expect(applyScoreModifiers(80, "correct", [], ["double"])).toEqual({
      points: 80,
      detail: "correct",
    });
    expect(modifierOrder).toEqual(["double"]);
  });

  it("drops the speed bonus only while a disrupting troll is active on a question that says so", () => {
    const candles = demoQuestions.find((question) => question.id === "candles");
    const shape = demoQuestions.find((question) => question.id === "shape");
    if (
      !candles ||
      candles.kind !== "choice" ||
      !candles.correctOptionId ||
      !shape ||
      shape.kind !== "choice" ||
      !shape.correctOptionId ||
      !shape.speedBonus
    ) {
      throw new Error("The demo speed questions are missing.");
    }
    expect(
      pointsFor(
        candles,
        {
          optionId: candles.correctOptionId,
          receivedAt: 0,
          deadlineAt: candles.collectMs,
        },
        { suppressSpeed: true, modifiers: [] },
      ).points,
    ).toBe(candles.points);
    expect(
      pointsFor(
        shape,
        {
          optionId: shape.correctOptionId,
          receivedAt: 0,
          deadlineAt: shape.collectMs,
        },
        { suppressSpeed: true, modifiers: [] },
      ).points,
    ).toBe(shape.points + shape.speedBonus.maxPoints);
  });

  it("starts on a free slot and queues behind a busy one, with no cap", () => {
    expect(slotDecision({ active: false })).toBe("start");
    expect(slotDecision({ active: true })).toBe("queue");
  });

  it("lets every scored choice question take every points troll", () => {
    expect(questionModifiers({ kind: "choice", outcome: { kind: "correct" } })).toEqual(
      scoreModifiers,
    );
    expect(
      questionModifiers({ kind: "choice", outcome: { kind: "multiple" } }),
    ).toEqual(scoreModifiers);
    expect(questionModifiers({ kind: "choice", outcome: { kind: "poll" } })).toEqual(
      [],
    );
    expect(questionModifiers({ kind: "slider" })).toEqual([]);
  });

  it("freezes an effect timer while the room is paused", () => {
    const job: ScheduledJob = {
      jobId: "effect:one",
      jobType: "gameplay",
      dueAt: 5_000,
      remainingMs: null,
      scopeGeneration: 1,
      phaseGeneration: 1,
      phase: null,
      status: "pending",
      retryCount: 0,
      payload: "effect:one",
      createdAt: 0,
    };
    const store = memoryStore(job);
    pause(store, 1_000);
    expect(store.jobs()[0]).toMatchObject({
      dueAt: null,
      remainingMs: 4_000,
      status: "pending",
    });
    resume(store, 9_000);
    expect(store.jobs()[0]).toMatchObject({ dueAt: 13_000, remainingMs: null });
  });
});

function memoryStore(job: ScheduledJob): GameStore {
  let jobs = [job];
  let paused = false;
  return {
    readRoom: () => ({
      phase: "collect",
      phaseGeneration: 1,
      scopeGeneration: 1,
      paused,
      controllerPresent: true,
      stagePresent: true,
      hold: null,
      roundId: "round",
      phases: ["intro", "collect"],
      durations: { collect: 30_000 },
      fault: null,
      questionIndex: 1,
      questionCount: 2,
      collectWindows: [],
      finishAfterRound: false,
      funFactIndex: 0,
      questionSetVersion: "demo-2026-09-22",
    }),
    writeRoom(next) {
      paused = next.paused;
    },
    casRoom: () => true,
    jobs: () => jobs,
    saveJob(next) {
      jobs = jobs.map((item) => (item.jobId === next.jobId ? next : item));
    },
    resources: () => [],
    saveResource() {},
    hasAnswer: () => false,
    saveAnswer() {},
  };
}
