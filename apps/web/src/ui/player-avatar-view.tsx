import { useEffect, useState } from "react";
import { Icon } from "@iconify/react/dist/offline";
import botIcon from "@iconify-icons/lucide/bot";
import { evictMediaUrl, useCachedMediaSrc } from "../media/media-cache";
import { initials, looksLikeBot, playerHue } from "./player-avatar-labels";
import { useRosterEntry } from "./roster-context";
import "./player-avatar.css";

/** A face that failed to load is tried again this many times, further apart each time. */
const avatarRetries = 2;
const avatarRetryMs = 8_000;

export function PlayerAvatar({
  playerId,
  nickname,
  size = "md",
  faceSrc,
}: {
  playerId: string;
  nickname: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** A photo URL, `null` for none, or omitted to use the roster's photo for this player. */
  faceSrc?: string | null;
}) {
  const bot = looksLikeBot(nickname);
  const rostered = useRosterEntry(playerId)?.faceSrc ?? null;
  const src = faceSrc === undefined ? rostered : faceSrc;
  // A photo that fails to load (removed, offline) shows initials, then tries
  // again a little later, so a Wi-Fi blip does not lose the face all night.
  const [failure, setFailure] = useState<{
    src: string;
    tries: number;
    waiting: boolean;
  } | null>(null);
  const failed = failure !== null && failure.src === src;
  const tries = failed ? failure.tries : 0;
  const showFace = Boolean(src) && !(failed && failure.waiting);
  const resolvedSrc = useCachedMediaSrc(showFace ? src : null, { preload: true });
  useEffect(() => {
    if (!failure?.waiting || failure.tries > avatarRetries) return;
    const timer = window.setTimeout(
      () => setFailure((current) => (current ? { ...current, waiting: false } : null)),
      avatarRetryMs * failure.tries,
    );
    return () => window.clearTimeout(timer);
  }, [failure]);
  return (
    <span
      className="player-avatar"
      data-size={size}
      data-hue={playerHue(playerId)}
      data-bot={bot || undefined}
      data-face={showFace || undefined}
      aria-hidden="true"
    >
      {showFace ? (
        <img
          key={`${src}#${tries}`}
          src={resolvedSrc!}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => {
            if (src && resolvedSrc !== src) {
              evictMediaUrl(src);
              return;
            }
            if (src) evictMediaUrl(src);
            setFailure({ src: src!, tries: tries + 1, waiting: true });
          }}
        />
      ) : bot ? (
        <span className="player-avatar-bot">
          <Icon icon={botIcon} />
          <small>{nickname.replace(/^Bot\s+0*/, "")}</small>
        </span>
      ) : (
        initials(nickname)
      )}
    </span>
  );
}
