import { useEffect, useRef } from "react";
import {
  kartNeutral,
  type KartControls,
  type KartInput,
  type KartRaceView,
} from "@26/shared";

/** The room drops controls that arrive under 80 ms apart; leave room for jitter. */
const minGapMs = 90;
/** Re-send held controls so the room keeps them fresh. */
const heartbeatMs = 100;

const same = (a: KartControls, b: KartControls) =>
  a.steer === b.steer && a.gas === b.gas && a.brake === b.brake && a.drift === b.drift;

/**
 * Adapter over openRoomSocket: no second connection, queued controls or
 * client-owned race clock. A change is sent straight away (or as soon as the
 * room's minimum gap allows) rather than waiting for the next heartbeat.
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
      lastSent.current = Date.now();
      sent.current = { ...controls.current };
      sender.current?.({ raceId, sequence: ++sequence.current, ...controls.current });
    };
    publisher.current = publish;
    publish();
    const interval = window.setInterval(() => {
      if (Date.now() - lastSent.current >= minGapMs) publish();
    }, heartbeatMs);
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
    const wait = lastSent.current + minGapMs - Date.now();
    if (wait <= 0) publish();
    else if (pending.current === undefined)
      pending.current = window.setTimeout(publish, wait);
  };
}
