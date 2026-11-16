import { useEffect, useRef, useState } from "react";
import type { LobbyDriver, KartVfxPreset, KartLookPreset } from "@26/shared";
import { driverFaceUrl } from "./driver-face";
import "./driver.css";
import {
  practiceFaceLimit,
  practicePresentationKind,
  readPracticePresentation,
} from "./practice-presentation";

/** Parent fetches authorised media; the practice engine receives only local image bytes. */
export function SoloPracticeFrame({
  gameId = "",
  driver,
  sampleFace,
  effectsPreset,
  lookPreset,
}: {
  gameId?: string;
  driver?: LobbyDriver;
  sampleFace?: Blob | null;
  effectsPreset?: KartVfxPreset | null;
  lookPreset?: KartLookPreset | null;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [revision, setRevision] = useState(0);
  const sent = useRef<{ revision: number; face: Blob | null } | null>(null);
  const [photo, setPhoto] = useState<{
    key: string;
    blob: Blob | null;
    failed: boolean;
  }>({ key: "", blob: null, failed: false });
  const faceKey = `${gameId}:${driver?.faceMediaId ?? ""}`;
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.kind === "kart-practice-ready"
      )
        setRevision((value) => value + 1);
    };
    window.addEventListener("message", ready);
    return () => window.removeEventListener("message", ready);
  }, []);
  useEffect(() => {
    const face = sampleFace ?? (photo.key === faceKey ? photo.blob : null);
    const next = readPracticePresentation({
      kind: practicePresentationKind,
      style: driver?.style ?? "racer",
      ...(sent.current?.revision === revision && sent.current.face === face
        ? {}
        : { face }),
      ...(effectsPreset !== undefined ? { effects: effectsPreset } : {}),
      ...(lookPreset !== undefined ? { look: lookPreset } : {}),
    });
    if (next) {
      frame.current?.contentWindow?.postMessage(
        { kind: practicePresentationKind, ...next },
        location.origin,
      );
      sent.current = { revision, face };
    }
  }, [driver?.style, sampleFace, photo, faceKey, effectsPreset, lookPreset, revision]);
  useEffect(() => {
    if (sampleFace || !gameId || !driver?.faceMediaId) return;
    const abort = new AbortController();
    let cancelled = false;
    const timeout = window.setTimeout(() => abort.abort(), 15_000);
    void (async () => {
      try {
        const response = await fetch(driverFaceUrl(gameId, driver.faceMediaId!), {
          signal: abort.signal,
        });
        const type = response.headers.get("content-type")?.split(";")[0] ?? "";
        if (
          !response.ok ||
          !response.body ||
          !["image/jpeg", "image/png", "image/webp"].includes(type)
        )
          throw new Error("Photo unavailable");
        const reader = response.body.getReader();
        const bytes = new Uint8Array(practiceFaceLimit);
        let size = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (size + value.length > practiceFaceLimit)
              throw new Error("Photo too large");
            bytes.set(value, size);
            size += value.length;
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        if (!cancelled)
          setPhoto({
            key: faceKey,
            blob: new Blob([bytes.subarray(0, size)], { type }),
            failed: false,
          });
      } catch {
        if (!cancelled) setPhoto({ key: faceKey, blob: null, failed: true });
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      abort.abort();
    };
  }, [gameId, driver?.faceMediaId, sampleFace, faceKey]);
  return (
    <div className="solo-practice-frame">
      <iframe
        ref={frame}
        title="Solo kart practice"
        src="/kart-engine/index.html"
        allow="fullscreen"
        onLoad={() => setRevision((value) => value + 1)}
      />
      {photo.key === faceKey && photo.failed && !sampleFace && driver?.faceMediaId ? (
        <p role="status">
          Your photo could not load in practice. Your chosen driver is still available.
        </p>
      ) : null}
    </div>
  );
}
