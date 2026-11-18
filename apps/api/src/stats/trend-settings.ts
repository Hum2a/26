import {
  trendCardIdSchema,
  trendChangeSchema,
  type TrendChange,
  type TrendDisplay,
} from "@26/shared";

/**
 * The host's answer-trend switches, stored on the room row: whether the
 * projector and the phones show trends, which individual cards are hidden,
 * and the last twenty changes. Both switches default to shown.
 */
export const trendSettingsMessage = "Choose a valid answer-trends setting.";

export type TrendSettings = {
  stage: TrendDisplay;
  phones: TrendDisplay;
  hiddenCards: string[];
  history: { atMs: number; change: TrendChange; cardId?: string }[];
};

export function readTrendSettings(sql: SqlStorage): TrendSettings {
  const row = sql
    .exec<{
      trend_stage: string;
      trend_phones: string;
      trend_hidden: string;
      trend_history: string;
    }>(`SELECT trend_stage, trend_phones, trend_hidden, trend_history FROM room`)
    .toArray()[0];
  return {
    stage: row?.trend_stage === "hidden" ? "hidden" : "shown",
    phones: row?.trend_phones === "hidden" ? "hidden" : "shown",
    hiddenCards: parseList(row?.trend_hidden)
      .filter((id): id is string => trendCardIdSchema.safeParse(id).success)
      .slice(-200),
    history: parseList(row?.trend_history)
      .flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const record = entry as { atMs?: unknown; change?: unknown; cardId?: unknown };
        const change = trendChangeSchema.safeParse(record.change);
        if (!change.success || !Number.isSafeInteger(record.atMs)) return [];
        const cardId = trendCardIdSchema.safeParse(record.cardId);
        return [
          {
            atMs: record.atMs as number,
            change: change.data,
            ...(cardId.success ? { cardId: cardId.data } : {}),
          },
        ];
      })
      .slice(-20),
  };
}

/**
 * Applies one host change. Validated again here: the room does not trust
 * its caller. Hiding a card that is already hidden (or restoring one that is
 * not) is refused, so a replayed request cannot add a second history line.
 */
export function changeTrendSettings(
  sql: SqlStorage,
  change: TrendChange,
  now: number,
  cardId?: string,
): void {
  if (
    !trendChangeSchema.safeParse(change).success ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    throw new Error(trendSettingsMessage);
  }
  const settings = readTrendSettings(sql);
  const needsCard = change === "card-hidden" || change === "card-restored";
  const card = needsCard ? trendCardIdSchema.safeParse(cardId) : null;
  if (needsCard && !card?.success) {
    throw new Error("Choose a trend card from this room.");
  }
  const id = card?.success ? card.data : undefined;
  let hidden = settings.hiddenCards;
  if (change === "card-hidden") {
    if (hidden.includes(id!)) throw new Error("That trend card is already hidden.");
    hidden = [...hidden, id!].slice(-200);
  }
  if (change === "card-restored") {
    if (!hidden.includes(id!)) throw new Error("That trend card is not hidden.");
    hidden = hidden.filter((item) => item !== id);
  }
  const stage =
    change === "stage-hidden"
      ? "hidden"
      : change === "stage-shown"
        ? "shown"
        : settings.stage;
  const phones =
    change === "phones-hidden"
      ? "hidden"
      : change === "phones-shown"
        ? "shown"
        : settings.phones;
  const history = [
    ...settings.history,
    { atMs: now, change, ...(id ? { cardId: id } : {}) },
  ].slice(-20);
  sql.exec(
    `UPDATE room SET trend_stage = ?, trend_phones = ?, trend_hidden = ?, trend_history = ?,
       state_version = state_version + 1`,
    stage,
    phones,
    JSON.stringify(hidden),
    JSON.stringify(history),
  );
}

function parseList(json: string | undefined): unknown[] {
  try {
    const parsed: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
