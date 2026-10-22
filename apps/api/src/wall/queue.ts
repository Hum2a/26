import { nextWall, type WallEvent, type WallStep } from "@26/shared";
import { wallAdvancePayload } from "../room/lifecycle.ts";
import { createSqlStore } from "../room/sql-store.ts";
import { readWallSettings } from "./store.ts";

/**
 * The room side of the photo wall queue. It reads the queue from SQL, runs the
 * pure `nextWall`, writes the result back and keeps one background job,
 * `wall-advance`, due when the photo on screen ends. Background jobs keep
 * running while a round is paused, so the lobby and podium keep cycling.
 *
 * Call it inside the transaction that changed anything the queue depends on:
 * a new or withdrawn post, a phase change, a setting, or the alarm itself.
 */
export function syncWall(sql: SqlStorage, event: WallEvent, now: number): WallStep {
  const store = createSqlStore(sql);
  const room = store.readRoom();
  const settings = readWallSettings(sql);
  const showingRow = sql
    .exec<{ post_id: string; player_id: string; until_at: number | null }>(
      `SELECT post_id, player_id, until_at FROM wall_post WHERE status = 'showing' LIMIT 1`,
    )
    .toArray()[0];
  const queued = sql
    .exec<{ post_id: string; player_id: string; queued_at: number | null }>(
      `SELECT post_id, player_id, queued_at FROM wall_post WHERE status = 'queued'`,
    )
    .toArray()
    .map((row) => ({
      postId: row.post_id,
      playerId: row.player_id,
      queuedAt: row.queued_at ?? 0,
    }));
  const lastShownAt: Record<string, number> = {};
  for (const row of sql
    .exec<{ player_id: string; last: number }>(
      `SELECT player_id, MAX(shown_at) AS last FROM wall_post
       WHERE shown_at IS NOT NULL GROUP BY player_id`,
    )
    .toArray()) {
    lastShownAt[row.player_id] = row.last;
  }
  const step = nextWall(
    {
      enabled: settings.enabled,
      placement: settings.placement,
      showMs: settings.showMs,
      phase: room.phase,
      showing: showingRow
        ? {
            postId: showingRow.post_id,
            playerId: showingRow.player_id,
            untilAt: showingRow.until_at ?? now,
          }
        : null,
      queued,
      lastShownAt,
    },
    event,
    now,
  );
  if (step.finished) {
    sql.exec(
      `UPDATE wall_post SET status = 'shown', until_at = NULL
       WHERE post_id = ? AND status = 'showing'`,
      step.finished,
    );
  }
  if (step.started && step.showing) {
    sql.exec(
      `UPDATE wall_post SET status = 'showing', shown_at = ?, until_at = ? WHERE post_id = ?`,
      now,
      step.showing.untilAt,
      step.started,
    );
  }
  scheduleAdvance(sql, step.wakeAt, now);
  if (step.finished || step.started) {
    sql.exec(`UPDATE room SET state_version = state_version + 1`);
  }
  return step;
}

function scheduleAdvance(sql: SqlStorage, wakeAt: number | null, now: number): void {
  const store = createSqlStore(sql);
  const current = store.jobs().find((job) => job.jobId === wallAdvancePayload);
  if (wakeAt === null) {
    if (current?.status === "pending") {
      store.saveJob({ ...current, status: "cancelled", dueAt: null });
    }
    return;
  }
  if (current?.status === "pending" && current.dueAt === wakeAt) {
    return;
  }
  const room = store.readRoom();
  store.saveJob({
    jobId: wallAdvancePayload,
    jobType: "background",
    dueAt: wakeAt,
    remainingMs: null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: null,
    status: "pending",
    retryCount: 0,
    payload: wallAdvancePayload,
    createdAt: current?.createdAt ?? now,
  });
}
