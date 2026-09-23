import { earliestDueAt } from "./sql-store.ts";

/**
 * The only module that arms or clears the room alarm.
 *
 * `transactionSync` is synchronous. `setAlarm` returns a promise, so it cannot
 * run inside `transactionSync`. Alarm writes belong to the storage
 * transaction: on SQLite, SQL statements inside `storage.transaction` join
 * that transaction, and `setAlarm` / `deleteAlarm` on the transaction object
 * are storage writes. The callback therefore commits the job and the wakeup
 * together. If the alarm write throws, the job insert rolls back, and an
 * idle room is not left with a saved deadline and no alarm.
 */
export type ScheduleStorage = {
  readonly sql: SqlStorage;
  transaction<T>(
    closure: (txn: {
      setAlarm(scheduledTime: number): Promise<void>;
      deleteAlarm(): Promise<void>;
    }) => Promise<T>,
  ): Promise<T>;
};

export async function commitAndArm(
  storage: ScheduleStorage,
  apply: (sql: SqlStorage) => void,
): Promise<void> {
  await storage.transaction(async (txn) => {
    apply(storage.sql);
    const due = earliestDueAt(storage.sql);
    if (due === null) {
      await txn.deleteAlarm();
      return;
    }
    await txn.setAlarm(due);
  });
}
