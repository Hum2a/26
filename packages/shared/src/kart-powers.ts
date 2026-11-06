import { z } from "zod";
import type { DrivingBody } from "./kart-driving.ts";
export const kartLegacyItems = ["turbo", "shield", "oil"] as const;
export const kartProjectileKinds = ["tennis", "bomb", "homing"] as const;
export const kartLegacyItemSchema = z.enum(kartLegacyItems);
export const kartItemSchema = z.enum([
  ...kartLegacyItems,
  ...kartProjectileKinds,
  "treat",
]);
export type KartItem = z.infer<typeof kartItemSchema>;
export const kartItemNames: Record<KartItem, string> = {
  turbo: "Turbo",
  shield: "Bubble shield",
  oil: "Oil slick",
  tennis: "Tennis ball",
  bomb: "Bomb",
  homing: "Homing bolt",
  treat: "Treats boost",
};
export function legacyKartItem(item: KartItem | null | undefined) {
  return item === "turbo" || item === "shield" || item === "oil" ? item : null;
}
export type ItemBox = { id: string; x: number; z: number };
export type OilSlick = {
  id: string;
  owner: string;
  x: number;
  z: number;
  createdAt: number;
  expiresAt: number;
};
export type KartPowers = {
  item: KartItem | null;
  collections: number;
  cooldowns: Record<string, number>;
  turboUntil: number;
  shieldUntil: number;
  slowedUntil: number;
  hits: string[];
  /** Active-time damage grace for the expanded item rules, absent in older races. */
  damageUntil?: number;
};
export const createKartPowers = (): KartPowers => ({
  item: null,
  collections: 0,
  cooldowns: {},
  turboUntil: 0,
  shieldUntil: 0,
  slowedUntil: 0,
  hits: [],
});
/** Shared item damage outcome. The caller applies the existing driving slowdown. */
export function applyKartItemHit(prior: KartPowers, now: number) {
  if (!Number.isSafeInteger(now) || now < 0) throw new RangeError("Invalid item time");
  if ((prior.damageUntil ?? 0) > now)
    return { powers: prior, hit: false, absorbed: false, immune: true };
  const powers = {
    ...prior,
    cooldowns: { ...prior.cooldowns },
    hits: [...prior.hits],
    damageUntil: now + 300,
  };
  if (prior.shieldUntil > now) {
    powers.shieldUntil = 0;
    return { powers, hit: false, absorbed: true, immune: false };
  }
  powers.slowedUntil = Math.max(prior.slowedUntil, now + 1600);
  powers.turboUntil = 0;
  return { powers, hit: true, absorbed: false, immune: false };
}
export const ringItemBoxes: readonly ItemBox[] = Array.from(
  { length: 6 },
  (_, station) =>
    [39, 42, 45].map((r, lane) => {
      const a = Math.PI / 8 + (station * Math.PI) / 3;
      return { id: station + "-" + lane, x: Math.cos(a) * r, z: Math.sin(a) * r };
    }),
).flat();
export const soloItemBoxes: readonly ItemBox[] = [-16, -36, -56].map((z, i) => ({
  id: "solo-" + i,
  x: 0,
  z,
}));
function nearSegment(
  from: { x: number; z: number },
  to: { x: number; z: number },
  target: { x: number; z: number },
  radius: number,
) {
  const dx = to.x - from.x,
    dz = to.z - from.z,
    t = Math.max(
      0,
      Math.min(
        1,
        ((target.x - from.x) * dx + (target.z - from.z) * dz) /
          (dx * dx + dz * dz || 1),
      ),
    );
  return Math.hypot(from.x + t * dx - target.x, from.z + t * dz - target.z) <= radius;
}
/** Swept collection/hits; all times are active simulation milliseconds. */
export function stepKartPowers(
  prior: KartPowers,
  owner: string,
  from: { x: number; z: number },
  to: { x: number; z: number },
  boxes: readonly ItemBox[],
  oils: readonly OilSlick[],
  now: number,
  seed: string,
  options?: { allowed: readonly KartItem[]; damageGrace: boolean },
): { powers: KartPowers; hit: boolean } {
  const next = {
    ...prior,
    cooldowns: { ...prior.cooldowns },
    hits: prior.hits.filter((id) => oils.some((o) => o.id === id && o.expiresAt > now)),
  };
  const allowed = options?.allowed ?? kartLegacyItems;
  if (!next.item && allowed.length)
    for (const box of boxes) {
      if ((next.cooldowns[box.id] ?? 0) > now || !nearSegment(from, to, box, 2.2))
        continue;
      let hash = 0;
      for (const c of seed) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
      next.item = allowed[(hash + next.collections) % allowed.length]!;
      next.collections++;
      next.cooldowns[box.id] = now + 8000;
      break;
    }
  let hit = false;
  for (const oil of oils) {
    if (
      oil.createdAt > now ||
      oil.expiresAt <= now ||
      next.hits.includes(oil.id) ||
      (oil.owner === owner && now - oil.createdAt < 750) ||
      !nearSegment(from, to, oil, 2)
    )
      continue;
    next.hits.push(oil.id);
    if (options?.damageGrace) {
      const outcome = applyKartItemHit(next, now);
      Object.assign(next, outcome.powers);
      hit ||= outcome.hit;
      continue;
    }
    if (next.shieldUntil > now) next.shieldUntil = 0;
    else {
      next.slowedUntil = now + 1600;
      next.turboUntil = 0;
      hit = true;
    }
  }
  return { powers: next, hit };
}
export function useKartPower(
  prior: KartPowers,
  owner: string,
  pose: { x: number; z: number; heading: number },
  now: number,
): { powers: KartPowers; oil?: OilSlick } | undefined {
  if (
    !prior.item ||
    (prior.item !== "turbo" &&
      prior.item !== "shield" &&
      prior.item !== "oil" &&
      prior.item !== "treat")
  )
    return;
  const powers = { ...prior, item: null };
  if (prior.item === "turbo") powers.turboUntil = now + 1200;
  if (prior.item === "treat") powers.turboUntil = Math.max(prior.turboUntil, now + 600);
  if (prior.item === "shield") powers.shieldUntil = now + 5000;
  return {
    powers,
    ...(prior.item === "oil"
      ? {
          oil: {
            id: owner + ":" + prior.collections + ":" + now,
            owner,
            x: pose.x - Math.cos(pose.heading) * 3,
            z: pose.z - Math.sin(pose.heading) * 3,
            createdAt: now,
            expiresAt: now + 8000,
          },
        }
      : {}),
  };
}
export function powerDrivingBody(
  body: DrivingBody,
  powers: KartPowers,
  now: number,
): DrivingBody {
  return powers.turboUntil > now && powers.slowedUntil <= now
    ? {
        ...body,
        boostMs: Math.max(body.boostMs, Math.min(1200, powers.turboUntil - now)),
      }
    : body;
}
export const kartPowerViewSchema = z
  .object({
    selfItem: kartLegacyItemSchema.nullable(),
    boxes: z
      .array(
        z
          .object({
            id: z.string(),
            x: z.number(),
            z: z.number(),
            available: z.boolean(),
          })
          .strict(),
      )
      .max(24),
    oils: z
      .array(
        z
          .object({
            id: z.string(),
            owner: z.string(),
            x: z.number(),
            z: z.number(),
            createdAt: z.number(),
            expiresAt: z.number(),
          })
          .strict(),
      )
      .max(64),
    effects: z
      .array(
        z
          .object({
            playerId: z.string(),
            shieldMs: z.number().nonnegative(),
            slowedMs: z.number().nonnegative(),
            turboMs: z.number().nonnegative(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
