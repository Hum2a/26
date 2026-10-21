import { noteUpload } from "../device/connection-log";
import { finalise, putWithProgress, requestSlot } from "./media-transfer";
import { compactJpeg, isHeic } from "./photo-prepare";

/** A kart driver's face: a square crop around the centre, sent as a `face` photo. */
export async function sendFacePhoto(
  gameId: string,
  file: File,
  setStatus: (status: string) => void,
): Promise<string | null> {
  if (isHeic(file)) {
    setStatus(
      "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.",
    );
    return null;
  }
  setStatus("Preparing the photo.");
  let blob: Blob;
  try {
    blob = await compactJpeg(file, 512, true);
  } catch {
    setStatus(
      "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.",
    );
    return null;
  }
  const started = Date.now();
  const slot = await requestSlot(gameId, "photo", "face");
  if ("error" in slot) {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus(slot.error);
    return null;
  }
  try {
    await putWithProgress(slot.uploadUrl, blob, "image/jpeg", (ratio) => {
      setStatus(`Uploading, ${Math.round(ratio * 100)}%.`);
    });
  } catch {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus("Upload failed. Try again.");
    return null;
  }
  setStatus("Checking the photo.");
  const final = await finalise(gameId, slot.uploadId);
  noteUpload({ ok: !("error" in final), durationMs: Date.now() - started });
  if ("error" in final) {
    setStatus(final.error);
    return null;
  }
  setStatus("Photo ready.");
  return final.mediaId;
}
