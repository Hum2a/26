import { noteUpload } from "../device/connection-log";
import { finalise, putWithProgress, requestSlot } from "../media/media-transfer";
import { compactJpeg, isHeic } from "../media/photo-prepare";

const heicMessage =
  "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC.";

/**
 * Shrinks a photo on the phone, then sends it as a `wall` upload. Re-encoding
 * to JPEG also drops the camera's metadata, location included.
 */
export async function sendWallPhoto(
  gameId: string,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<{ mediaId: string } | { error: string }> {
  if (isHeic(file)) {
    return { error: heicMessage };
  }
  let blob: Blob;
  try {
    blob = await compactJpeg(file, 1280);
  } catch {
    return { error: heicMessage };
  }
  const started = Date.now();
  const slot = await requestSlot(gameId, "photo", "wall");
  if ("error" in slot) {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    return slot;
  }
  try {
    await putWithProgress(slot.uploadUrl, blob, "image/jpeg", onProgress);
  } catch {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    return { error: "The upload did not finish. Check your signal and try again." };
  }
  const final = await finalise(gameId, slot.uploadId);
  noteUpload({ ok: !("error" in final), durationMs: Date.now() - started });
  return final;
}
