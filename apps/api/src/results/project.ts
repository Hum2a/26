import {
  galleryAttribution,
  personalResultsSchema,
  publicResultRetention,
  publicResultsSchema,
  type PersonalResults,
  type PublicResults,
} from "@26/shared";
import type { PersonalArchive, PublicArchive } from "../archive/document.ts";

const galleryNote =
  "These photos were shared with the room. The name is the person who sent the photo.";

export function toPublicResults(archive: PublicArchive): PublicResults {
  const gallery = archive.media
    .filter((item) => !item.hidden && (item.kind === "photo" || item.kind === "voice"))
    .map((item) => ({
      mediaId: item.mediaId,
      kind: item.kind as "photo" | "voice",
      nickname: item.nickname,
      attribution: galleryAttribution(item.nickname),
    }));
  return publicResultsSchema.parse({
    state: "ready",
    standings: archive.standings.map((standing) => ({
      nickname: standing.nickname,
      position: standing.position,
      points: standing.points,
    })),
    highlights: archive.highlights
      .filter((card) => card.display === "eligible")
      .slice(0, 8),
    funFacts: archive.funFacts.slice(0, 10),
    gallery,
    galleryNote,
    retentionNote: publicResultRetention,
  });
}

export function toPersonalResults(archive: PersonalArchive): PersonalResults {
  const best = [...archive.scores]
    .filter((score) => score.points > 0)
    .sort(
      (left, right) =>
        right.points - left.points || left.questionId.localeCompare(right.questionId),
    )
    .slice(0, 3)
    .map((score) => ({
      questionId: score.questionId,
      points: score.points,
      detail: score.detail.slice(0, 200),
    }));
  return personalResultsSchema.parse({
    nickname: archive.nickname,
    position: archive.position,
    points: archive.points,
    best,
    given: archive.effects.given,
    received: archive.effects.received,
    recap: archive.recap.slice(0, 6),
    funFacts: archive.funFacts.slice(0, 10),
  });
}
