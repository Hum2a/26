import { useEffect, useRef, useState } from "react";

export type CameraFacing = "user" | "environment";

/**
 * Opens the phone camera. Rear (`environment`) is the default.
 * A rejected stream sets `fallback` so the photo control can use a file input.
 * Tracks stop when the hook unmounts, when the facing changes, and when `release` runs.
 */
export function useCamera(active = true) {
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [rejected, setRejected] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";
  const fallback = !supported || rejected;

  useEffect(() => {
    if (!active || fallback) {
      return () => {
        stopTracks(streamRef.current);
        streamRef.current = null;
      };
    }

    const open = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!open) {
      return () => {
        stopTracks(streamRef.current);
        streamRef.current = null;
      };
    }

    let cancelled = false;
    let opened: MediaStream | null = null;
    void open({ video: { facingMode: facing }, audio: false })
      .then((next) => {
        if (cancelled) {
          stopTracks(next);
          return;
        }
        opened = next;
        stopTracks(streamRef.current);
        streamRef.current = next;
        setStream(next);
      })
      .catch(() => {
        if (!cancelled) {
          setRejected(true);
        }
      });

    return () => {
      cancelled = true;
      stopTracks(opened);
      stopTracks(streamRef.current);
      streamRef.current = null;
    };
  }, [active, facing, fallback]);

  function toggleFacing() {
    setFacing((current) => (current === "user" ? "environment" : "user"));
  }

  function release() {
    stopTracks(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }

  return { stream, facing, fallback, toggleFacing, release };
}

function stopTracks(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
