import type { AuthoredQuestion, QuestionPack } from "./definition.ts";

/**
 * Public files a pack names. Option pictures, supplied media, and the
 * Who’s-that-Pokémon silhouette convention. Drafts with no `asset` yet are
 * omitted: those stay incomplete, they are not missing files.
 */
export function packPublicAssets(pack: QuestionPack): string[] {
  const seen = new Set<string>();
  const assets: string[] = [];
  const add = (asset: string | undefined) => {
    if (!asset || seen.has(asset)) {
      return;
    }
    seen.add(asset);
    assets.push(asset);
  };
  for (const question of pack.catalogue) {
    for (const media of question.media ?? []) {
      add(media.asset);
    }
    if (question.kind === "choice") {
      for (const option of question.options) {
        add(option.image);
      }
    }
    add(silhouetteAsset(question));
  }
  return assets;
}

/** Separate blacked-out file the Pokémon design loads by question id. */
export function silhouetteAsset(question: AuthoredQuestion): string | undefined {
  if (question.presentation !== "whos-that-pokemon") {
    return undefined;
  }
  if (question.status !== "ready") {
    return undefined;
  }
  const ext = question.id === "whos-that-pokemon" ? "svg" : "png";
  return `/assets/questions/${question.id}/silhouette.${ext}`;
}
