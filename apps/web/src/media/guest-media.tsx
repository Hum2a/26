import { useState } from "react";
import { Button } from "../ui/primitives";
import { noteUpload } from "../device/connection-log";
import { CaptureFlow } from "../photo/CaptureFlow";
import { finalise, putWithProgress, requestSlot } from "./media-transfer";
import { recordWav } from "./wav";
import { compactJpeg, isHeic } from "./photo-prepare";

export function GuestMedia({
  gameId,
  active = true,
}: {
  gameId: string;
  /** False while the Snap tab is hidden, so the camera is not left running. */
  active?: boolean;
}) {
  const [voiceStatus, setVoiceStatus] = useState("Record up to 3 seconds.");
  const [voiceBusy, setVoiceBusy] = useState(false);

  return (
    <div className="grid min-w-0 gap-4" data-media="">
      <CaptureFlow
        active={active}
        upload={(file, setStatus) => sendPhoto(gameId, file, setStatus)}
      />
      <div className="grid gap-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full whitespace-normal"
          disabled={voiceBusy}
          onClick={() => {
            setVoiceBusy(true);
            void sendVoice(gameId, setVoiceStatus).finally(() => setVoiceBusy(false));
          }}
        >
          Record a 3 second clip
        </Button>
        <p aria-live="polite">{voiceStatus}</p>
      </div>
    </div>
  );
}

async function sendPhoto(
  gameId: string,
  file: File,
  setStatus: (status: string) => void,
): Promise<boolean> {
  if (isHeic(file)) {
    setStatus(
      "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.",
    );
    return false;
  }
  setStatus("Preparing the photo.");
  let blob: Blob;
  try {
    blob = await compactJpeg(file);
  } catch {
    setStatus(
      "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.",
    );
    return false;
  }
  return uploadBlob(gameId, "photo", blob, "image/jpeg", setStatus, "Photo accepted.");
}

async function sendVoice(
  gameId: string,
  setStatus: (status: string) => void,
): Promise<void> {
  setStatus("Recording.");
  let blob: Blob;
  try {
    blob = await recordWav();
  } catch {
    setStatus("The microphone is unavailable. You can still answer the questions.");
    return;
  }
  await uploadBlob(
    gameId,
    "voice",
    blob,
    "audio/wav",
    setStatus,
    "Voice clip accepted.",
  );
}

async function uploadBlob(
  gameId: string,
  kind: "photo" | "voice",
  blob: Blob,
  contentType: "image/jpeg" | "audio/wav",
  setStatus: (status: string) => void,
  accepted: string,
): Promise<boolean> {
  const started = Date.now();
  const slot = await requestSlot(gameId, kind);
  if ("error" in slot) {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus(slot.error);
    return false;
  }
  try {
    await putWithProgress(slot.uploadUrl, blob, contentType, (ratio) => {
      setStatus(`Uploading, ${Math.round(ratio * 100)}%.`);
    });
  } catch {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus("Upload failed. Try again.");
    return false;
  }
  setStatus("Checking the file.");
  const final = await finalise(gameId, slot.uploadId);
  const ok = !("error" in final);
  noteUpload({
    ok,
    durationMs: Date.now() - started,
  });
  setStatus(ok ? accepted : final.error);
  return ok;
}
