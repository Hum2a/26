import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useCamera } from "../device/camera";
import { Button } from "../ui/primitives";
import { captureFrame } from "./capture-frame";

export type PhotoUpload = (
  file: File,
  setStatus: (status: string) => void,
) => Promise<boolean>;

type Shot = { file: File; url: string };

export function CaptureFlow({ upload }: { upload: PhotoUpload }) {
  const [shot, setShot] = useState<Shot | null>(null);
  const [mode, setMode] = useState<"live" | "preview" | "sending" | "sent" | "failed">(
    "live",
  );
  const [detail, setDetail] = useState("Take a photo.");
  const videoNode = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sending = useRef(false);
  const holding = mode === "live" || mode === "preview";
  const camera = useCamera(holding);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    streamRef.current = camera.stream;
    if (videoNode.current) {
      videoNode.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  const setVideo = useCallback((node: HTMLVideoElement | null) => {
    videoNode.current = node;
    if (node) {
      node.srcObject = streamRef.current;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (shot) {
        URL.revokeObjectURL(shot.url);
      }
    };
  }, [shot]);

  function remember(file: File) {
    setShot((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      return { file, url: URL.createObjectURL(file) };
    });
    setMode("preview");
    setDetail("Check the photo, then send it or take another.");
  }

  async function onCapture() {
    const video = videoNode.current;
    if (!video) {
      return;
    }
    try {
      const blob = await captureFrame(video);
      remember(new File([blob], "photo.jpg", { type: "image/jpeg" }));
    } catch {
      setDetail("This phone cannot take a photo. You can still choose one.");
    }
  }

  function retake() {
    setShot((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    setMode("live");
    setDetail(camera.fallback ? "Choose a photo." : "Take a photo.");
  }

  function onSend() {
    if (!shot || sending.current || mode === "sent") {
      return;
    }
    sending.current = true;
    camera.release();
    setMode("sending");
    const file = shot.file;
    void upload(file, setDetail)
      .then((ok) => {
        sending.current = false;
        setMode(ok ? "sent" : "failed");
      })
      .catch(() => {
        sending.current = false;
        setMode("failed");
        setDetail("Failed");
      });
  }

  const live = mode === "live";
  const buttonLabel =
    mode === "sending"
      ? "Sending"
      : mode === "sent"
        ? "Sent ✓"
        : mode === "failed"
          ? "Retry"
          : "Send";

  return (
    <div className="grid min-w-0 gap-3">
      <AnimatePresence mode="wait">
        {live ? (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            className="grid gap-3"
          >
            {camera.fallback ? (
              <label className="grid min-w-0 gap-2 font-bold">
                Photo
                <input
                  className="block w-full min-w-0 max-w-full min-h-12 overflow-hidden font-normal"
                  type="file"
                  accept="image/*"
                  capture
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) {
                      return;
                    }
                    remember(file);
                  }}
                />
              </label>
            ) : (
              <>
                <video
                  ref={setVideo}
                  className="aspect-[3/4] w-full rounded-3xl bg-surface object-cover"
                  aria-label="Camera"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => void onCapture()}
                    disabled={!camera.stream}
                  >
                    Capture
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={camera.toggleFacing}
                  >
                    {camera.facing === "environment" ? "Front camera" : "Rear camera"}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        ) : shot ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            className="grid gap-3"
          >
            <img
              alt="Preview"
              className="aspect-[3/4] w-full rounded-3xl bg-surface object-cover"
              src={shot.url}
            />
            <div className="flex flex-wrap gap-3">
              {mode === "sent" ? null : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={retake}
                  disabled={mode === "sending"}
                >
                  Retake
                </Button>
              )}
              <Button
                type="button"
                onClick={onSend}
                disabled={mode === "sending" || mode === "sent"}
              >
                {buttonLabel}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <p aria-live="polite">
        {mode === "live" && camera.fallback ? "Choose a photo." : detail}
      </p>
      {mode === "failed" ? <p>Failed</p> : null}
    </div>
  );
}
