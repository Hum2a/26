import { useEffect, useRef, useState } from "react";
import { entertainmentCueDecision, type LobbySnapshot } from "@26/shared";
import { withClientApiKey } from "../api/client-key.ts";
import { Button } from "../ui/primitives";

const playedKey = "26-stage-played";
const muteKey = "26-stage-mute";

export function StageSound({
  gameId,
  announcement,
}: {
  gameId: string;
  announcement: LobbySnapshot["trolls"]["announcement"];
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const initialCue = useRef<string | null | undefined>(undefined);
  const startedCue = useRef<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [muted, setMuted] = useState(readMute);
  const [played, setPlayed] = useState<string[]>(readPlayed);
  const [notice, setNotice] = useState(
    "Browsers block sound until you enable it on this screen.",
  );
  const cueId = announcement?.cueId ?? null;

  useEffect(() => {
    if (initialCue.current === undefined) {
      initialCue.current = cueId;
    }
    const decision = entertainmentCueDecision({
      cueId,
      muted,
      unlocked,
      playedIds: played,
      presentBeforeListening: cueId !== null && cueId === initialCue.current,
    });
    const element = audio.current;
    if (!element || !announcement || !cueId) {
      element?.pause();
      return;
    }
    if (decision === "wait") {
      setNotice("Sound is waiting. Enable it to hear the next cue.");
      return;
    }
    if (decision === "drop") {
      if (startedCue.current !== cueId) {
        element.pause();
      }
      remember(cueId, played, setPlayed);
      return;
    }
    const source = announcement.audioAsset
      ? announcement.audioAsset
      : announcement.mediaKind === "voice"
        ? withClientApiKey(`/api/rooms/${gameId}/media/${announcement.mediaId}`)
        : "";
    if (!source) {
      remember(cueId, played, setPlayed);
      return;
    }
    if (startedCue.current === cueId) {
      return;
    }
    element.src = source;
    element.muted = false;
    void element.play().then(
      () => {
        startedCue.current = cueId;
        setNotice("Playing the stage cue.");
        remember(cueId, played, setPlayed);
      },
      () => {
        if (element.error) {
          setNotice("This cue did not load. The game continues.");
          remember(cueId, played, setPlayed);
          return;
        }
        setNotice("The browser blocked sound. Enable it and the next cue can play.");
        setUnlocked(false);
      },
    );
  }, [announcement, cueId, gameId, muted, played, unlocked]);

  return (
    <div className="grid gap-3">
      <p aria-live="polite">{notice}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const element = audio.current;
            if (!element) {
              return;
            }
            element.src = "/assets/demo-sting.wav";
            element.muted = true;
            void element.play().then(
              () => {
                element.pause();
                element.muted = false;
                setUnlocked(true);
                setNotice("Sound is on for new cues. A refresh asks again.");
              },
              () => {
                setNotice(
                  element.error
                    ? "The sound file did not load. Cues can still show on screen."
                    : "The browser still blocked sound.",
                );
              },
            );
          }}
        >
          Enable sound
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-pressed={muted}
          onClick={() => {
            const next = !muted;
            setMuted(next);
            sessionStorage.setItem(muteKey, next ? "1" : "0");
            audio.current?.pause();
            setNotice(next ? "Stage sound is muted." : "Stage sound is unmuted.");
          }}
        >
          {muted ? "Unmute stage" : "Mute stage"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            audio.current?.pause();
            if (cueId) {
              remember(cueId, played, setPlayed);
            }
            setNotice("The current cue was stopped.");
          }}
        >
          Stop cue
        </Button>
      </div>
      <audio ref={audio} preload="none" />
      {announcement ? (
        <div className="grid gap-3 rounded-3xl border border-line p-4">
          <p className="text-3xl font-bold" role="status">
            {announcement.label} {announcement.assetLabel}.
          </p>
          {announcement.mediaKind === "photo" && announcement.mediaId ? (
            <CuePhoto
              src={withClientApiKey(`/api/rooms/${gameId}/media/${announcement.mediaId}`)}
            />
          ) : null}
          {announcement.assetLabel === "Demo sponsor" ? (
            <p>Demo sponsor. Replace this caption with the party line.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CuePhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p>This photo did not load. The caption stays.</p>;
  }
  return (
    <img
      alt="Stage caption"
      className="max-h-[40vh] w-full object-contain"
      src={src}
      onError={() => setFailed(true)}
    />
  );
}

function remember(
  cueId: string,
  played: readonly string[],
  setPlayed: (ids: string[]) => void,
): void {
  if (played.includes(cueId)) {
    return;
  }
  const next = [...played, cueId].slice(-20);
  setPlayed(next);
  sessionStorage.setItem(playedKey, JSON.stringify(next));
}

function readPlayed(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(playedKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function readMute(): boolean {
  return sessionStorage.getItem(muteKey) === "1";
}
