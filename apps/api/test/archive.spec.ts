import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type AppDatabase } from "../src/auth/create-database.ts";
import { archiveDelayMs } from "../src/archive/schedule.ts";
import { applyArchiveSchema } from "../src/archive/schema.ts";
import {
  postgresArchive,
  publicationCount,
  unavailableArchive,
  type ArchiveWriter,
} from "../src/archive/store.ts";
import type { ArchiveDocument } from "../src/archive/document.ts";

const gameId = "ARCHIVE15";
const privateRecap = "PRIVATE-RECAP-TOKEN";
const privateDevice = "PRIVATE-DEVICE-TOKEN";

describe("archive database", () => {
  let database: AppDatabase;
  let writer: ArchiveWriter;

  beforeAll(async () => {
    const env = {
      APP_ENV: "local" as const,
      DATABASE_URL: "",
      LOCAL_DATABASE_ID: "archive-contract",
    };
    database = await createDatabase(env);
    await applyArchiveSchema(database);
    writer = postgresArchive(database);
  });

  afterAll(async () => {
    await database.close();
  });

  it("applies version 1 twice and keeps one publication for a repeated key", async () => {
    await applyArchiveSchema(database);
    const document = sample(1, "final");
    expect(await writer.write(document)).toBe("stored");
    expect(await writer.write(document)).toBe("present");
    expect(await publicationCount(database.executor.query, gameId)).toBe(1);
  });

  it("keeps a committed row when the acknowledgement is lost", async () => {
    const inner = postgresArchive(database);
    let released = false;
    const flaky: ArchiveWriter = {
      async write(document) {
        const result = await inner.write(document);
        if (!released) {
          released = true;
          throw new Error("The acknowledgement was lost.");
        }
        return result;
      },
      purgeDeviceDetails: (nowMs) => inner.purgeDeviceDetails(nowMs),
      readPublic: (id) => inner.readPublic(id),
      readPersonal: (id, playerId) => inner.readPersonal(id, playerId),
    };
    const document = sample(2, "final", "ACKGAME15");
    await expect(flaky.write(document)).rejects.toThrow(/acknowledgement/);
    expect(await flaky.write(document)).toBe("present");
    expect(await publicationCount(database.executor.query, "ACKGAME15")).toBe(1);
  });

  it("rolls back when the write fails before commit", async () => {
    const document = sample(1, "final", "ROLLBACK1");
    document.standings.push({ ...document.standings[0]! });
    await expect(writer.write(document)).rejects.toThrow();
    expect(await publicationCount(database.executor.query, "ROLLBACK1")).toBe(0);
  });

  it("keeps personal and device rows out of the public projection", async () => {
    const id = "PUBLIC015";
    expect(await writer.write(sample(1, "final", id))).toBe("stored");
    const projected = JSON.stringify(await writer.readPublic(id));
    expect(projected).not.toContain(privateRecap);
    expect(projected).not.toContain(privateDevice);
    const detail = await database.executor.query(
      `SELECT detail_json FROM archive_player_detail WHERE game_id = $1`,
      [id],
    );
    expect(JSON.stringify(detail)).toContain(privateRecap);
  });

  it("stores a correction as a new revision and leaves the first one frozen", async () => {
    const id = "CORRECT15";
    const first = sample(1, "final", id);
    first.media[0]!.hidden = false;
    first.standings[0]!.points = 4;
    const second = sample(2, "correction", id);
    second.media[0]!.hidden = true;
    second.standings[0]!.points = 9;
    expect(await writer.write(first)).toBe("stored");
    expect(await writer.write(second)).toBe("stored");
    const latest = await writer.readPublic(id);
    expect(latest?.revision).toBe(2);
    expect(latest?.kind).toBe("correction");
    expect(latest?.media[0]?.hidden).toBe(true);
    expect(latest?.standings[0]?.points).toBe(9);
    const frozen = await database.executor.query(
      `SELECT points FROM archive_standing WHERE game_id = $1 AND revision = 1`,
      [id],
    );
    const hidden = await database.executor.query(
      `SELECT hidden FROM archive_media_ref WHERE game_id = $1 AND revision = 1`,
      [id],
    );
    expect(Number(frozen[0]?.points)).toBe(4);
    expect(hidden[0]?.hidden === true || hidden[0]?.hidden === "t").toBe(false);
  });

  it("removes expired device detail and keeps standings and facts", async () => {
    const id = "RETAIN015";
    const document = sample(1, "final", id);
    document.devices[0]!.retainUntil = new Date(0).toISOString();
    expect(await writer.write(document)).toBe("stored");
    expect(await writer.purgeDeviceDetails(Date.now())).toBeGreaterThan(0);
    const devices = await database.executor.query(
      `SELECT context_id FROM archive_device_detail WHERE game_id = $1`,
      [id],
    );
    const facts = await database.executor.query(
      `SELECT fact_id FROM archive_stat_fact WHERE game_id = $1`,
      [id],
    );
    const standings = await database.executor.query(
      `SELECT player_id FROM archive_standing WHERE game_id = $1`,
      [id],
    );
    expect(devices).toHaveLength(0);
    expect(facts).toHaveLength(1);
    expect(standings).toHaveLength(1);
  });

  it("refuses a write when the archive database is unavailable", async () => {
    await expect(
      unavailableArchive().write(sample(9, "final", "MISSING1")),
    ).rejects.toThrow(/unavailable/i);
    expect(await publicationCount(database.executor.query, "MISSING1")).toBe(0);
  });

  it("caps the export backoff", () => {
    expect(archiveDelayMs(1)).toBe(5_000);
    expect(archiveDelayMs(20)).toBe(15 * 60_000);
  });

  it("keeps database credentials out of the browser and the answer path", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const web = readFileSync(
      path.join(root, "apps/web/src/results/results-page.tsx"),
      "utf8",
    );
    const answers = readFileSync(
      path.join(root, "apps/api/src/questions/multiple-choice.ts"),
      "utf8",
    );
    expect(web).not.toContain("DATABASE_URL");
    expect(answers).not.toContain("settleArchive");
    expect(answers).not.toContain("@neondatabase/serverless");
  });
});

function sample(
  revision: number,
  kind: "final" | "correction",
  id = gameId,
): ArchiveDocument {
  return {
    gameId: id,
    revision,
    kind,
    questionSetVersion: "illustrative-1",
    completedAt: new Date(0).toISOString(),
    standings: [
      {
        playerId: "11111111-1111-4111-8111-111111111111",
        nickname: "Amina",
        position: 1,
        points: 4,
      },
    ],
    highlights: [],
    media: [
      {
        mediaId: "22222222-2222-4222-8222-222222222222",
        kind: "photo",
        nickname: "Amina",
        hidden: false,
      },
    ],
    players: [
      {
        playerId: "11111111-1111-4111-8111-111111111111",
        recap: [],
        scores: [{ questionId: "shape", points: 4, detail: privateRecap }],
        effects: { given: 0, received: 0 },
      },
    ],
    facts: [
      {
        id: "fact-1",
        scope: "game",
        scopeId: id,
        sourceRevision: revision,
        metric: "answers",
        grouping: "accepted",
        numerator: 1,
        denominator: 1,
        unknownCount: 0,
        display: "eligible",
        labels: [],
        parts: [],
      },
    ],
    devices: [
      {
        contextId: "33333333-3333-4333-8333-333333333333",
        playerId: "11111111-1111-4111-8111-111111111111",
        retainUntil: new Date(Date.now() + 86_400_000).toISOString(),
        reportJson: JSON.stringify({ note: privateDevice }),
      },
    ],
  };
}
