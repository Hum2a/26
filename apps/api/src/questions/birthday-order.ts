import {
  birthdayOrderSchema,
  saveBirthdayOrderSchema,
  type BirthdayOrder,
} from "@26/shared";
import { birthdayPack } from "./packs/birthday/manifest.ts";
import { toPlayable } from "./authoring.ts";
import { validatePack } from "./validate.ts";
import type { Question } from "./definition.ts";

export function validateBirthdayOrder(ids: readonly string[]): Question[] {
  const parsed = birthdayOrderSchema.shape.ids.safeParse(ids);
  if (!parsed.success || new Set(ids).size !== ids.length)
    throw new Error("Choose 1–80 different rounds.");
  const byId = new Map(birthdayPack.catalogue.map((q) => [q.id, q]));
  const problems = validatePack({ ...birthdayPack, order: [...ids] }).filter(
    (issue) => issue.level === "error",
  );
  if (problems.length) throw new Error(problems[0]!.message);
  return ids.map((id) => {
    const question = toPlayable(byId.get(id), false);
    if (!question) throw new Error(`Round ${id} is not ready.`);
    return question;
  });
}

export function readBirthdayOrder(sql: SqlStorage): BirthdayOrder {
  const row = sql
    .exec<{ payload: string }>("SELECT payload FROM pack_order WHERE id = 'birthday'")
    .toArray()[0];
  return row
    ? birthdayOrderSchema.parse(JSON.parse(row.payload))
    : { revision: 0, ids: [...birthdayPack.order], updatedAt: null, history: [] };
}

/** Called within the registry's synchronous transaction, including the receipt. */
export function saveBirthdayOrder(
  sql: SqlStorage,
  raw: unknown,
  now: number,
): BirthdayOrder {
  const input = saveBirthdayOrderSchema.parse(raw);
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid save time.");
  validateBirthdayOrder(input.ids);
  const current = readBirthdayOrder(sql);
  if (current.revision !== input.expectedRevision)
    throw new Error("The running order changed in another tab. Refresh before saving.");
  const revision = current.revision + 1;
  const result: BirthdayOrder = {
    revision,
    ids: input.ids,
    updatedAt: now,
    history: [...current.history, { revision, at: now, count: input.ids.length }].slice(
      -20,
    ),
  };
  sql.exec(
    "INSERT INTO pack_order (id, payload) VALUES ('birthday', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    JSON.stringify(result),
  );
  return result;
}

export type BirthdayScript = {
  version: string;
  revision: number;
  questions: Question[];
};
export async function freezeBirthdayOrder(
  order: BirthdayOrder,
): Promise<BirthdayScript> {
  const questions = validateBirthdayOrder(order.ids);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(questions)),
  );
  const hash = [...new Uint8Array(digest)]
    .slice(0, 10)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    version: `birthday-r${order.revision}-${hash}`,
    revision: order.revision,
    questions,
  };
}
