import { useState } from "react";
import { Icon } from "@iconify/react/dist/offline";
import imageOff from "@iconify-icons/lucide/image-off";
import type { WallFrame, WallReaction } from "@26/shared";
import "./wall.css";

/** Names and short descriptions for the frame chips. */
export const frameLabels: Record<WallFrame, string> = {
  polaroid: "Polaroid",
  birthday: "Birthday 26",
  wanted: "Wanted",
  tabloid: "Tabloid",
  magazine: "Magazine",
  museum: "Museum",
  vhs: "VHS",
};

export const reactionEmoji: Record<WallReaction, string> = {
  fire: "🔥",
  laugh: "😂",
  love: "😍",
  clap: "👏",
  skull: "💀",
};

export const reactionLabels: Record<WallReaction, string> = {
  fire: "Fire",
  laugh: "Laughing",
  love: "Love it",
  clap: "Applause",
  skull: "Dead",
};

/**
 * A wall photo in its frame. The frame is drawn here with CSS, never burned
 * into the image. Used for the phone preview and the projector, so a guest
 * sees exactly what the room will see.
 *
 * A photo that fails to load shows a "could not be shown" card in its frame
 * and calls `onFailed` once for that source. Only the projector passes
 * `onFailed`; there the card also says the wall is moving on, because the room
 * then ends that photo early. The image is keyed by its source, so a late
 * error from a replaced or unmounted image never reaches the new one.
 */
export function FramedPhoto({
  src,
  frame,
  nickname,
  caption,
  size = "phone",
  onFailed,
}: {
  src: string;
  frame: WallFrame;
  nickname: string;
  caption: string | null;
  size?: "phone" | "stage" | "corner" | "thumb";
  onFailed?: () => void;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const alt = caption
    ? `${caption}, a photo from ${nickname}`
    : `Photo from ${nickname}`;
  return (
    <figure className={`wall-frame wall-frame--${frame} wall-frame--${size}`}>
      {frame === "wanted" ? <p className="wall-frame-banner">WANTED</p> : null}
      {frame === "tabloid" ? (
        <p className="wall-frame-banner">THE DAILY 26 · EXCLUSIVE</p>
      ) : null}
      {frame === "magazine" ? (
        <p className="wall-frame-banner">26 MAGAZINE · {nickname.toUpperCase()}</p>
      ) : null}
      <div className="wall-frame-image">
        {failedSource === src ? (
          <div className="wall-frame-missing" role="status">
            <Icon
              icon={imageOff}
              aria-hidden="true"
              className="wall-frame-missing-icon"
            />
            <p>This photo could not be shown.</p>
            {onFailed ? (
              <p className="wall-frame-missing-note">Moving on in a moment.</p>
            ) : null}
          </div>
        ) : (
          <img
            key={src}
            src={src}
            alt={alt}
            onError={() => {
              if (failedSource === src) return;
              setFailedSource(src);
              onFailed?.();
            }}
            draggable={false}
          />
        )}
        {frame === "vhs" ? (
          <span className="wall-frame-rec" aria-hidden="true">
            ● REC
          </span>
        ) : null}
        {frame === "birthday" ? (
          <span className="wall-frame-badge" aria-hidden="true">
            26
          </span>
        ) : null}
      </div>
      <figcaption>
        {frame === "wanted" ? (
          <>
            <span className="wall-frame-name">{nickname}</span>
            <span>{caption ?? "For crimes against the dance floor"}</span>
          </>
        ) : frame === "museum" ? (
          <>
            <span className="wall-frame-name">{caption ?? "Untitled"}</span>
            <span>{nickname}, 2026. Phone camera on glass.</span>
          </>
        ) : (
          <>
            {caption ? <span className="wall-frame-caption">{caption}</span> : null}
            <span className="wall-frame-name">{nickname}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
