import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/primitives";
import { recordWav } from "./wav";

export function VoiceTake({
  disabled,
  onClip,
}: {
  disabled: boolean;
  onClip: (clip: Blob | null) => void;
}) {
  const [status, setStatus] = useState("Record up to 3 seconds, then listen back.");
  const [preview, setPreview] = useState<string>();
  const [recording, setRecording] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!preview) return;
    return () => {
      URL.revokeObjectURL(preview);
    };
  }, [preview]);
  const supported = voiceRecordingSupport();
  if (supported === "unavailable") {
    return (
      <p>This phone cannot record a voice clip. You can still answer the questions.</p>
    );
  }
  return (
    <div className="grid min-w-0 gap-3">
      <Button
        type="button"
        variant="secondary"
        className="w-full whitespace-normal"
        disabled={disabled || recording}
        onClick={() => {
          setRecording(true);
          setStatus("Recording.");
          void recordWav()
            .then((blob) => {
              if (!mounted.current) return;
              const url = URL.createObjectURL(blob);
              setPreview(url);
              onClip(blob);
              setStatus("Listen, then send this clip or record again.");
            })
            .catch(() => {
              if (!mounted.current) return;
              onClip(null);
              setStatus(
                "The microphone is unavailable. You can still answer the questions.",
              );
            })
            .finally(() => {
              if (mounted.current) setRecording(false);
            });
        }}
      >
        Record the clip
      </Button>
      {preview ? (
        <audio controls src={preview}>
          Voice preview
        </audio>
      ) : null}
      {preview ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => {
            setPreview(undefined);
            onClip(null);
            setStatus("Record up to 3 seconds, then listen back.");
          }}
        >
          Record again
        </Button>
      ) : null}
      <p aria-live="polite">{status}</p>
    </div>
  );
}

function voiceRecordingSupport(): "ready" | "unavailable" {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unavailable";
  }
  if (typeof AudioContext === "undefined") {
    return "unavailable";
  }
  return "ready";
}
