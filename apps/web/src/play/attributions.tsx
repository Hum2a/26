import type { PlaySnapshot } from "@26/shared";

export function AnswerNames({ play }: { play: PlaySnapshot }) {
  if (play.liveSample && play.liveSample.length > 0) {
    return (
      <p>
        {play.submissionCount} in. Recent names: {play.liveSample.join(", ")}.
      </p>
    );
  }
  if (!play.attributions) {
    return null;
  }
  return (
    <ul className="grid gap-2">
      {play.attributions.map((group) => {
        const label =
          play.question.kind === "choice"
            ? (play.question.options.find((option) => option.id === group.optionId)
                ?.label ?? group.optionId)
            : group.optionId;
        return (
          <li key={group.optionId}>
            {label}:{" "}
            {group.nicknames.length > 0 ? group.nicknames.join(", ") : "No one"}
          </li>
        );
      })}
    </ul>
  );
}
