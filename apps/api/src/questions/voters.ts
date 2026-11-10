import type { VoterDisplayMode } from "@26/shared";
import type { RoomClock, RoomPhase } from "../room/lifecycle.ts";
import type { ChoiceQuestion } from "./definition.ts";

/**
 * The live vote board: who picked each option, for the projector and the host.
 *
 * Each question's `attribution` decides when picks show: `live` while answers
 * are open and through the reveal, `after` from the reveal only, `never` not at
 * all. The host's room switch (`hidden`) overrides every question. Guest phones
 * never receive the list, so eighty phones are not sent eighty ids per answer
 * and nobody can copy the room from their own screen.
 */

const revealPhases: readonly RoomPhase[] = ["reveal", "scores", "final", "podium"];
const livePhases: readonly RoomPhase[] = ["collect", ...revealPhases];

export const voterDisplayMessage = "Choose whether picks show on the big screen.";

export function readVoterDisplay(sql: SqlStorage): {
  mode: VoterDisplayMode;
  history: { atMs: number; mode: VoterDisplayMode }[];
} {
  const row = sql
    .exec<{
      voter_display: string;
      voter_display_history: string;
    }>(`SELECT voter_display, voter_display_history FROM room`)
    .toArray()[0];
  const mode: VoterDisplayMode =
    row?.voter_display === "hidden" ? "hidden" : "question";
  let history: { atMs: number; mode: VoterDisplayMode }[] = [];
  try {
    const parsed = JSON.parse(row?.voter_display_history ?? "[]") as unknown;
    if (Array.isArray(parsed)) {
      history = parsed
        .filter(
          (entry): entry is { atMs: number; mode: VoterDisplayMode } =>
            typeof entry === "object" &&
            entry !== null &&
            Number.isSafeInteger((entry as { atMs: unknown }).atMs) &&
            ((entry as { mode: unknown }).mode === "question" ||
              (entry as { mode: unknown }).mode === "hidden"),
        )
        .slice(-20);
    }
  } catch {
    history = [];
  }
  return { mode, history };
}

/** Host-only view: the switch, its history and how many faces are showing. */
export function voterDisplayDetails(sql: SqlStorage) {
  const avatars =
    sql
      .exec<{ n: number }>(
        `SELECT COUNT(*) AS n FROM player p
         JOIN media_upload m
           ON m.media_id = p.avatar_media_id
          AND m.player_id = p.player_id
          AND m.purpose = 'face'
          AND m.status = 'accepted'
          AND m.hidden = 0
         WHERE p.revoked_at IS NULL`,
      )
      .toArray()[0]?.n ?? 0;
  return { ...readVoterDisplay(sql), avatars: Math.min(100, avatars) };
}

/** The room's switch. Validated again here; the room does not trust its caller. */
export function changeVoterDisplay(
  sql: SqlStorage,
  mode: VoterDisplayMode,
  now: number,
): void {
  if (
    (mode !== "question" && mode !== "hidden") ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    throw new Error(voterDisplayMessage);
  }
  const previous = readVoterDisplay(sql);
  const history = [...previous.history, { atMs: now, mode }].slice(-20);
  sql.exec(
    `UPDATE room SET voter_display = ?, voter_display_history = ?, state_version = state_version + 1`,
    mode,
    JSON.stringify(history),
  );
}

/** Whether this question's picks may be drawn now, for this audience. */
export function showsVoters(
  question: Pick<ChoiceQuestion, "attribution"> & { outcome: { kind: string } },
  phase: RoomPhase,
  audience: "guest" | "stage" | "control",
  mode: VoterDisplayMode,
): boolean {
  if (audience === "guest" || mode === "hidden") return false;
  // Push-your-luck draws its own ladder of bails, not an option board.
  if (question.outcome.kind === "push") return false;
  if (question.attribution === "live") return livePhases.includes(phase);
  if (question.attribution === "after") return revealPhases.includes(phase);
  return false;
}

/**
 * Each option's voters in arrival order. One query for the whole board, so a
 * broadcast builds it once per audience rather than once per socket.
 */
export function choiceVoters(
  sql: SqlStorage,
  question: ChoiceQuestion,
  room: Pick<RoomClock, "phase">,
  audience: "guest" | "stage" | "control",
): { optionId: string; playerIds: string[] }[] | null {
  if (!showsVoters(question, room.phase, audience, readVoterDisplay(sql).mode)) {
    return null;
  }
  const rows = sql
    .exec<{ option_id: string; player_id: string }>(
      `SELECT choice_answer.option_id, choice_answer.player_id
       FROM choice_answer
       JOIN player ON player.player_id = choice_answer.player_id
       WHERE choice_answer.question_id = ? AND player.revoked_at IS NULL
       ORDER BY choice_answer.received_at ASC, player.rowid ASC`,
      question.id,
    )
    .toArray();
  const multiple = question.outcome.kind === "multiple";
  const byOption = new Map<string, string[]>(
    question.options.map((option) => [option.id, []]),
  );
  for (const row of rows) {
    const picked = multiple ? row.option_id.split(",") : [row.option_id];
    for (const optionId of picked) {
      const list = byOption.get(optionId);
      if (list && list.length < 100) list.push(row.player_id);
    }
  }
  return question.options.map((option) => ({
    optionId: option.id,
    playerIds: byOption.get(option.id) ?? [],
  }));
}
