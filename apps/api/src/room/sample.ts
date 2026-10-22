import { acceptDeviceReport } from "../device/store.ts";
import { syncWall } from "../wall/queue.ts";
import { sampleRoomBusyMessage } from "./limits.ts";

/**
 * Sample data for a fresh room, so the host can see what every admin page
 * looks like before a real party: guests with a mix of devices, scores,
 * connection stats, troll history and photo wall posts in every state.
 *
 * Only a room with no players can be filled, so a real party is never touched.
 * Sample guests are ordinary players in that room; delete the room to remove
 * them. The images are already in R2 (the route copies shipped pictures).
 */
export type SampleMedia = {
  mediaId: string;
  finalKey: string;
  contentType: string;
  byteLength: number;
};

const devices = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
} as const;

/** Twelve guests: enough in each device group for the 5-player comparisons. */
const guests: { nickname: string; device: keyof typeof devices; dark: boolean; points: number[] }[] = [
  { nickname: "Amina", device: "iphone", dark: true, points: [100, 80, 120] },
  { nickname: "Bilal", device: "android", dark: true, points: [60, 100, 40] },
  { nickname: "Chen", device: "iphone", dark: false, points: [100, 100, 100] },
  { nickname: "Dee", device: "iphone", dark: true, points: [20, 0, 60] },
  { nickname: "Ezra", device: "android", dark: false, points: [80, 40, 100] },
  { nickname: "Farah", device: "iphone", dark: true, points: [100, 60, 80] },
  { nickname: "Gio", device: "desktop", dark: false, points: [40, 20, 0] },
  { nickname: "Hana", device: "android", dark: true, points: [100, 120, 60] },
  { nickname: "Imran", device: "iphone", dark: true, points: [0, 80, 40] },
  { nickname: "Jo", device: "android", dark: false, points: [60, 60, 60] },
  { nickname: "Kofi", device: "iphone", dark: true, points: [80, 100, 120] },
  { nickname: "Lena", device: "android", dark: true, points: [40, 0, 20] },
];

/** [actor, target, kind, how it ended] by guest index. */
const trolls: [number, number, string, "expired" | "cancelled" | "refunded"][] = [
  [1, 0, "confetti", "expired"],
  [3, 2, "netanyahu", "expired"],
  [4, 0, "call", "expired"],
  [6, 10, "bubble-wrap", "expired"],
  [8, 5, "temp-nickname", "expired"],
  [11, 7, "confetti", "expired"],
  [2, 9, "reshuffle", "expired"],
  [0, 1, "australia", "cancelled"],
  [9, 3, "airdrop", "expired"],
  [5, 11, "dvd", "refunded"],
  [7, 4, "confetti", "expired"],
];

/** [guest index, caption, frame, status, reactions as emoji:count]. */
const wallPosts: [number, string | null, string, "shown" | "queued" | "pending", Record<string, number>][] = [
  [0, "Happy birthday Humza!", "birthday", "shown", { fire: 9, love: 6, clap: 3 }],
  [4, "Caught in the act", "wanted", "shown", { laugh: 4, skull: 2 }],
  [7, "The best one yet", "polaroid", "shown", { love: 2 }],
  [2, "Cake o'clock", "tabloid", "queued", {}],
  [10, null, "magazine", "queued", {}],
  [5, "Is this allowed?", "museum", "pending", {}],
  [9, "Dance floor chaos", "vhs", "pending", {}],
];

export const sampleWallPostCount = wallPosts.length;

export function seedSampleRoom(sql: SqlStorage, media: readonly SampleMedia[], now: number): number {
  const existing = sql
    .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM player WHERE revoked_at IS NULL`)
    .toArray()[0]?.total ?? 0;
  if (existing > 0) {
    throw new Error(sampleRoomBusyMessage);
  }
  const joinedAt = new Date(now - 45 * 60_000).toISOString();
  const ids = guests.map((guest) => {
    const playerId = crypto.randomUUID();
    sql.exec(
      `INSERT INTO player (
         player_id, nickname, nickname_key, revoked_at, device_context_id,
         device_context_version, client_class, joined_at
       ) VALUES (?, ?, ?, NULL, NULL, NULL, 'guest', ?)`,
      playerId,
      guest.nickname,
      guest.nickname.toLowerCase(),
      joinedAt,
    );
    acceptDeviceReport(
      sql,
      playerId,
      {
        userAgent: devices[guest.device],
        screen: guest.device === "desktop" ? { width: 1920, height: 1080 } : { width: 393, height: 852 },
        viewport: guest.device === "desktop" ? { width: 1536, height: 864 } : { width: 393, height: 760 },
        pixelRatio: guest.device === "desktop" ? 1.25 : 3,
        colorScheme: guest.dark ? "dark" : "light",
        reducedMotion: "no-preference",
        effectiveType: "4g",
        languages: ["en-GB"],
        timeZone: "Europe/London",
      },
      "initial",
      now,
    );
    return playerId;
  });

  guests.forEach((guest, index) => {
    guest.points.forEach((points, round) => {
      sql.exec(
        `INSERT INTO score_ledger (question_id, player_id, points, detail, created_at)
         VALUES (?, ?, ?, 'sample', ?)`,
        `sample-${round + 1}`,
        ids[index],
        points,
        now - (3 - round) * 8 * 60_000,
      );
    });
    const reconnects = index === 6 ? 7 : index % 4;
    const median = 40 + ((index * 37) % 160);
    sql.exec(
      `INSERT INTO connection_summary (
         player_id, socket_opens, reconnects, rtt_count, rtt_samples_json,
         rtt_median_ms, rtt_upper_ms, submission_retries, upload_attempts,
         upload_failures, upload_duration_ms, upload_duration_count, script_errors,
         last_script_error, last_script_error_at
       ) VALUES (?, ?, ?, 8, ?, ?, ?, ?, 2, ?, 2400, 2, ?, ?, ?)`,
      ids[index],
      reconnects + 1,
      reconnects,
      JSON.stringify([median - 10, median, median + 25]),
      median,
      median + 60,
      index % 3,
      index === 6 ? 1 : 0,
      index === 6 ? 2 : 0,
      index === 6 ? "Sample: Cannot read properties of undefined (reading 'value')" : null,
      index === 6 ? new Date(now - 5 * 60_000).toISOString() : null,
    );
  });

  trolls.forEach(([actor, target, kind, status], index) => {
    const createdAt = now - (40 - index * 3) * 60_000;
    sql.exec(
      `INSERT INTO troll_effect (
         effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
         phase_generation, created_at, started_at, expires_at, refunded
       ) VALUES (?, ?, ?, ?, 'transient', ?, 0, 'collect', 1, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      ids[actor],
      ids[target],
      kind,
      status === "refunded" ? "expired" : status,
      createdAt,
      status === "refunded" ? null : createdAt,
      createdAt + 8_000,
      status === "refunded" ? 1 : 0,
    );
  });

  wallPosts.forEach(([guest, caption, frame, status, reactions], index) => {
    const item = media[index % media.length];
    if (!item) return;
    const playerId = ids[guest]!;
    const createdAt = now - (30 - index * 3) * 60_000;
    sql.exec(
      `INSERT INTO media_upload (
         upload_id, request_id, player_id, kind, question_index, temp_key, final_key,
         media_id, status, attempts, created_at, byte_length, content_type, hidden, purpose
       ) VALUES (?, ?, ?, 'photo', 0, ?, ?, ?, 'accepted', 1, ?, ?, ?, 0, 'wall')`,
      crypto.randomUUID(),
      crypto.randomUUID(),
      playerId,
      item.finalKey.replace(/^accepted\//, "tmp/"),
      item.finalKey,
      item.mediaId,
      createdAt,
      item.byteLength,
      item.contentType,
    );
    const postId = crypto.randomUUID();
    sql.exec(
      `INSERT INTO wall_post (
         post_id, media_id, player_id, caption, frame, keep, status,
         queued_at, shown_at, decided_by, created_at
       ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      postId,
      item.mediaId,
      playerId,
      caption,
      frame,
      status,
      status === "pending" ? null : createdAt + 30_000,
      status === "shown" ? createdAt + 60_000 : null,
      status === "pending" ? null : "host",
      createdAt,
    );
    for (const [emoji, count] of Object.entries(reactions)) {
      sql.exec(
        `INSERT INTO wall_reaction (post_id, emoji, count) VALUES (?, ?, ?)`,
        postId,
        emoji,
        count,
      );
    }
  });

  // Starts the next queued photo, as a real approval would.
  syncWall(sql, "tick", now);
  sql.exec(`UPDATE room SET state_version = state_version + 1`);
  return ids.length;
}
