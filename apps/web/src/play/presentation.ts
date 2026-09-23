import type { ReactNode } from "react";
import type { PlaySnapshot } from "@26/shared";

export type QuestionPresentation = (props: {
  surface: "phone" | "stage";
  play: PlaySnapshot;
}) => ReactNode;

const customPresentations: Record<string, QuestionPresentation | undefined> = {};

/**
 * `standard` keeps the existing phone and stage components.
 * A later design can register another id without changing the question's mechanic.
 */
export function resolvePresentation(id: string): QuestionPresentation | undefined {
  if (id === "standard") {
    return undefined;
  }
  return customPresentations[id];
}

export function renderPresentation(
  id: string,
  props: {
    surface: "phone" | "stage";
    play: PlaySnapshot;
  },
): ReactNode | undefined {
  return resolvePresentation(id)?.(props);
}
