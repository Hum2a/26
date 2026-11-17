import type { KartHit, KartRaceView } from "@26/shared";

/** The landed items the room sent with this frame (item rules v2 only). */
export function raceHits(race: KartRaceView | undefined): readonly KartHit[] {
  const presentation = race?.presentation;
  return presentation?.version === 3 ? (presentation.items.hits ?? []) : [];
}

const itemWords: Record<string, string> = {
  tennis: "tennis ball",
  bomb: "bomb",
  homing: "homing bolt",
  oil: "oil slick",
};

/** "tennis ball", or a plain "item" for anything without a friendly name. */
export function itemWord(item: string | undefined): string {
  return (item && itemWords[item]) ?? "item";
}

function nameOf(race: KartRaceView, playerId: string | undefined): string {
  if (!playerId) return "Someone";
  return race.participants.find((d) => d.playerId === playerId)?.name ?? "Someone";
}

export type HitCue = {
  eventId: number;
  /** hit: you were hit. shield: your shield took it. landed: your item hit someone. */
  kind: "hit" | "shield" | "landed";
  text: string;
};

/**
 * Hits that involve this phone's driver and that it has not shown yet.
 * `seen` is updated in place so a hit is announced once.
 */
export function selfHitCues(
  race: KartRaceView | undefined,
  seen: Set<number>,
): HitCue[] {
  if (!race?.selfPlayerId) return [];
  const self = race.selfPlayerId;
  const cues: HitCue[] = [];
  for (const hit of raceHits(race)) {
    if (seen.has(hit.eventId)) continue;
    seen.add(hit.eventId);
    const what = itemWord(hit.item);
    if (hit.target === self) {
      const by = hit.by === self ? "your own" : `${nameOf(race, hit.by)}'s`;
      cues.push({
        eventId: hit.eventId,
        kind: hit.kind === "shield" ? "shield" : "hit",
        text:
          hit.kind === "shield"
            ? `Shield blocked ${by} ${what}!`
            : `Hit by ${by} ${what}!`,
      });
    } else if (hit.by === self && hit.kind === "hit") {
      cues.push({
        eventId: hit.eventId,
        kind: "landed",
        text: `You hit ${nameOf(race, hit.target)}!`,
      });
    }
  }
  if (seen.size > 200) {
    const keep = [...seen].slice(-100);
    seen.clear();
    for (const id of keep) seen.add(id);
  }
  return cues;
}

/** One projector ticker line per landed item: "Amina 💣 Chen". */
export function hitTickerLines(race: KartRaceView | undefined) {
  if (!race) return [];
  const icons: Record<string, string> = { tennis: "🎾", bomb: "💣", homing: "🎯" };
  return raceHits(race)
    .filter((hit) => hit.kind === "hit")
    .map((hit) => ({
      eventId: hit.eventId,
      text: `${nameOf(race, hit.by)} ${icons[hit.item ?? ""] ?? "💥"} ${nameOf(race, hit.target)}`,
    }));
}
