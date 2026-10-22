import type { FunFactCard, StatCard } from "@26/shared";
import { aggregateFacts, presentStats, type StatFact } from "../stats/aggregate.ts";
import { readFunFactSelection } from "../stats/fun-source.ts";
import { readStatsSource } from "../stats/source.ts";

export type ArchiveKind = "final" | "correction";

export type ArchiveStanding = {
  playerId: string;
  nickname: string;
  position: number;
  points: number;
};

export type ArchiveMediaRef = {
  mediaId: string;
  kind: string;
  nickname: string;
  hidden: boolean;
};

export type ArchivePlayerDetail = {
  playerId: string;
  recap: StatCard[];
  scores: { questionId: string; points: number; detail: string }[];
  effects: { given: number; received: number };
};

export type ArchiveDeviceDetail = {
  contextId: string;
  playerId: string;
  retainUntil: string;
  reportJson: string;
};

export type ArchiveFunFact = {
  card: FunFactCard;
  memberIds: string[];
};

/** One immutable export. Personal rows and device rows are not part of the public read. */
export type ArchiveDocument = {
  gameId: string;
  revision: number;
  kind: ArchiveKind;
  questionSetVersion: string;
  completedAt: string;
  standings: ArchiveStanding[];
  highlights: StatCard[];
  funFacts: ArchiveFunFact[];
  media: ArchiveMediaRef[];
  players: ArchivePlayerDetail[];
  facts: StatFact[];
  devices: ArchiveDeviceDetail[];
};

export type PersonalArchive = {
  playerId: string;
  nickname: string;
  position: number;
  points: number;
  recap: StatCard[];
  scores: ArchivePlayerDetail["scores"];
  effects: ArchivePlayerDetail["effects"];
  funFacts: (FunFactCard & { appliesToYou: boolean })[];
};

export type PublicArchive = {
  gameId: string;
  revision: number;
  kind: ArchiveKind;
  questionSetVersion: string;
  standings: ArchiveStanding[];
  highlights: StatCard[];
  funFacts: FunFactCard[];
  media: ArchiveMediaRef[];
};

export function readArchiveDocument(
  sql: SqlStorage,
  input: {
    revision: number;
    kind: ArchiveKind;
    now: number;
    includeDevices: boolean;
  },
): ArchiveDocument {
  const room = sql
    .exec<{
      game_id: string;
      question_set_version: string;
      created_at: string;
      days: number;
    }>(
      `SELECT game_id, question_set_version, created_at, telemetry_retention_days AS days
       FROM room`,
    )
    .toArray()[0];
  if (!room) {
    throw new Error("This room does not exist.");
  }
  const source = readStatsSource(sql);
  const guests = new Set(
    source.players
      .filter((player) => player.clientClass === "guest")
      .map((player) => player.playerId),
  );
  const totals = new Map<string, number>();
  for (const player of source.players) {
    if (guests.has(player.playerId)) {
      totals.set(player.playerId, 0);
    }
  }
  for (const score of source.scores) {
    if (!totals.has(score.playerId)) {
      continue;
    }
    totals.set(score.playerId, (totals.get(score.playerId) ?? 0) + score.points);
  }
  const ranked = source.players
    .filter((player) => guests.has(player.playerId))
    .map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
      points: totals.get(player.playerId) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.points - left.points || left.nickname.localeCompare(right.nickname),
    );
  let position = 0;
  let previous: number | null = null;
  const standings: ArchiveStanding[] = ranked.map((player, index) => {
    if (previous === null || player.points !== previous) {
      position = index + 1;
      previous = player.points;
    }
    return { ...player, position };
  });
  const highlights =
    presentStats({ ...source, complete: true }, "stage").highlights ?? [];
  const funFacts = readFunFactSelection(sql);
  const scores = sql
    .exec<{ question_id: string; player_id: string; points: number; detail: string }>(
      `SELECT question_id, player_id, points, detail FROM score_ledger`,
    )
    .toArray();
  const effects = sql
    .exec<{ effect_id: string; actor_id: string; target_id: string; refunded: number }>(
      `SELECT effect_id, actor_id, target_id, refunded FROM troll_effect`,
    )
    .toArray();
  const seenEffects = new Set<string>();
  const given = new Map<string, number>();
  const received = new Map<string, number>();
  for (const effect of effects) {
    if (effect.refunded === 1 || seenEffects.has(effect.effect_id)) {
      continue;
    }
    seenEffects.add(effect.effect_id);
    if (guests.has(effect.actor_id)) {
      given.set(effect.actor_id, (given.get(effect.actor_id) ?? 0) + 1);
    }
    if (guests.has(effect.target_id) && effect.actor_id !== effect.target_id) {
      received.set(effect.target_id, (received.get(effect.target_id) ?? 0) + 1);
    }
  }
  const players: ArchivePlayerDetail[] = [...guests].map((playerId) => ({
    playerId,
    recap: presentStats(source, "recap", playerId).recap ?? [],
    scores: scores
      .filter((row) => row.player_id === playerId)
      .map((row) => ({
        questionId: row.question_id,
        points: row.points,
        detail: row.detail,
      })),
    effects: {
      given: given.get(playerId) ?? 0,
      received: received.get(playerId) ?? 0,
    },
  }));
  const media = sql
    .exec<{ media_id: string; kind: string; nickname: string; hidden: number }>(
      `SELECT media_upload.media_id, media_upload.kind, player.nickname, media_upload.hidden
       FROM media_upload
       JOIN player ON player.player_id = media_upload.player_id
       WHERE media_upload.status = 'accepted'
         AND media_upload.media_id IS NOT NULL
         AND (
           media_upload.purpose = 'round'
           OR (
             -- Photo wall: only photos that were shown and the guest chose to keep.
             media_upload.purpose = 'wall'
             AND EXISTS (
               SELECT 1 FROM wall_post
               WHERE wall_post.media_id = media_upload.media_id
                 AND wall_post.status = 'shown'
                 AND wall_post.keep = 1
             )
           )
         )
         AND player.client_class = 'guest'`,
    )
    .toArray()
    .map((row) => ({
      mediaId: row.media_id,
      kind: row.kind,
      nickname: row.nickname,
      hidden: row.hidden === 1,
    }));
  const retainUntil = new Date(
    Date.parse(room.created_at) + room.days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const devices = input.includeDevices
    ? sql
        .exec<{ context_id: string; player_id: string; report_json: string }>(
          `SELECT context_id, player_id, report_json FROM device_context`,
        )
        .toArray()
        .filter((row) => guests.has(row.player_id))
        .map((row) => ({
          contextId: row.context_id,
          playerId: row.player_id,
          retainUntil,
          reportJson: row.report_json,
        }))
    : [];
  return {
    gameId: room.game_id,
    revision: input.revision,
    kind: input.kind,
    questionSetVersion: room.question_set_version,
    completedAt: new Date(input.now).toISOString(),
    standings,
    highlights,
    funFacts: funFacts.facts.map((fact, index) => ({
      card: funFacts.cards[index]!,
      memberIds: fact.memberIds,
    })),
    media,
    players,
    facts: aggregateFacts(source).filter((fact) => fact.scope !== "player"),
    devices,
  };
}
