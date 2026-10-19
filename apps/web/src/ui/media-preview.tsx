import "./media-preview.css";
import { useState } from "react";
import { Button } from "./primitives";
import { withClientApiKey } from "../api/client-key";

export function MediaPreview({
  path,
  kind,
  nickname,
  hidden = false,
}: {
  path: string;
  kind: "photo" | "voice";
  nickname: string;
  hidden?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (hidden)
    return (
      <div className="media-preview-placeholder">Hidden · preview unavailable</div>
    );
  if (failed)
    return (
      <div className="media-preview-placeholder">
        <p role="status">Preview unavailable for {nickname}.</p>
        <Button
          variant="secondary"
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Retry preview
        </Button>
      </div>
    );
  const src = withClientApiKey(path);
  return kind === "photo" ? (
    <img
      key={attempt}
      className="media-preview-image"
      src={src}
      alt={`Photo shared by ${nickname}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <audio
      key={attempt}
      className="media-preview-audio"
      controls
      preload="none"
      src={src}
      aria-label={`Voice note shared by ${nickname}`}
      onError={() => setFailed(true)}
    />
  );
}
