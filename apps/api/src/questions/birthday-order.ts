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
  if (!row)
    return { revision: 0, ids: [...birthdayPack.order], updatedAt: null, history: [] };
  const saved = birthdayOrderSchema.parse(JSON.parse(row.payload));
  // Apply the owner's explicit removals to future starts, never to frozen room scripts.
  // Keep the stored revision until the host explicitly saves their revised order.
  const retired =
    /^(?:who-said-it-|subculture-|council-|trolley-your-mum$|trolley-mamdani-africa$|trolley-freddo-multiverse$|ai-turing-test$|tribunal-reddit$)/;
  const ids = saved.ids.filter((id) => !retired.test(id));
  return {
    ...saved,
    ids: ids.length ? restoreSavedOrder(ids, saved.updatedAt) : [...birthdayPack.order],
  };
}

/**
 * The two bracket rounds were left out of the order while a knockout of 80
 * entries took about 25 minutes. The phone round (20 November 2026) fixed
 * that, so an order saved before then gets each one back after the round it
 * follows in the default order, when that round is in the saved order.
 * Likewise, `best-dressed` was added on 20 November 2026 as the finale after
 * `kart-sprint`, so an order saved before this restoration gets it back at the
 * end if it is missing (ignoring synthetic pre-2026 test timestamps). An order
 * the host saves afterwards is taken as their choice and left alone. A full
 * order stays within the saved order's 80-round limit (`birthdayOrderSchema`),
 * so it can still be saved and started.
 */
const maxOrderRounds = 80;
const firstSavedOrderAt = Date.UTC(2026, 0, 1);
const bracketsRestoredAt = Date.UTC(2026, 10, 20, 2, 28);
const bestDressedRestoredAt = Date.UTC(2026, 10, 21, 14, 8);
const restoredBrackets = [
  { id: "apology-video-auction", after: "mock-election" },
  { id: "heathrow-search-query", after: "guess-airport-lounge" },
] as const;

function restoreSavedOrder(ids: string[], updatedAt: number | null): string[] {
  const next = [...ids];
  if (updatedAt === null || updatedAt < bracketsRestoredAt) {
    for (const { id, after } of restoredBrackets) {
      if (next.includes(id) || next.length >= maxOrderRounds) continue;
      const anchor = next.indexOf(after);
      if (anchor >= 0) next.splice(anchor + 1, 0, id);
    }
  }
  if (
    (updatedAt === null ||
      (updatedAt >= firstSavedOrderAt && updatedAt < bestDressedRestoredAt)) &&
    !next.includes("best-dressed") &&
    next.length < maxOrderRounds
  ) {
    next.push("best-dressed");
  }
  return next;
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
