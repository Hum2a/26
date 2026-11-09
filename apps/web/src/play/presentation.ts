import type { ReactNode } from "react";
import type { CustomPresentationId, PlaySnapshot, RoomPhaseName } from "@26/shared";
import type { TierPlacement } from "./controls/TierAssign";
import { designs } from "./designs/registry";

/** What a phone design may do. The server still decides whether an answer is accepted. */
export type PhoneControls = {
  /** Answers are open, and this phone has not answered yet. */
  open: boolean;
  pending: boolean;
  selectedId?: string;
  /** The send button should dodge (a troll is active). */
  dodge: boolean;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
  onRank: (placements: TierPlacement[]) => void;
  onText: (body: string) => void;
};

export type PresentationProps =
  | {
      surface: "phone";
      phase: RoomPhaseName;
      play: PlaySnapshot;
      controls: PhoneControls;
    }
  | {
      surface: "stage";
      phase: RoomPhaseName;
      play: PlaySnapshot;
    };

/** A design returns nothing when the snapshot is not the kind it draws, and the standard view takes over. */
export type QuestionPresentation = (props: PresentationProps) => ReactNode | undefined;

const customPresentations: Record<CustomPresentationId, QuestionPresentation> = designs;

/**
 * `standard` keeps the existing phone and stage components.
 * A custom id draws its own phone and stage without changing the question's mechanic.
 */
export function resolvePresentation(id: string): QuestionPresentation | undefined {
  if (id === "standard") {
    return undefined;
  }
  return (customPresentations as Record<string, QuestionPresentation | undefined>)[id];
}

export function renderPresentation(
  id: string,
  props: PresentationProps,
): ReactNode | undefined {
  return resolvePresentation(id)?.(props) ?? undefined;
}
