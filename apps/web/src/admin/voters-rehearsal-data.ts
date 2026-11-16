import type { LobbyPlayer, PlaySnapshot } from "@26/shared";

/** Stand-in data for the vote board rehearsal. Nothing here reaches a room. */

export const optionSet = [
  { id: "a", label: "Stand-in option A" },
  { id: "b", label: "Stand-in option B" },
  { id: "c", label: "Stand-in option C" },
  { id: "d", label: "Stand-in option D" },
] as const;

export const standInCount = 24;

function standInId(index: number): string {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

/** A drawn stand-in face, so the rehearsal shows photo bubbles without real photos. */
export function standInFace(index: number): string | null {
  if (index % 3 === 2) return null; // Some players never add a photo: initials.
  const hue = (index * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 70% 62%)"/><circle cx="32" cy="34" r="18" fill="hsl(${(hue + 30) % 360} 45% 86%)"/><circle cx="25" cy="31" r="2.6" fill="#222"/><circle cx="39" cy="31" r="2.6" fill="#222"/><path d="M24 40 Q32 ${46 + (index % 3)} 40 40" stroke="#222" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const standInPlayers: LobbyPlayer[] = Array.from(
  { length: standInCount },
  (_, index) => ({ playerId: standInId(index), nickname: `Stand-in ${index + 1}` }),
);

export type Mode = "live" | "after" | "never";
export type Phase = "collect" | "reveal";

/** The snapshot the room would send the stage for these stand-in picks. */
export function rehearsalPlay(
  picks: readonly { playerId: string; optionId: string }[],
  mode: Mode,
  phase: Phase,
  answer: string,
): PlaySnapshot {
  const shows = mode === "live" || (mode === "after" && phase === "reveal");
  return {
    question: {
      kind: "choice",
      id: "vote-board-rehearsal",
      index: 1,
      total: 1,
      prompt: "Stand-in question for the vote board",
      points: 0,
      illustrative: true,
      attribution: mode,
      presentation: "standard",
      options: optionSet.map((option) => ({ ...option })),
      speedBonus: false,
      modifiers: [],
      suppressSpeedBonus: false,
    },
    submissionCount: picks.length,
    selfAnswer: null,
    selfBallot: null,
    ballot: null,
    duel: null,
    reveal:
      phase === "reveal"
        ? {
            kind: "choice",
            correctOptionId: answer,
          }
        : null,
    selfAward: null,
    selfStanding: null,
    standings: null,
    liveSample: null,
    attributions: null,
    voters: shows
      ? optionSet.map((option) => ({
          optionId: option.id,
          playerIds: picks
            .filter((pick) => pick.optionId === option.id)
            .map((pick) => pick.playerId),
        }))
      : null,
    explanation: null,
  } as PlaySnapshot;
}
