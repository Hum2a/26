import { presentBinding } from "../auth/bindings.ts";
import { openDatabase } from "../auth/create-database.ts";
import { archiveExportJobId, archiveRetainJobId } from "../room/lifecycle.ts";
import { commitAndArm, type ScheduleStorage } from "../room/scheduler.ts";
import { readArchiveDocument } from "./document.ts";
import { sqliteMirror } from "./mirror.ts";
import {
  archiveJobDue,
  markArchiveRetry,
  markArchiveStored,
  markRetainDone,
  markRetainRetry,
  readRoomArchive,
} from "./schedule.ts";
import { postgresArchive, unavailableArchive, type ArchiveWriter } from "./store.ts";

export async function archiveWriterFor(
  env: { APP_ENV?: string; DATABASE_URL?: string },
  storage: ScheduleStorage,
): Promise<ArchiveWriter> {
  const databaseUrl = presentBinding(env.DATABASE_URL);
  if (databaseUrl) {
    const appEnv =
      env.APP_ENV === "staging" || env.APP_ENV === "production" ? env.APP_ENV : "local";
    const database = await openDatabase({
      APP_ENV: appEnv,
      DATABASE_URL: databaseUrl,
    });
    return postgresArchive(database);
  }
  if (env.APP_ENV === "local") {
    return sqliteMirror(storage);
  }
  return unavailableArchive();
}

/**
 * Runs after the room alarm has committed gameplay. A database failure here
 * reschedules the export and does not roll back the podium.
 */
export async function settleArchive(input: {
  storage: ScheduleStorage;
  env: { APP_ENV?: string; DATABASE_URL?: string };
  now: number;
  writer?: ArchiveWriter;
}): Promise<void> {
  await settleRetain(input);
  await settleExport(input);
}

async function settleRetain(input: {
  storage: ScheduleStorage;
  env: { APP_ENV?: string; DATABASE_URL?: string };
  now: number;
  writer?: ArchiveWriter;
}): Promise<void> {
  if (!archiveJobDue(input.storage.sql, archiveRetainJobId, input.now)) {
    return;
  }
  try {
    const writer = input.writer ?? (await archiveWriterFor(input.env, input.storage));
    await writer.purgeDeviceDetails(input.now);
    await commitAndArm(input.storage, (sql) => {
      markRetainDone(sql);
    });
  } catch {
    await commitAndArm(input.storage, (sql) => {
      markRetainRetry(sql, input.now);
    }).catch(() => undefined);
  }
}

async function settleExport(input: {
  storage: ScheduleStorage;
  env: { APP_ENV?: string; DATABASE_URL?: string };
  now: number;
  writer?: ArchiveWriter;
}): Promise<void> {
  if (!archiveJobDue(input.storage.sql, archiveExportJobId, input.now)) {
    return;
  }
  const row = readRoomArchive(input.storage.sql);
  if (!row || row.status !== "pending") {
    return;
  }
  try {
    const document = readArchiveDocument(input.storage.sql, {
      revision: row.targetRevision,
      kind: row.kind,
      now: input.now,
      includeDevices: row.verifiedRevision === null,
    });
    const writer = input.writer ?? (await archiveWriterFor(input.env, input.storage));
    await writer.write(document);
    await commitAndArm(input.storage, (sql) => {
      markArchiveStored(sql, row.targetRevision, input.now);
    });
  } catch {
    await commitAndArm(input.storage, (sql) => {
      markArchiveRetry(sql, input.now);
    }).catch(() => undefined);
  }
}
