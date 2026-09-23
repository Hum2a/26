import type { Question } from "./definition.ts";

/** Public fields shared by every question kind. Answers, notes, and future reveals stay off this object. */
export function publicQuestionCore(question: Question, index: number, total: number) {
  return {
    id: question.id,
    index,
    total,
    prompt: question.prompt,
    points: question.points,
    illustrative: question.illustrative,
    attribution: question.attribution,
    presentation: question.presentation,
    ...(question.instructions ? { instructions: question.instructions } : {}),
  };
}

export function attachAudienceFields<T extends object>(
  view: T,
  question: { notes?: string; explanation?: string },
  audience: "guest" | "stage" | "control",
  scored: boolean,
): T & { explanation: string | null; presenterNotes?: string } {
  const explanation = scored && question.explanation ? question.explanation : null;
  if (audience === "control" && question.notes) {
    return { ...view, explanation, presenterNotes: question.notes };
  }
  return { ...view, explanation };
}
