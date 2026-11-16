export type KartContactSample = {
  raceId: string;
  elapsedMs: number;
  active: boolean;
  contact: boolean;
  eventMode?: boolean;
  event?: { eventId: number; atMs: number };
};

/** Presentation-only cursor over accepted state. No physics, clock or score authority. */
export function createContactFeedbackCursor() {
  let previous: KartContactSample | undefined,
    lastPulse = -Infinity,
    lastEventId = -1;
  return {
    reset() {
      previous = undefined;
      lastPulse = -Infinity;
      lastEventId = -1;
    },
    read(sample: KartContactSample): boolean {
      if (!Number.isFinite(sample.elapsedMs) || sample.elapsedMs < 0 || !sample.raceId)
        return false;
      const event =
        sample.event &&
        Number.isSafeInteger(sample.event.eventId) &&
        sample.event.eventId >= 0 &&
        Number.isSafeInteger(sample.event.atMs) &&
        sample.event.atMs >= 0 &&
        sample.event.atMs <= sample.elapsedMs
          ? sample.event
          : undefined;
      if (!previous || previous.raceId !== sample.raceId) {
        previous = { ...sample };
        lastPulse = -Infinity;
        lastEventId = event?.eventId ?? -1;
        return false;
      }
      if (
        !sample.active ||
        !previous.active ||
        previous.eventMode !== sample.eventMode ||
        sample.elapsedMs < previous.elapsedMs
      ) {
        previous = { ...sample };
        lastEventId = Math.max(lastEventId, event?.eventId ?? -1);
        return false;
      }
      if (sample.elapsedMs <= previous.elapsedMs) return false;
      const fresh = sample.eventMode
        ? Boolean(
            event &&
            event.eventId > lastEventId &&
            sample.elapsedMs - event.atMs <= 1000,
          )
        : sample.contact && !previous.contact;
      const pulse = fresh && sample.elapsedMs - lastPulse >= 400;
      lastEventId = Math.max(lastEventId, event?.eventId ?? -1);
      previous = { ...sample };
      if (pulse) lastPulse = sample.elapsedMs;
      return pulse;
    },
  };
}
