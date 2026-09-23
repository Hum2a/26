import { useState } from "react";
import { Button } from "../ui/primitives";
import { noteUpload } from "../device/connection-log";
import { finalise, putWithProgress, requestSlot } from "./media-transfer";
import { recordWav } from "./wav";

export function GuestMedia({ gameId }: { gameId: string }) {
  const [photoStatus, setPhotoStatus] = useState("Choose a photo.");
  const [voiceStatus, setVoiceStatus] = useState("Record up to 3 seconds.");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);

  return (
    <div className="grid min-w-0 gap-4" data-media="">
      <div className="grid min-w-0 gap-3">
        <label className="grid min-w-0 gap-2 font-bold">
          Photo
          <input
            className="block w-full min-w-0 max-w-full min-h-12 overflow-hidden font-normal"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={photoBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) {
                return;
              }
              setPhotoBusy(true);
              void sendPhoto(gameId, file, setPhotoStatus).finally(() =>
                setPhotoBusy(false),
              );
            }}
          />
        </label>
        <p aria-live="polite">{photoStatus}</p>
      </div>
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
): Promise<void> {
  if (isHeic(file)) {
    setStatus(
      "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.",
    );
    return;
  }
  setStatus("Preparing the photo.");
  let blob: Blob;
  try {
    blob = await compactJpeg(file);
  } catch {
    setStatus(
      "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.",
    );
    return;
  }
  await uploadBlob(gameId, "photo", blob, "image/jpeg", setStatus, "Photo accepted.");
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
): Promise<void> {
  const started = Date.now();
  const slot = await requestSlot(gameId, kind);
  if ("error" in slot) {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus(slot.error);
    return;
  }
  try {
    await putWithProgress(slot.uploadUrl, blob, contentType, (ratio) => {
      setStatus(`Uploading, ${Math.round(ratio * 100)}%.`);
    });
  } catch {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus("Upload failed. Try again.");
    return;
  }
  setStatus("Checking the file.");
  const final = await finalise(gameId, slot.uploadId);
  noteUpload({
    ok: !("error" in final),
    durationMs: Date.now() - started,
  });
  setStatus("error" in final ? final.error : accepted);
}

async function compactJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const edge = Math.max(bitmap.width, bitmap.height);
  const scale = edge > 1280 ? 1280 / edge : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("This phone cannot prepare that photo.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.8);
  });
  if (!blob) {
    throw new Error("This phone cannot prepare that photo.");
  }
  return blob;
}

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}
