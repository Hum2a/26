/** Presentation policy only; device context never grants authority. */
export function photoFamily(
  sql: SqlStorage,
  playerId: string,
): "iphone" | "android" | "unknown" {
  const row = sql
    .exec<{ report_json: string }>(
      `SELECT d.report_json FROM player p JOIN device_context d ON d.context_id = p.device_context_id WHERE p.player_id = ?`,
      playerId,
    )
    .toArray()[0];
  try {
    const report = JSON.parse(row?.report_json ?? "null") as {
      deviceFamily?: unknown;
      classification?: unknown;
    } | null;
    return report?.classification === "reported" &&
      (report.deviceFamily === "iphone" || report.deviceFamily === "android")
      ? report.deviceFamily
      : "unknown";
  } catch {
    return "unknown";
  }
}

export function photoBiasState(sql: SqlStorage) {
  const row = sql
    .exec<{
      photo_bias_enabled: number;
      photo_bias_revision: number;
      photo_bias_history: string;
    }>(`SELECT photo_bias_enabled, photo_bias_revision, photo_bias_history FROM room`)
    .toArray()[0];
  return {
    enabled: row?.photo_bias_enabled !== 0,
    revision: row?.photo_bias_revision ?? 0,
    history: JSON.parse(row?.photo_bias_history ?? "[]") as {
      atMs: number;
      enabled: boolean;
    }[],
  };
}

export function photoBiasDetails(sql: SqlStorage) {
  const counts = new Map(
    sql
      .exec<{ photo_family: string; n: number }>(
        `SELECT photo_family, COUNT(*) AS n FROM media_upload WHERE kind = 'photo' AND status = 'accepted' GROUP BY photo_family`,
      )
      .toArray()
      .map((row) => [row.photo_family, row.n]),
  );
  return {
    ...photoBiasState(sql),
    iphonePhotos: counts.get("iphone") ?? 0,
    androidPhotos: counts.get("android") ?? 0,
    otherPhotos: counts.get("unknown") ?? 0,
  };
}

export function changePhotoBias(sql: SqlStorage, enabled: boolean, now: number) {
  if (typeof enabled !== "boolean" || !Number.isSafeInteger(now) || now < 0)
    throw new Error("That photo treatment was not accepted.");
  const previous = photoBiasState(sql);
  const history = [...previous.history, { atMs: now, enabled }].slice(-20);
  sql.exec(
    `UPDATE room SET photo_bias_enabled = ?, photo_bias_revision = photo_bias_revision + 1, photo_bias_history = ?, state_version = state_version + 1`,
    enabled ? 1 : 0,
    JSON.stringify(history),
  );
}

export function roughPhoto(sql: SqlStorage, mediaId: string): boolean {
  return (
    photoBiasState(sql).enabled &&
    sql
      .exec<{ photo_family: string }>(
        `SELECT photo_family FROM media_upload WHERE media_id = ?`,
        mediaId,
      )
      .toArray()[0]?.photo_family === "iphone"
  );
}
