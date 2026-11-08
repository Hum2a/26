import {
  moderationClosedMessage,
  moderationNotShownMessage,
  shortlistClosedMessage,
  shortlistMissingMessage,
} from "../room/limits.ts";
import { createSqlStore } from "../room/sql-store.ts";
import { setAnswerHidden } from "./hidden-answers.ts";
import { questionFor } from "./registry.ts";
import { typedAnswers } from "./typed.ts";
import { excludeAuthor, includeAuthor, moderateAnswer } from "./vote.ts";

/**
 * The host's "exclude" and "include" commands for the current question's
 * written answers. The room checks the host credential before this runs; this
 * checks again that the question, phase and answer allow it.
 * - Shortlist vote: the existing shortlist, unchanged.
 * - All-answer vote: hide or restore the answer (see `moderateAnswer`).
 * - Typed commonness question, the one typed format that shows answers in
 *   public: hide or restore its text in the reveal. Scores are unaffected.
 */
export function moderateCurrentAnswer(
  sql: SqlStorage,
  playerId: string,
  hide: boolean,
): void {
  const room = createSqlStore(sql).readRoom();
  const question = questionFor(room);
  if (question?.kind === "vote") {
    if (question.candidateMode === "shortlist") {
      if (hide) excludeAuthor(sql, playerId);
      else includeAuthor(sql, playerId);
      return;
    }
    moderateAnswer(sql, playerId, hide);
    return;
  }
  if (question?.kind === "typed") {
    if (question.scoring !== "commonness") {
      throw new Error(moderationNotShownMessage);
    }
    if (
      room.phase !== "collect" &&
      room.phase !== "reveal" &&
      room.phase !== "scores"
    ) {
      throw new Error(moderationClosedMessage);
    }
    const group = setAnswerHidden(
      sql,
      question.id,
      typedAnswers(sql, question.id),
      playerId,
      hide,
    );
    if (group.length === 0) {
      throw new Error(shortlistMissingMessage);
    }
    sql.exec(`UPDATE room SET state_version = state_version + 1`);
    return;
  }
  throw new Error(shortlistClosedMessage);
}
