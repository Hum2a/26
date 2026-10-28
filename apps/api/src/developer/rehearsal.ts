import {
  rehearsalConfigSchema,
  type RehearsalState,
  type RehearsalScenario,
} from "@26/shared";
import {
  advance,
  pause,
  resume,
  restartQuestion,
  startRound,
  type GameStore,
  type RoundPlugin,
  type ScheduledJob,
} from "../room/lifecycle.ts";
import { createSqlStore } from "../room/sql-store.ts";
import { resolveContent, questionFor } from "../questions/registry.ts";
import { developerDetails, setBotCount } from "./bots.ts";

type Stored = Omit<RehearsalState, "questions" | "events" | "checks"> & {
  generation: number;
  enteredAt: number;
};
export function readRehearsal(sql: SqlStorage): Stored | undefined {
  const row = sql
    .exec<{ payload: string }>(`SELECT payload FROM developer_rehearsal WHERE id=1`)
    .toArray()[0];
  return row ? (JSON.parse(row.payload) as Stored) : undefined;
}
function save(sql: SqlStorage, value: Stored) {
  sql.exec(
    `INSERT INTO developer_rehearsal (id,payload) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`,
    JSON.stringify(value),
  );
}
export function requireRehearsal(sql: SqlStorage): Stored {
  const state = readRehearsal(sql);
  if (!state)
    throw new Error(
      "This control is available only in a dedicated rehearsal room. Create one first.",
    );
  return state;
}
export function recordRehearsalEvent(
  sql: SqlStorage,
  input: {
    kind: "host" | "phase" | "connection" | "answer" | "scenario" | "check";
    actor?: string;
    playerId?: string;
    detail: string;
    status?: "accepted" | "refused" | "info";
    now: number;
  },
) {
  if (!readRehearsal(sql)) return;
  const room = createSqlStore(sql).readRoom();
  const nickname = input.playerId
    ? sql
        .exec<{ nickname: string }>(
          `SELECT nickname FROM player WHERE player_id=?`,
          input.playerId,
        )
        .toArray()[0]?.nickname
    : undefined;
  sql.exec(
    `INSERT INTO developer_event (at,kind,actor,detail,status,phase,question_id) VALUES (?,?,?,?,?,?,?)`,
    input.now,
    input.kind,
    (nickname ?? input.actor ?? "Host").slice(0, 24),
    input.detail.slice(0, 180),
    input.status ?? "info",
    room.phase,
    questionFor(room)?.id ?? null,
  );
  sql.exec(
    `DELETE FROM developer_event WHERE id <= (SELECT COALESCE(MAX(id),0)-200 FROM developer_event)`,
  );
  if (input.status === "refused") {
    const state = readRehearsal(sql)!;
    if (state.runner === "running" && state.config.stopOnFailure) {
      pause(createSqlStore(sql), input.now);
      save(sql, {
        ...state,
        runner: "paused",
        reason: "Stopped after a refused command. Inspect the event timeline.",
      });
      cancelRunner(sql);
    }
  }
}
function cancelRunner(sql: SqlStorage) {
  sql.exec(
    `UPDATE schedule_job SET status='cancelled',due_at=NULL WHERE job_id='developer-runner'`,
  );
}
function scheduleRunner(sql: SqlStorage, store: GameStore, now: number) {
  const state = requireRehearsal(sql),
    room = store.readRoom();
  if (state.runner !== "running" || room.phase === "podium") {
    cancelRunner(sql);
    return;
  }
  const duration = ["collect", "vote", "predict"].includes(room.phase)
    ? state.config.collectMs
    : state.config.beatMs;
  store.saveJob({
    jobId: "developer-runner",
    jobType: "background",
    payload: "developer-runner",
    dueAt:
      room.paused || room.hold
        ? now + 1000
        : Math.max(now + 100, state.enteredAt + duration),
    remainingMs: null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount: 0,
    createdAt: now,
  });
}
export function configureRehearsal(
  sql: SqlStorage,
  value: unknown,
  now: number,
  store: GameStore,
  plugin: RoundPlugin,
) {
  const config = rehearsalConfigSchema.parse(value),
    previous = readRehearsal(sql),
    room = store.readRoom();
  if (
    !previous &&
    (room.phase !== "lobby" ||
      sql.exec(`SELECT player_id FROM player LIMIT 1`).toArray().length)
  )
    throw new Error("Create a fresh empty room for this rehearsal.");
  if (previous && previous.config.pack !== config.pack)
    throw new Error("Choose a different pack when creating a fresh rehearsal.");
  const content = resolveContent(room.questionSetVersion, room.questionScript);
  if (content.status !== "playable")
    throw new Error("The rehearsal pack is unavailable.");
  if (!previous)
    store.writeRoom({
      ...room,
      questionCount: content.pack.questions.length,
      collectWindows: content.pack.questions.map((q) => q.collectMs),
      phases: [...plugin.phases],
      durations: { ...plugin.durations },
    });
  save(sql, {
    config,
    revision: previous?.revision ?? 1,
    runner: previous?.runner ?? "stopped",
    reason: "Rehearsal settings saved.",
    startedAt: previous?.startedAt ?? null,
    scenario: previous?.scenario ?? null,
    generation: room.phaseGeneration,
    enteredAt: now,
  });
  setBotCount(sql, config.botCount, now);
  recordRehearsalEvent(sql, {
    kind: "host",
    detail: "Rehearsal configuration saved",
    status: "accepted",
    now,
  });
  scheduleRunner(sql, store, now);
}
export function changeRunner(
  sql: SqlStorage,
  store: GameStore,
  running: boolean,
  now: number,
) {
  const state = requireRehearsal(sql),
    room = store.readRoom();
  if (!running) {
    if (room.phase !== "lobby" && !room.paused) pause(store, now);
    save(sql, {
      ...state,
      runner: "stopped",
      reason: "Automatic show runner stopped.",
    });
    cancelRunner(sql);
    return;
  }
  if (room.phase === "podium")
    throw new Error("Jump to a question or create a fresh rehearsal first.");
  save(sql, {
    ...state,
    runner: "running",
    reason: "Automatic show runner is running.",
    startedAt: now,
    enteredAt: now,
  });
  if (room.phase === "lobby")
    startRound(
      store,
      now,
      {
        kind: "multiple-choice",
        phases: room.phases as RoundPlugin["phases"],
        durations: room.durations,
        questionCount: room.questionCount,
        collectWindows: room.collectWindows,
      },
      `rehearsal:${room.scopeGeneration}`,
    );
  else if (room.paused) resume(store, now);
  scheduleRunner(sql, store, now);
}
export function enterRehearsalPhase(sql: SqlStorage, store: GameStore, now: number) {
  const state = readRehearsal(sql);
  if (!state) return;
  const room = store.readRoom();
  save(sql, {
    ...state,
    generation: room.phaseGeneration,
    enteredAt: now,
    ...(room.phase === "podium"
      ? { runner: "finished" as const, reason: "The rehearsal reached the podium." }
      : {}),
  });
  recordRehearsalEvent(sql, {
    kind: "phase",
    actor: "Server",
    detail: `Entered ${room.phase}`,
    now,
  });
  if (
    state.runner === "running" &&
    state.config.pauseAtReveal &&
    room.phase === "reveal"
  ) {
    pause(store, now);
    save(sql, {
      ...requireRehearsal(sql),
      runner: "paused",
      reason: "Paused at the reveal. Continue when ready.",
    });
  }
  scheduleRunner(sql, store, now);
}
export function rehearsalChecks(
  sql: SqlStorage,
  now: number,
): RehearsalState["checks"] {
  const state = requireRehearsal(sql),
    room = createSqlStore(sql).readRoom(),
    bots = developerDetails(sql).bots;
  const question = questionFor(room);
  const duplicate =
    sql
      .exec(
        `SELECT question_id FROM score_ledger GROUP BY question_id,player_id HAVING COUNT(*)>1 LIMIT 1`,
      )
      .toArray().length > 0;
  const deadline = createSqlStore(sql)
    .jobs()
    .find(
      (j) =>
        j.jobType === "gameplay" &&
        j.status === "pending" &&
        j.phaseGeneration === room.phaseGeneration &&
        j.payload === room.phase,
    )?.dueAt;
  const stuck = !room.paused && !room.hold && deadline != null && now > deadline + 5000;
  const connected = sql
    .exec<{ n: number }>(
      `SELECT COUNT(*) AS n FROM developer_connection c JOIN player p ON p.player_id=c.player_id JOIN developer_bot b ON b.player_id=p.player_id WHERE c.connected=1 AND p.revoked_at IS NULL`,
    )
    .toArray()[0]!.n;
  let expecting = Math.ceil((bots.length * state.config.participation) / 100);
  let answers: number | undefined;
  if (
    question &&
    ["choice", "slider", "rank", "typed", "vote"].includes(question.kind)
  ) {
    answers = sql
      .exec<{ n: number }>(
        `SELECT COUNT(DISTINCT a.player_id) AS n FROM (
      SELECT player_id,question_id FROM choice_answer UNION ALL SELECT player_id,question_id FROM round_response UNION ALL SELECT player_id,question_id FROM text_response UNION ALL SELECT player_id,question_id FROM vote_ballot
    ) a JOIN developer_bot b ON b.player_id=a.player_id JOIN player p ON p.player_id=a.player_id WHERE a.question_id=? AND p.revoked_at IS NULL`,
        question.id,
      )
      .toArray()[0]!.n;
  }
  if (question?.kind === "vote" && ["reveal", "scores"].includes(room.phase)) {
    const eligible = sql
      .exec<{ n: number }>(
        `SELECT COUNT(*) AS n FROM vote_elector e JOIN developer_bot b ON b.player_id=e.player_id JOIN player p ON p.player_id=e.player_id WHERE e.question_id=? AND p.revoked_at IS NULL`,
        question.id,
      )
      .toArray()[0]!.n;
    expecting = Math.min(expecting, eligible);
  }
  const closed = ["reveal", "scores"].includes(room.phase);
  const missing =
    closed && state.config.autoAnswers && answers !== undefined && answers < expecting;
  const refused =
    sql
      .exec(
        `SELECT id FROM developer_event WHERE at>=? AND status='refused' LIMIT 1`,
        state.startedAt ?? now,
      )
      .toArray().length > 0;
  const grace =
    state.startedAt !== null &&
    now - state.startedAt > 15000 &&
    state.runner === "running";
  return [
    {
      id: "scores",
      status: duplicate ? "fail" : "pass",
      detail: duplicate
        ? "Duplicate score entries found."
        : "Each player has at most one score entry per question.",
    },
    {
      id: "phase",
      status: stuck ? "fail" : "pass",
      detail: stuck
        ? "The current phase is past its deadline without advancing."
        : room.paused || room.hold
          ? "The game is deliberately paused or held."
          : "The phase timer is not overdue.",
    },
    {
      id: "answers",
      status: missing ? "fail" : closed && answers !== undefined ? "pass" : "waiting",
      detail:
        answers === undefined
          ? "Answer-count checking does not apply to this mechanic yet."
          : `${answers}/${expecting} participating bots answered${closed ? "." : " so far; checked at the reveal."}`,
    },
    {
      id: "connections",
      status:
        grace && connected < bots.length
          ? "fail"
          : connected === bots.length
            ? "pass"
            : "waiting",
      detail: `${connected}/${bots.length} bots connected${grace && connected < bots.length ? "; some have not reconnected." : "."}`,
    },
    {
      id: "refusals",
      status: refused ? "fail" : "pass",
      detail: refused
        ? "A command was refused in this run. Inspect the timeline."
        : "No refused commands recorded in this run.",
    },
  ];
}
export function tickRehearsal(
  sql: SqlStorage,
  store: GameStore,
  _job: ScheduledJob,
  now: number,
) {
  const state = readRehearsal(sql);
  if (!state || state.runner !== "running") return;
  const failure = rehearsalChecks(sql, now).find(
    (check) => check.id !== "phase" && check.status === "fail",
  );
  if (failure && state.config.stopOnFailure) {
    pause(store, now);
    save(sql, { ...state, runner: "paused", reason: failure.detail });
    recordRehearsalEvent(sql, {
      kind: "check",
      actor: "Server",
      detail: failure.detail,
      now,
    });
    return;
  }
  const room = store.readRoom();
  if (
    !room.controllerPresent &&
    !(state.scenario?.name === "host-loss" && now - state.scenario.at < 15000)
  ) {
    pause(store, now);
    save(sql, {
      ...state,
      runner: "paused",
      reason: "Host connection lost. Reopen Developer tools and continue when ready.",
    });
    cancelRunner(sql);
    return;
  }
  if (room.paused || room.hold) {
    scheduleRunner(sql, store, now);
    return;
  }
  const duration = ["collect", "vote", "predict"].includes(room.phase)
    ? state.config.collectMs
    : state.config.beatMs;
  if (!room.controllerPresent) {
    store.saveJob({ ..._job, dueAt: now + 1000, status: "pending" });
    return;
  }
  if (now >= state.enteredAt + duration) {
    try {
      advance(store, now);
    } catch {
      pause(store, now);
      save(sql, {
        ...requireRehearsal(sql),
        runner: "paused",
        reason: "The show could not advance. Inspect the question and repeat it.",
      });
      recordRehearsalEvent(sql, {
        kind: "check",
        actor: "Server",
        detail: "Phase advance failed",
        status: "refused",
        now,
      });
      return;
    }
  }
  scheduleRunner(sql, store, now);
}
export function jumpRehearsal(
  sql: SqlStorage,
  store: GameStore,
  index: number,
  now: number,
) {
  const state = requireRehearsal(sql),
    room = store.readRoom();
  const target = questionFor({ ...room, questionIndex: index });
  if (!Number.isInteger(index) || !target)
    throw new Error("Choose a question from this room's frozen pack.");
  const questionTables = [
    "round_state",
    "choice_answer",
    "score_ledger",
    "round_response",
    "text_response",
    "vote_candidate",
    "vote_elector",
    "vote_order",
    "vote_ballot",
    "vote_shortlist",
    "vote_feature",
    "vote_freeze",
    "duel_freeze",
    "duel_pair",
    "duel_role",
    "duel_answer",
    "duel_prediction",
  ] as const;
  for (const table of questionTables)
    sql.exec(`DELETE FROM ${table} WHERE question_id=?`, target.id);
  save(sql, {
    ...state,
    revision: state.revision + 1,
    runner: "stopped",
    reason: "Question reset. Its previous answers and points were cleared.",
    scenario: null,
  });
  cancelRunner(sql);
  restartQuestion(store, index, now);
}
export function setRehearsalScenario(
  sql: SqlStorage,
  name: RehearsalScenario,
  now: number,
) {
  const state = requireRehearsal(sql),
    bots = developerDetails(sql).bots;
  if (name === "late-join") setBotCount(sql, bots.length + 1, now);
  else if (name === "disconnect") {
    if (!bots.length) throw new Error("Add bots before simulating a disconnect.");
    for (const bot of bots.slice(0, Math.ceil(bots.length / 4)))
      sql.exec(
        `INSERT INTO developer_outage (principal,until_at) VALUES (?,?) ON CONFLICT(principal) DO UPDATE SET until_at=excluded.until_at`,
        bot.playerId,
        now + 5000,
      );
  } else if (name === "host-loss")
    sql.exec(
      `INSERT INTO developer_outage (principal,until_at) VALUES ('control',?) ON CONFLICT(principal) DO UPDATE SET until_at=excluded.until_at`,
      now + 5000,
    );
  else {
    const room = createSqlStore(sql).readRoom();
    if (room.phase !== "collect" || room.paused || room.hold)
      throw new Error("Open an answering window before arming a deadline burst.");
    const deadline = createSqlStore(sql)
      .jobs()
      .find(
        (j) =>
          j.payload === "collect" &&
          j.status === "pending" &&
          j.phaseGeneration === room.phaseGeneration,
      )?.dueAt;
    if (deadline == null || deadline - now < 1000)
      throw new Error(
        "There is not enough time left. Repeat the question and try again.",
      );
    cancelRunner(sql);
  }
  save(sql, {
    ...state,
    config: { ...state.config, botCount: developerDetails(sql).bots.length },
    ...(name === "deadline-burst"
      ? { config: { ...state.config, autoAnswers: false }, runner: "stopped" as const }
      : {}),
    scenario: { name, at: now, leadMs: name === "deadline-burst" ? 250 : 0 },
  });
  recordRehearsalEvent(sql, {
    kind: "scenario",
    detail:
      name === "disconnect"
        ? "Disconnect 25% of bots for five seconds"
        : name === "host-loss"
          ? "Lose host connection for five seconds"
          : name === "late-join"
            ? "Add a late bot"
            : "Arm answers 250 ms before the deadline",
    status: "accepted",
    now,
  });
}
export function rehearsalOutage(sql: SqlStorage, principal: string, now: number) {
  return (
    (sql
      .exec<{ until_at: number }>(
        `SELECT until_at FROM developer_outage WHERE principal=?`,
        principal,
      )
      .toArray()[0]?.until_at ?? 0) > now
  );
}
export function isRehearsalPhone(sql: SqlStorage, playerId: string) {
  return (
    sql
      .exec(
        `SELECT p.player_id FROM developer_phone d JOIN player p ON p.player_id=d.player_id WHERE p.player_id=? AND p.revoked_at IS NULL`,
        playerId,
      )
      .toArray().length > 0
  );
}
export function recordRehearsalConnection(
  sql: SqlStorage,
  playerId: string,
  connected: boolean,
  now: number,
) {
  if (!readRehearsal(sql)) return;
  sql.exec(
    `INSERT INTO developer_connection (player_id,connected,changed_at) VALUES (?,?,?) ON CONFLICT(player_id) DO UPDATE SET connected=excluded.connected,changed_at=excluded.changed_at`,
    playerId,
    connected ? 1 : 0,
    now,
  );
  recordRehearsalEvent(sql, {
    kind: "connection",
    playerId,
    detail: connected ? "Connected" : "Disconnected",
    now,
  });
}
export function rehearsalDetails(
  sql: SqlStorage,
  now: number,
): RehearsalState | undefined {
  const state = readRehearsal(sql);
  if (!state) return;
  const room = createSqlStore(sql).readRoom(),
    content = resolveContent(room.questionSetVersion, room.questionScript);
  const events = sql
    .exec<{
      id: number;
      at: number;
      kind: RehearsalState["events"][number]["kind"];
      actor: string;
      detail: string;
      status: RehearsalState["events"][number]["status"];
      phase: string;
      question_id: string | null;
    }>(`SELECT * FROM developer_event ORDER BY id DESC LIMIT 200`)
    .toArray()
    .map((e) => ({
      id: e.id,
      at: e.at,
      kind: e.kind,
      actor: e.actor,
      detail: e.detail,
      status: e.status,
      phase: e.phase,
      questionId: e.question_id,
    }));
  return {
    config: state.config,
    revision: state.revision,
    runner: state.runner,
    reason: state.reason,
    startedAt: state.startedAt,
    scenario: state.scenario,
    questions:
      content.status === "playable"
        ? content.pack.questions.map((q) => ({
            id: q.id,
            title: q.prompt.slice(0, 240),
          }))
        : [],
    events,
    checks: rehearsalChecks(sql, now),
  };
}
