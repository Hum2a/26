import { useEffect, useRef, useState } from "react";
import { entertainmentCueDecision, trollZoomCueLabel, type LobbySnapshot } from "@26/shared";
import { withClientApiKey } from "../api/client-key.ts";
import { stageShow } from "./audio";

const playedKey = "26-stage-played";

export function StageSound({
  gameId,
  announcement,
  unlocked,
  muted,
  presentation = false,
}: {
  gameId: string;
  announcement: LobbySnapshot["trolls"]["announcement"];
  unlocked: boolean;
  muted: boolean;
  presentation?: boolean;
}) {
  const initialCue = useRef<string | null | undefined>(undefined);
  const startedCue = useRef<string | null>(null);
  const [played, setPlayed] = useState<string[]>(readPlayed);
  const [notice, setNotice] = useState(
    "Sound plays on this screen only. Missing audio never stops the quiz.",
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
    if (!announcement || !cueId) {
      return;
    }
    if (decision === "wait") {
      setNotice("Sound is waiting. Start the show to hear the next cue.");
      return;
    }
    if (decision === "drop") {
      remember(cueId, played, setPlayed);
      return;
    }
    const source = announcement.audioAsset
      ? announcement.audioAsset
      : announcement.mediaKind === "voice"
        ? withClientApiKey(`/api/rooms/${gameId}/media/${announcement.mediaId}`)
        : "";
    if (!source || startedCue.current === cueId) {
      if (!source) {
        remember(cueId, played, setPlayed);
      }
      return;
    }
    startedCue.current = cueId;
    let cancelled = false;
    void stageShow.playUrl(source).then((playedCue) => {
      if (cancelled) {
        return;
      }
      if (playedCue) {
        setNotice("Playing the stage cue.");
        remember(cueId, played, setPlayed);
        return;
      }
      setNotice("This cue did not play. The game continues.");
      remember(cueId, played, setPlayed);
    });
    return () => {
      cancelled = true;
    };
  }, [announcement, cueId, gameId, muted, played, unlocked]);

  return (
    <div className="grid gap-3">
      {!presentation ? <p aria-live="polite">{notice}</p> : null}
      {announcement ? (
        <div className="grid gap-3 rounded-3xl border border-line p-4">
          <p className="text-3xl font-bold" role="status">
            {announcement.label} {announcement.assetLabel}.
          </p>
          {announcement.mediaKind === "photo" && announcement.mediaId ? (
            <CuePhoto
              src={withClientApiKey(
                `/api/rooms/${gameId}/media/${announcement.mediaId}`,
              )}
              zoom={announcement.assetLabel === trollZoomCueLabel}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A cue photo. A zoom-and-enhance troll creeps slowly in to the middle. */
function CuePhoto({ src, zoom = false }: { src: string; zoom?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p>This photo did not load. The caption stays.</p>;
  }
  const image = (
    <img
      alt="Stage caption"
      className={`max-h-[40vh] w-full object-contain${zoom ? " stage-zoom-photo" : ""}`}
      src={src}
      onError={() => setFailed(true)}
    />
  );
  // The frame clips the zoom so it never spills over the rest of the stage.
  return zoom ? <div className="stage-zoom-frame">{image}</div> : image;
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
  try {
    sessionStorage.setItem(playedKey, JSON.stringify(next));
  } catch {
    // The cue still will not repeat during this page.
  }
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
