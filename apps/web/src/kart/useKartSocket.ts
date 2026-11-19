import { useEffect, useRef } from "react";
import {
  kartInputGapMs,
  kartNeutral,
  type KartControls,
  type KartInput,
  type KartRaceView,
} from "@26/shared";

/** Re-send held controls so the room keeps them fresh. */
const heartbeatMs = 100;
/**
 * At most one control message per heartbeat. The phone drives its own kart in
 * device-v1 races, so a faster stream only changes how quickly other guests
 * see a turn, and eighty phones steering at ~18 Hz backed up the room (local
 * load test, 19 November 2026). The 10 ms slack stops timer jitter skipping a
 * heartbeat; it stays well above the room's kartInputGapMs rule.
 */
const minGapMs = Math.max(kartInputGapMs + 5, heartbeatMs - 10);

const same = (a: KartControls, b: KartControls) =>
  a.steer === b.steer && a.gas === b.gas && a.brake === b.brake && a.drift === b.drift;

/**
 * Adapter over openRoomSocket: no second connection, queued controls or
 * second race state. A change is sent straight away when a heartbeat's worth
 * of time has passed, otherwise once at the next slot with the latest controls.
 */
export function useKartSocket(
  race: KartRaceView | undefined,
  enabled: boolean,
  send?: (input: KartInput) => void,
) {
  const controls = useRef<KartControls>({ ...kartNeutral });
  const sent = useRef<KartControls>({ ...kartNeutral });
  const lastSent = useRef(-Infinity);
  const pending = useRef<number | undefined>(undefined);
  const publisher = useRef<(() => void) | undefined>(undefined);
  const sender = useRef(send);
  const sequence = useRef(0);
  const inputCursor = race?.inputCursor ?? 0;
  useEffect(() => {
    sequence.current = Math.max(sequence.current, inputCursor);
  }, [inputCursor]);
  useEffect(() => {
    sender.current = send;
  }, [send]);
  const raceId = race?.raceId;
  const self = race?.participants.find((p) => p.playerId === race.selfPlayerId);
  const running = enabled && self?.status === "RACING" && !race?.ended;
  useEffect(() => {
    controls.current = { ...kartNeutral };
    if (!running || !raceId) return;
    const publish = () => {
      window.clearTimeout(pending.current);
      pending.current = undefined;
      lastSent.current = performance.now();
      sent.current = { ...controls.current };
      sender.current?.({ raceId, sequence: ++sequence.current, ...controls.current });
    };
    publisher.current = publish;
    publish();
    // Every phone learns the race has started from the same broadcast. Without
    // a random phase their heartbeats line up, and eighty messages landing in
    // the same instant stall the room's race tick (local load test, 19 Nov 2026:
    // 2 updates/s in one burst, 7.4/s when spread across the beat).
    let interval: number | undefined;
    const phase = window.setTimeout(
      () => {
        interval = window.setInterval(() => {
          if (performance.now() - lastSent.current >= minGapMs) publish();
        }, heartbeatMs);
      },
      Math.floor(Math.random() * heartbeatMs),
    );
    const reset = () => {
      controls.current = { ...kartNeutral };
      publish();
    };
    const visibility = () => {
      if (document.hidden) reset();
    };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(phase);
      window.clearInterval(interval);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", visibility);
      reset();
      publisher.current = undefined;
      window.clearTimeout(pending.current);
      pending.current = undefined;
    };
  }, [raceId, running]);
  return (value: KartControls) => {
    controls.current = running ? value : { ...kartNeutral };
    const publish = publisher.current;
    if (!publish || same(controls.current, sent.current)) return;
    const wait = lastSent.current + minGapMs - performance.now();
    if (wait <= 0) publish();
    else if (pending.current === undefined)
      pending.current = window.setTimeout(publish, wait);
  };
}
