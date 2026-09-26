export function waitingSummary(
  count: number,
  players: number,
): { waiting: number; percentage: number } {
  const safePlayers = Number.isFinite(players) ? Math.max(0, Math.floor(players)) : 0;
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (safePlayers === 0) {
    return { waiting: 0, percentage: 0 };
  }
  const submitted = Math.min(safeCount, safePlayers);
  return {
    waiting: safePlayers - submitted,
    percentage: Math.round((submitted / safePlayers) * 100),
  };
}
