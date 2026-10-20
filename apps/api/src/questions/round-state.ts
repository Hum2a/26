/** Small durable extension of the existing round store. Call inside the room transaction. */
export function readRoundState<T>(
  sql: SqlStorage,
  questionId: string,
  key: string,
): T | undefined {
  const row = sql
    .exec<{ payload: string }>(
      "SELECT payload FROM round_state WHERE question_id = ? AND state_key = ?",
      questionId,
      key,
    )
    .toArray()[0];
  return row ? (JSON.parse(row.payload) as T) : undefined;
}

export function writeRoundState(
  sql: SqlStorage,
  questionId: string,
  key: string,
  value: unknown,
): void {
  sql.exec(
    "INSERT INTO round_state (question_id, state_key, payload) VALUES (?, ?, ?) ON CONFLICT(question_id, state_key) DO UPDATE SET payload = excluded.payload",
    questionId,
    key,
    JSON.stringify(value),
  );
}
