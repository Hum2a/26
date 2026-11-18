import { mapGuessPoints, mapPinSchema, pinDistanceKm, type MapPin } from "@26/shared";
import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerLateMessage,
} from "../room/limits.ts";
import type { GameStore } from "../room/lifecycle.ts";
import type { MapGuessQuestion } from "./definition.ts";
import { publicQuestionCore } from "./project.ts";
import { collectDeadline, gateMessage } from "./slider.ts";

function parsePin(payload: string): MapPin {
  return mapPinSchema.parse(JSON.parse(payload));
}

export function readMapPin(sql: SqlStorage, playerId: string, questionId: string) {
  const row = sql
    .exec<{ payload: string }>(
      "SELECT payload FROM round_response WHERE player_id = ? AND question_id = ? AND kind = 'map-guess'",
      playerId,
      questionId,
    )
    .toArray()[0];
  return row ? parsePin(row.payload) : undefined;
}

export function acceptMapPin(
  sql: SqlStorage,
  store: GameStore,
  playerId: string,
  value: unknown,
  now: number,
  question: MapGuessQuestion,
): { ok: true } | { ok: false; message: string } {
  const gate = gateMessage(store, now);
  if (gate) return { ok: false, message: gate };
  const room = store.readRoom();
  if (room.phase !== "collect") return { ok: false, message: answerClosedMessage };
  const checked = mapPinSchema.safeParse(value);
  if (!checked.success) return { ok: false, message: "Choose a valid pin on the map." };
  if (readMapPin(sql, playerId, question.id))
    return { ok: false, message: answerDuplicateMessage };
  const deadline = collectDeadline(store, room.phaseGeneration);
  if (deadline === undefined) return { ok: false, message: answerLateMessage };
  sql.exec(
    `INSERT INTO round_response (player_id, question_id, kind, payload, received_at, deadline_at, device_context_id)
     VALUES (?, ?, 'map-guess', ?, ?, ?, (SELECT device_context_id FROM player WHERE player_id = ?))`,
    playerId,
    question.id,
    JSON.stringify(checked.data),
    now,
    deadline,
    playerId,
  );
  sql.exec("UPDATE room SET state_version = state_version + 1");
  return { ok: true };
}

function mapRows(sql: SqlStorage, question: MapGuessQuestion) {
  return sql
    .exec<{ playerId: string; nickname: string; payload: string | null }>(
      `SELECT player.player_id AS playerId, player.nickname, response.payload
     FROM player LEFT JOIN round_response AS response
     ON response.player_id = player.player_id AND response.question_id = ? AND response.kind = 'map-guess'
     WHERE player.revoked_at IS NULL ORDER BY player.rowid`,
      question.id,
    )
    .toArray()
    .map(({ payload, ...player }) => {
      const pin = payload === null ? undefined : parsePin(payload);
      return {
        ...player,
        pin,
        distanceKm: pin ? pinDistanceKm(pin, question.target) : null,
      };
    });
}

export function scoreMapGuesses(
  sql: SqlStorage,
  question: MapGuessQuestion,
  now: number,
) {
  for (const row of mapRows(sql, question)) {
    sql.exec(
      `INSERT OR IGNORE INTO score_ledger (question_id, player_id, points, detail, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      question.id,
      row.playerId,
      row.distanceKm === null ? 0 : mapGuessPoints(row.distanceKm, question.points),
      row.distanceKm === null ? "missing" : `distance-km:${row.distanceKm.toFixed(2)}`,
      now,
    );
  }
}

export function publicMapQuestion(
  question: MapGuessQuestion,
  index: number,
  total: number,
) {
  return { ...publicQuestionCore(question, index, total), kind: "map-guess" as const };
}

export function mapGuessReveal(
  sql: SqlStorage,
  question: MapGuessQuestion,
  scored: boolean,
  showNames: boolean,
) {
  if (!scored) return null;
  const { lat, lng, label } = question.target;
  const rows = mapRows(sql, question)
    .flatMap((row) =>
      row.pin && row.distanceKm !== null
        ? [{ pin: row.pin, nickname: row.nickname, distanceKm: row.distanceKm }]
        : [],
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return {
    kind: "map-guess" as const,
    target: { lat, lng },
    label,
    pins: rows.slice(0, 100).map(({ pin }) => pin),
    closest: showNames
      ? rows.slice(0, 3).map(({ nickname, distanceKm }) => ({ nickname, distanceKm }))
      : [],
  };
}

export function mapHostResponses(
  sql: SqlStorage,
  question: MapGuessQuestion,
  scored: boolean,
) {
  return mapRows(sql, question)
    .flatMap(({ playerId, nickname, pin, distanceKm }) =>
      pin
        ? [
            {
              playerId,
              nickname,
              summary:
                scored && distanceKm !== null
                  ? `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)} · ${distanceKm.toFixed(1)} km away`
                  : `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`,
            },
          ]
        : [],
    )
    .slice(0, 100);
}
