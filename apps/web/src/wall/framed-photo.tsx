import { useState } from "react";
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
 */
export function FramedPhoto({
  src,
  frame,
  nickname,
  caption,
  size = "phone",
}: {
  src: string;
  frame: WallFrame;
  nickname: string;
  caption: string | null;
  size?: "phone" | "stage" | "corner" | "thumb";
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
          <p className="wall-frame-missing">This photo could not be shown.</p>
        ) : (
          <img
            src={src}
            alt={alt}
            onError={() => setFailedSource(src)}
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
