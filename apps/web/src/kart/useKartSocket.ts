import { useEffect, useRef } from "react";
import {
  kartNeutral,
  type KartControls,
  type KartInput,
  type KartRaceView,
} from "@26/shared";

/** Adapter over openRoomSocket: no second connection, queued controls or client-owned race clock. */
export function useKartSocket(
  race: KartRaceView | undefined,
  enabled: boolean,
  send?: (input: KartInput) => void,
) {
  const controls = useRef<KartControls>({ ...kartNeutral });
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
    const publish = () =>
      sender.current?.({ raceId, sequence: ++sequence.current, ...controls.current });
    publish();
    const interval = window.setInterval(publish, 100);
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
    };
  }, [raceId, running]);
  return (value: KartControls) => {
    controls.current = running ? value : { ...kartNeutral };
  };
}
