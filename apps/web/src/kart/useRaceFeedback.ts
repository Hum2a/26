import { useCallback, useEffect, useRef, useState } from "react";
import type { KartRaceView } from "@26/shared";
import { buzz } from "../device/haptics";
import {
  createRaceAudio,
  readRaceSoundPreference,
  writeRaceSoundPreference,
  type RaceAudio,
} from "./race-audio";
import { ordinal, selfCues, type SelfCue } from "./race-callouts";
import { selfHitCues } from "./hit-feed";

export type RaceBanner = {
  id: string;
  text: string;
  tone: "lap" | "final" | "place" | "hit" | "landed";
};

/** Roughly the circuit kart's top speed in metres a second, for the engine note. */
const topSpeed = 30;
export const bannerMs = 2200;

function bannerFor(cue: SelfCue, at: number): RaceBanner | undefined {
  if (cue.kind === "launch")
    return cue.grade === "perfect"
      ? { id: `launch-${at}`, text: "PERFECT START!", tone: "final" }
      : { id: `launch-${at}`, text: "Good start!", tone: "lap" };
  if (cue.kind === "final-lap")
    return { id: `final-${at}`, text: "FINAL LAP", tone: "final" };
  if (cue.kind === "lap")
    return {
      id: `lap-${cue.lap}-${at}`,
      text: `Lap ${cue.lap} of ${cue.laps}`,
      tone: "lap",
    };
  if (cue.kind === "place" && cue.gained)
    return {
      id: `place-${cue.place}-${at}`,
      text: `Up to ${ordinal(cue.place)}!`,
      tone: "place",
    };
  return undefined;
}

/**
 * This phone's race moments: a short banner for laps, the final lap and
 * place gains, who hit you and who you hit, plus optional sound and buzzes.
 * Sound is off until the guest turns it on; buzzes are on by default (phones
 * without vibration simply ignore them).
 */
export function useRaceFeedback(
  race: KartRaceView | undefined,
  { open, audio: injected }: { open: boolean; audio?: RaceAudio },
) {
  const [audio] = useState(() => injected ?? createRaceAudio());
  const [soundOn, setSoundOn] = useState(false);
  const wanted = useRef(readRaceSoundPreference());
  const [banner, setBanner] = useState<RaceBanner>();
  const previous = useRef<KartRaceView | undefined>(undefined);
  const wasOpen = useRef(false);
  const seenHits = useRef(new Set<number>());
  useEffect(() => () => audio.dispose(), [audio]);
  // A remembered choice can only start audio inside a tap, so re-arm it on the first one.
  useEffect(() => {
    if (!wanted.current || soundOn) return;
    const arm = () => {
      if (audio.enable()) setSoundOn(true);
    };
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [audio, soundOn]);
  const toggleSound = useCallback(() => {
    if (soundOn) {
      audio.disable();
      setSoundOn(false);
      wanted.current = false;
      writeRaceSoundPreference(false);
      return;
    }
    const on = audio.enable();
    setSoundOn(on);
    wanted.current = on;
    writeRaceSoundPreference(on);
  }, [audio, soundOn]);
  useEffect(() => {
    if (!race) return;
    const self = race.participants.find((d) => d.playerId === race.selfPlayerId);
    const racing = Boolean(self && self.status === "RACING" && !race.ended);
    audio.engine((self?.speed ?? 0) / topSpeed, open && racing);
    const feedback = true;
    if (open && !wasOpen.current && racing && race.elapsedMs < 3000) {
      audio.cue("go");
      if (feedback) buzz(80);
    }
    wasOpen.current = open;
    const before = previous.current;
    previous.current = race;
    const was = before?.participants.find((d) => d.playerId === race.selfPlayerId);
    if (
      before?.raceId === race.raceId &&
      self?.slipstream === "active" &&
      was?.slipstream !== "active"
    )
      audio.cue("slipstream");
    if (before?.raceId !== race.raceId) seenHits.current.clear();
    for (const hit of selfHitCues(race, seenHits.current)) {
      if (!open) continue;
      setBanner({
        id: `hit-${hit.eventId}`,
        text: hit.text,
        tone: hit.kind === "landed" ? "landed" : hit.kind === "hit" ? "hit" : "lap",
      });
      if (hit.kind === "hit") {
        audio.cue("final-lap");
        buzz([70, 40, 140]);
      } else if (hit.kind === "landed") {
        audio.cue("place-up");
        buzz([25, 30, 25]);
      } else buzz(30);
    }
    for (const cue of selfCues(before, race)) {
      const next = bannerFor(cue, race.elapsedMs);
      if (next) setBanner(next);
      if (cue.kind === "finish") {
        audio.cue("finish");
        if (feedback) buzz([90, 60, 90, 60, 220]);
      } else if (cue.kind === "final-lap") {
        audio.cue("final-lap");
        if (feedback) buzz([60, 50, 60]);
      } else if (cue.kind === "lap") {
        audio.cue("lap");
        if (feedback) buzz(60);
      } else if (cue.kind === "launch") {
        audio.cue("launch");
        if (feedback) buzz(cue.grade === "perfect" ? [40, 30, 90] : 50);
      } else if (cue.gained) {
        audio.cue("place-up");
        if (feedback) buzz(30);
      }
    }
  }, [race, open, audio, soundOn]);
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(undefined), bannerMs);
    return () => clearTimeout(timer);
  }, [banner]);
  return { banner, soundOn, toggleSound };
}
