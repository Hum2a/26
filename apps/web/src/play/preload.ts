import { useEffect } from "react";
import type { LobbySnapshot } from "@26/shared";

const requested = new Set<string>();

/** Fetch and decode images before they are on screen, so options never pop in. */
export function preloadImages(paths: readonly string[]): void {
  if (typeof Image === "undefined") {
    return;
  }
  for (const path of paths) {
    if (requested.has(path)) {
      continue;
    }
    requested.add(path);
    const image = new Image();
    image.decoding = "async";
    image.src = path;
    void image.decode?.().catch(() => {
      // A failed preload is retried by the real <img> when it renders.
      requested.delete(path);
    });
  }
}

/** Option pictures for the question already on screen. Nothing from later questions. */
export function questionImages(snapshot: LobbySnapshot | undefined): string[] {
  const question = snapshot?.play?.question;
  if (!question || !("options" in question) || !Array.isArray(question.options)) {
    return [];
  }
  return question.options.flatMap((option) =>
    "image" in option && typeof option.image === "string" ? [option.image] : [],
  );
}

let kartWarm: Promise<unknown> | undefined;

/** Load the 3D circuit code during the kart intro, not when the race starts. */
export function warmKart(): void {
  kartWarm ??= Promise.all([
    import("../kart/KartCanvas"),
    import("../kart/KartGameWrapper"),
  ]).catch(() => {
    kartWarm = undefined;
  });
}

/**
 * Starts loading what the current question needs as soon as it is announced.
 * The intro beat gives a few seconds, so the answer phase opens fully drawn.
 */
export function usePreloadQuestion(snapshot: LobbySnapshot | undefined): void {
  const questionId = snapshot?.play?.question.id;
  const kind = snapshot?.play?.question.kind;
  const images = questionImages(snapshot).join("|");
  useEffect(() => {
    if (images) {
      preloadImages(images.split("|"));
    }
    if (kind === "kart") {
      warmKart();
    }
  }, [questionId, kind, images]);
}
