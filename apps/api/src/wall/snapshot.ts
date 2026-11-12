import {
  wallFrameSchema,
  wallQueueOrder,
  wallReactions,
  type WallFrame,
  type WallReaction,
  type WallSnapshot,
} from "@26/shared";
import {
  wallClosedMessage,
  wallCooldownMessage,
  wallCooldownMs,
  wallMutedMessage,
  wallWaitingMessage,
  wallWaitingPerPlayer,
} from "../room/limits.ts";
import { readWallSettings, wallSendBlock } from "./store.ts";
import { createSqlStore } from "../room/sql-store.ts";

type Row = {
  post_id: string;
  media_id: string;
  player_id: string;
  nickname: string;
  caption: string | null;
  frame: string;
  status: string;
  queued_at: number | null;
  shown_at: number | null;
  until_at: number | null;
  created_at: number;
  display_failed_at: number | null;
};

type Photo = {
  postId: string;
  mediaId: string;
  nickname: string;
  caption: string | null;
  frame: WallFrame;
};

/**
 * The `wall` section of a snapshot. Pending photos only reach the host and
 * their owner. Captions are left off the stage and other guests' view when
 * the host turns captions off.
 */
const EMPTY_MINE: NonNullable<WallSnapshot["mine"]> = Object.freeze(
  [],
) as unknown as NonNullable<WallSnapshot["mine"]>;
const EMPTY_ROWS: Row[] = [];

export type WallSnapshotShared = {
  settings: ReturnType<typeof readWallSettings>;
  mutedSet: Set<string>;
  rows: Row[];
  rowsByPlayer: Map<string, Row[]>;
  reactions: Map<string, Map<WallReaction, number>>;
  orderPos: Map<string, number>;
  waiting: number;
  showing: Row | undefined;
  podium: boolean;
  publicBase: WallSnapshot | null;
  guestEmptyWall: WallSnapshot | null;
};

export function prepareWallShared(sql: SqlStorage): WallSnapshotShared {
  const settings = readWallSettings(sql);
  const rows = sql
    .exec<Row>(
      `SELECT wall_post.post_id, wall_post.media_id, wall_post.player_id, player.nickname,
              wall_post.caption, wall_post.frame, wall_post.status, wall_post.queued_at,
              wall_post.shown_at, wall_post.until_at, wall_post.created_at,
              wall_post.display_failed_at
       FROM wall_post JOIN player ON player.player_id = wall_post.player_id
       ORDER BY wall_post.created_at`,
    )
    .toArray();
  const reactions = readReactions(sql);
  const order = queueOrder(rows);
  const orderPos = new Map<string, number>();
  for (let i = 0; i < order.length; i++) {
    orderPos.set(order[i]!, i + 1);
  }
  const rowsByPlayer = new Map<string, Row[]>();
  let showing: Row | undefined;
  for (const row of rows) {
    if (row.status === "showing" && !showing) showing = row;
    let list = rowsByPlayer.get(row.player_id);
    if (!list) {
      list = [];
      rowsByPlayer.set(row.player_id, list);
    }
    list.push(row);
  }
  const podium = createSqlStore(sql).readRoom().phase === "podium";
  return {
    settings,
    mutedSet: new Set(settings.muted),
    rows,
    rowsByPlayer,
    reactions,
    orderPos,
    waiting: order.length,
    showing,
    podium,
    publicBase: null,
    guestEmptyWall: null,
  };
}

function sendBlockFromShared(
  settings: WallSnapshotShared["settings"],
  mutedSet: Set<string>,
  mine: Row[],
  playerId: string,
  now: number,
): string | null {
  if (!settings.enabled) return wallClosedMessage;
  if (mutedSet.has(playerId)) return wallMutedMessage;
  let last = -Infinity;
  let waiting = 0;
  for (const row of mine) {
    if (row.created_at > last) last = row.created_at;
    if (row.status === "pending" || row.status === "queued") waiting += 1;
  }
  if (waiting >= wallWaitingPerPlayer) return wallWaitingMessage;
  if (last !== -Infinity && now - last < wallCooldownMs) return wallCooldownMessage;
  return null;
}

export function wallSnapshot(
  sql: SqlStorage,
  audience: "guest" | "stage" | "control",
  selfPlayerId: string | undefined,
  now: number,
  shared?: WallSnapshotShared,
): WallSnapshot {
  const settings = shared ? shared.settings : readWallSettings(sql);
  const rows = shared
    ? shared.rows
    : sql
        .exec<Row>(
          `SELECT wall_post.post_id, wall_post.media_id, wall_post.player_id, player.nickname,
                  wall_post.caption, wall_post.frame, wall_post.status, wall_post.queued_at,
                  wall_post.shown_at, wall_post.until_at, wall_post.created_at,
                  wall_post.display_failed_at
           FROM wall_post JOIN player ON player.player_id = wall_post.player_id
           ORDER BY wall_post.created_at`,
        )
        .toArray();
  const reactions = shared ? shared.reactions : readReactions(sql);
  const order = shared ? null : queueOrder(rows);
  const position = (postId: string) => {
    if (shared) return shared.orderPos.get(postId) ?? null;
    const index = order!.indexOf(postId);
    return index === -1 ? null : index + 1;
  };
  const showing = shared ? shared.showing : rows.find((row) => row.status === "showing");
  const photo = (row: Row, withCaption: boolean): Photo => ({
    postId: row.post_id,
    mediaId: row.media_id,
    nickname: row.nickname,
    caption: withCaption ? row.caption : null,
    frame: wallFrameSchema.catch("polaroid").parse(row.frame),
  });
  const publicCaptions = settings.captions || audience === "control";
  const isOwnerCaption = Boolean(showing && !publicCaptions && showing.player_id === selfPlayerId);
  const waitingCount = shared ? shared.waiting : order!.length;
  let base: WallSnapshot;
  if (shared && !isOwnerCaption && audience !== "control") {
    shared.publicBase ??= {
      enabled: settings.enabled,
      placement: settings.placement,
      now: showing
        ? {
            ...photo(showing, publicCaptions),
            untilAt: showing.until_at ?? now,
            reactions: reactionList(reactions.get(showing.post_id)),
          }
        : null,
      waiting: waitingCount,
    };
    base = shared.publicBase;
  } else {
    base = {
      enabled: settings.enabled,
      placement: settings.placement,
      now: showing
        ? {
            ...photo(showing, publicCaptions || showing.player_id === selfPlayerId),
            untilAt: showing.until_at ?? now,
            reactions: reactionList(reactions.get(showing.post_id)),
          }
        : null,
      waiting: waitingCount,
    };
  }
  if (audience === "stage") {
    const next = shared
      ? rows.find((row) => shared.orderPos.get(row.post_id) === 1)
      : (() => {
          const nextId = order![0];
          return nextId ? rows.find((row) => row.post_id === nextId) : undefined;
        })();
    const podium = shared ? shared.podium : createSqlStore(sql).readRoom().phase === "podium";
    const reel = podium
      ? readReel(sql).map((row) => ({
          mediaId: row.media_id,
          nickname: row.nickname,
          frame: wallFrameSchema.catch("polaroid").parse(row.frame),
        }))
      : [];
    return {
      ...base,
      next: next ? { mediaId: next.media_id } : null,
      ...(reel.length > 0 ? { reel } : {}),
    };
  }
  if (audience === "guest") {
    if (!selfPlayerId) {
      return base;
    }
    const mine: Row[] = shared
      ? (shared.rowsByPlayer.get(selfPlayerId) ?? EMPTY_ROWS)
      : rows.filter((row) => row.player_id === selfPlayerId);
    const blocked = shared
      ? sendBlockFromShared(settings, shared.mutedSet, mine, selfPlayerId, now)
      : wallSendBlock(sql, selfPlayerId, now);
    if (shared && mine.length === 0 && blocked === null && !isOwnerCaption) {
      shared.guestEmptyWall ??= {
        ...base,
        blocked: null,
        cooldownUntil: null,
        mine: EMPTY_MINE,
      };
      return shared.guestEmptyWall;
    }
    const last = mine.reduce(
      (latest, row) => Math.max(latest, row.created_at),
      -Infinity,
    );
    const cooldownUntil = last + wallCooldownMs > now ? last + wallCooldownMs : null;
    return {
      ...base,
      blocked,
      cooldownUntil,
      mine: mine.slice(-30).map((row) => ({
        postId: row.post_id,
        mediaId: row.media_id,
        caption: row.caption,
        frame: wallFrameSchema.catch("polaroid").parse(row.frame),
        status: row.status as NonNullable<WallSnapshot["mine"]>[number]["status"],
        position: row.status === "queued" ? position(row.post_id) : null,
        reactions: total(reactions.get(row.post_id)),
      })),
    };
  }
  const queue = rows
    .filter((row) => row.status === "pending" || row.status === "queued")
    .sort(
      (left, right) =>
        (position(left.post_id) ?? Infinity) - (position(right.post_id) ?? Infinity) ||
        left.created_at - right.created_at,
    )
    .map((row) => ({
      ...photo(row, true),
      playerId: row.player_id,
      status: row.status as "pending" | "queued",
      position: position(row.post_id),
    }));
  const recent = rows
    .filter(
      (row) =>
        row.status === "shown" || row.status === "declined" || row.status === "removed",
    )
    .slice(-30)
    .reverse()
    .map((row) => ({
      ...photo(row, true),
      playerId: row.player_id,
      status: row.status as "shown" | "declined" | "removed",
      reactions: total(reactions.get(row.post_id)),
      ...(row.display_failed_at !== null ? { displayFailed: true as const } : {}),
    }));
  // Host only: which photo the projector could not display.
  const hostNow =
    base.now && showing?.display_failed_at != null
      ? { ...base.now, displayFailed: true as const }
      : base.now;
  return {
    ...base,
    now: hostNow,
    queue: queue.slice(0, 300),
    recent,
    settings: {
      moderation: settings.moderation,
      showMs: settings.showMs,
      captions: settings.captions,
    },
    muted: settings.muted.slice(0, 100),
  };
}

/** The media id the stage may preload: the next approved photo in line. */
export function wallNextMediaId(sql: SqlStorage): string | null {
  const rows = sql
    .exec<Row>(
      `SELECT wall_post.post_id, wall_post.media_id, wall_post.player_id, '' AS nickname,
              NULL AS caption, wall_post.frame, wall_post.status, wall_post.queued_at,
              wall_post.shown_at, wall_post.until_at, wall_post.created_at,
              NULL AS display_failed_at
       FROM wall_post WHERE status IN ('queued', 'showing', 'shown')`,
    )
    .toArray();
  const next = queueOrder(rows)[0];
  return rows.find((row) => row.post_id === next)?.media_id ?? null;
}

/** Shown photos that are still visible, most loved first, for the podium reel. */
function readReel(sql: SqlStorage) {
  return sql
    .exec<{ media_id: string; nickname: string; frame: string }>(
      `SELECT wall_post.media_id, player.nickname, wall_post.frame
       FROM wall_post
       JOIN player ON player.player_id = wall_post.player_id
       JOIN media_upload ON media_upload.media_id = wall_post.media_id
       WHERE wall_post.status = 'shown' AND media_upload.hidden = 0
       ORDER BY COALESCE((SELECT SUM(count) FROM wall_reaction
                          WHERE wall_reaction.post_id = wall_post.post_id), 0) DESC,
                wall_post.shown_at
       LIMIT 40`,
    )
    .toArray();
}

function queueOrder(rows: Row[]): string[] {
  const lastShownAt: Record<string, number> = {};
  for (const row of rows) {
    if (row.shown_at !== null) {
      lastShownAt[row.player_id] = Math.max(
        lastShownAt[row.player_id] ?? 0,
        row.shown_at,
      );
    }
  }
  const showing = rows.find((row) => row.status === "showing");
  return wallQueueOrder(
    rows
      .filter((row) => row.status === "queued")
      .map((row) => ({
        postId: row.post_id,
        playerId: row.player_id,
        queuedAt: row.queued_at ?? 0,
      })),
    lastShownAt,
    showing?.player_id ?? null,
  );
}

function readReactions(sql: SqlStorage): Map<string, Map<WallReaction, number>> {
  const map = new Map<string, Map<WallReaction, number>>();
  for (const row of sql
    .exec<{ post_id: string; emoji: string; count: number }>(
      `SELECT post_id, emoji, count FROM wall_reaction`,
    )
    .toArray()) {
    if (!(wallReactions as readonly string[]).includes(row.emoji)) {
      continue;
    }
    const counts = map.get(row.post_id) ?? new Map<WallReaction, number>();
    counts.set(row.emoji as WallReaction, row.count);
    map.set(row.post_id, counts);
  }
  return map;
}

function reactionList(counts: Map<WallReaction, number> | undefined) {
  return wallReactions
    .map((reaction) => ({ reaction, count: counts?.get(reaction) ?? 0 }))
    .filter((item) => item.count > 0);
}

function total(counts: Map<WallReaction, number> | undefined): number {
  let sum = 0;
  for (const count of counts?.values() ?? []) {
    sum += count;
  }
  return sum;
}
