import type { NormalisedDeviceReport } from "@26/shared";
import { presentStats, type StatsSource } from "./aggregate.ts";
import {
  selectFunFacts,
  type FunFactSelection,
  type FunFactSource,
  type FunFactTraits,
} from "./fun-facts.ts";
import { readStatsSource } from "./source.ts";
import { trollDefinitions, type TrollKind } from "../troll/catalogue.ts";

export function readFunFactSelection(
  sql: SqlStorage,
  stats: StatsSource = readStatsSource(sql),
): FunFactSelection {
  const deviceFamilyHighlighted = (
    presentStats({ ...stats, complete: true }, "stage").highlights ?? []
  ).some((card) => card.factId.startsWith("device-family"));
  return selectFunFacts({
    ...readFunFactModel(sql),
    illustrative: stats.illustrative,
    deviceFamilyHighlighted,
  });
}

export function funFactTotal(sql: SqlStorage): number {
  return readFunFactSelection(sql).cards.length;
}

function readFunFactModel(
  sql: SqlStorage,
): Omit<FunFactSource, "illustrative" | "deviceFamilyHighlighted"> {
  const players = sql
    .exec<{
      player_id: string;
      nickname: string;
      client_class: string;
      driver_style: string | null;
    }>(
      `SELECT player_id, nickname, client_class, driver_style
       FROM player WHERE revoked_at IS NULL`,
    )
    .toArray();
  const reports = new Map(
    sql
      .exec<{ player_id: string; report_json: string }>(
        `SELECT player.player_id, context.report_json
         FROM player
         JOIN device_context AS context ON context.context_id = (
           SELECT latest.context_id FROM device_context AS latest
           WHERE latest.player_id = player.player_id
           ORDER BY latest.created_at DESC LIMIT 1
         )
         WHERE player.revoked_at IS NULL`,
      )
      .toArray()
      .map((row) => [row.player_id, traitsOf(row.report_json)]),
  );
  const clientClass = (
    value: string,
  ): FunFactSource["guests"][number]["clientClass"] =>
    value === "guest" || value === "host" || value === "test" || value === "synthetic"
      ? value
      : "test";
  return {
    guests: players.map((player) => ({
      playerId: player.player_id,
      nickname: player.nickname,
      clientClass: clientClass(player.client_class),
      traits: reports.get(player.player_id) ?? null,
      driverStyle: player.driver_style,
    })),
    trolls: sql
      .exec<{ actor_id: string; kind: string }>(
        `SELECT actor_id, kind FROM troll_effect WHERE refunded = 0`,
      )
      .toArray()
      .map((row) => ({ actorId: row.actor_id, label: trollLabel(row.kind) })),
    likes: sql
      .exec<{ voter_id: string; target_id: string }>(
        `SELECT voter_id, target_id FROM name_reaction WHERE reaction = 'like'`,
      )
      .toArray()
      .map((row) => ({ voterId: row.voter_id, targetId: row.target_id })),
    media: sql
      .exec<{ player_id: string; kind: string }>(
        `SELECT player_id, kind FROM media_upload
         WHERE status = 'accepted' AND purpose = 'round' AND media_id IS NOT NULL`,
      )
      .toArray()
      .flatMap((row) =>
        row.kind === "photo" || row.kind === "voice"
          ? [{ playerId: row.player_id, kind: row.kind }]
          : [],
      ),
    standings: summedStandings(sql),
  };
}

function summedStandings(sql: SqlStorage): { playerId: string; points: number }[] {
  const totals = new Map<string, number>();
  for (const row of sql
    .exec<{ player_id: string; points: number }>(
      `SELECT player_id, points FROM score_ledger`,
    )
    .toArray()) {
    totals.set(row.player_id, (totals.get(row.player_id) ?? 0) + row.points);
  }
  for (const row of sql
    .exec<{ player_id: string; points: number }>(
      `SELECT player_id, points FROM score_adjustment`,
    )
    .toArray()) {
    totals.set(row.player_id, (totals.get(row.player_id) ?? 0) + row.points);
  }
  return [...totals].map(([playerId, points]) => ({ playerId, points }));
}

function trollLabel(kind: string): string {
  if (kind in trollDefinitions) {
    return trollDefinitions[kind as TrollKind].label;
  }
  return kind;
}

function traitsOf(json: string): FunFactTraits | null {
  try {
    const report = JSON.parse(json) as Partial<NormalisedDeviceReport>;
    if (!report || typeof report !== "object") {
      return null;
    }
    return {
      colorScheme: report.presentation?.colorScheme ?? null,
      browser: report.browserFamily ?? null,
      os: report.osFamily ?? null,
      reducedMotion: report.presentation?.reducedMotion ?? null,
      orientation: report.orientation ?? null,
      pointer: report.input?.pointer ?? null,
      saveData: report.network?.saveData ?? null,
      screenGroup: report.screenGroup ?? null,
      deviceFamily: report.deviceFamily ?? null,
      language: report.locale?.languages?.[0] ?? null,
      timeZone: report.locale?.timeZone ?? null,
    };
  } catch {
    return null;
  }
}
