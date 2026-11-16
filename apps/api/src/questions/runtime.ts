/**
 * Rough on-screen length of one round, for planning the show. The host can
 * pause, and wordle or kart rounds may finish early, so this is an estimate.
 * Beats: intro 5 s, prompt 8 s, the round's own windows, reveal 12 s, scores 10 s.
 */
export const fixedBeatsMs = 5_000 + 8_000 + 12_000 + 10_000;

export function estimateRoundMs(question: {
  collectMs?: number;
  voteMs?: number;
  predictMs?: number;
}): number {
  return (
    fixedBeatsMs +
    (question.collectMs ?? 0) +
    (question.voteMs ?? 0) +
    (question.predictMs ?? 0)
  );
}
