import { mediaFinalSchema, mediaSlotSchema, roomClientErrorSchema } from "@26/shared";
import { clientApiHeaders } from "../api/client-key.ts";
import { noteUpload } from "../device/connection-log";

export async function requestSlot(
  gameId: string,
  kind: "photo" | "voice",
  purpose: "round" | "face" | "wall" = "round",
): Promise<{ uploadId: string; uploadUrl: string } | { error: string }> {
  const response = await fetch(`/api/rooms/${gameId}/media/slots`, {
    method: "POST",
    credentials: "same-origin",
    headers: clientApiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      kind,
      ...(purpose !== "round" ? { purpose } : {}),
    }),
  });
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = mediaSlotSchema.safeParse(body);
  if (parsed.success) {
    return parsed.data;
  }
  return { error: errorMessage(body) };
}

export async function finalise(
  gameId: string,
  uploadId: string,
): Promise<{ mediaId: string } | { error: string }> {
  const response = await fetch(`/api/rooms/${gameId}/media/${uploadId}/finalise`, {
    method: "POST",
    credentials: "same-origin",
    headers: clientApiHeaders({ "content-type": "application/json" }),
    body: "{}",
  });
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = mediaFinalSchema.safeParse(body);
  if (parsed.success) {
    return { mediaId: parsed.data.mediaId };
  }
  return { error: errorMessage(body) };
}

export function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.withCredentials =
      new URL(url, window.location.href).origin === window.location.origin;
    xhr.setRequestHeader("content-type", contentType);
    for (const [name, value] of Object.entries(clientApiHeaders())) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed."));
    xhr.send(body);
  });
}

export async function uploadVoiceClip(
  gameId: string,
  blob: Blob,
  setStatus: (status: string) => void,
): Promise<string | null> {
  const started = Date.now();
  const slot = await requestSlot(gameId, "voice");
  if ("error" in slot) {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus(slot.error);
    return null;
  }
  try {
    await putWithProgress(slot.uploadUrl, blob, "audio/wav", (ratio) => {
      setStatus(`Uploading, ${Math.round(ratio * 100)}%.`);
    });
  } catch {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus("Upload failed. Try again.");
    return null;
  }
  setStatus("Checking the file.");
  const final = await finalise(gameId, slot.uploadId);
  if ("error" in final) {
    noteUpload({ ok: false, durationMs: Date.now() - started });
    setStatus(final.error);
    return null;
  }
  noteUpload({ ok: true, durationMs: Date.now() - started });
  setStatus("Voice clip accepted.");
  return final.mediaId;
}

function errorMessage(body: unknown): string {
  const parsed = roomClientErrorSchema.safeParse(body);
  return parsed.success ? parsed.data.message : "That upload was not accepted.";
}
