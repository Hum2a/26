import type { LobbySnapshot } from "@26/shared";
import { phaseLabel } from "./phase-label";

const nameCap = 24;
const highlightCap = 4;

export type TalkingGuest = {
  playerId: string;
  nickname: string;
};

export type TalkingPlace = {
  place: number;
  playerId: string | null;
  nickname: string;
  points: number;
};

export type TalkingPoints = {
  roundLine: string | null;
  currentPrompt: string | null;
  nextLine: string | null;
  phaseLine: string;
  answeredLine: string | null;
  waiting: TalkingGuest[];
  waitingExtra: number;
  answered: TalkingGuest[];
  answeredExtra: number;
  top: TalkingPlace[];
  closest: { ahead: string; behind: string; gap: number } | null;
  highlights: string[];
  recent: string[];
};

function capNames(rows: TalkingGuest[]): { shown: TalkingGuest[]; extra: number } {
  if (rows.length <= nameCap) {
    return { shown: rows, extra: 0 };
  }
  return { shown: rows.slice(0, nameCap), extra: rows.length - nameCap };
}

function placesFromScores(
  rows: { playerId: string | null; nickname: string; points: number }[],
): TalkingPlace[] {
  const ranked: TalkingPlace[] = [];
  let previous: TalkingPlace | undefined;
  for (const row of rows) {
    const place =
      previous && previous.points === row.points ? previous.place : ranked.length + 1;
    const entry = {
      place,
      playerId: row.playerId,
      nickname: row.nickname,
      points: row.points,
    };
    ranked.push(entry);
    previous = entry;
  }
  return ranked;
}

/** Live lines the host and presenter can talk about, from fields already on the snapshot. */
export function talkingPoints(snapshot: LobbySnapshot): TalkingPoints {
  const play = snapshot.play;
  const roster = (snapshot.adminPlayers ?? []).filter((player) => !player.removed);
  const connected = roster.filter((player) => player.connected);
  const knownAnswers = connected.some((player) => player.answered !== null);
  const waitingAll = knownAnswers
    ? connected.filter((player) => player.answered === false)
    : [];
  const answeredAll = knownAnswers
    ? connected.filter((player) => player.answered === true)
    : [];
  const waiting = capNames(
    waitingAll.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
    })),
  );
  const answered = capNames(
    answeredAll.map((player) => ({
      playerId: player.playerId,
      nickname: player.nickname,
    })),
  );
  const scored = placesFromScores(
    roster.length
      ? [...roster]
          .sort(
            (a, b) =>
              b.points - a.points || a.nickname.localeCompare(b.nickname, "en-GB"),
          )
          .map((player) => ({
            playerId: player.playerId,
            nickname: player.nickname,
            points: player.points,
          }))
      : (play?.standings ?? []).map((row) => ({
          playerId: null,
          nickname: row.nickname,
          points: row.points,
        })),
  );
  let closest: TalkingPoints["closest"] = null;
  for (let index = 0; index < scored.length - 1; index += 1) {
    const ahead = scored[index]!;
    const behind = scored[index + 1]!;
    const gap = ahead.points - behind.points;
    if (gap <= 0) continue;
    if (!closest || gap < closest.gap) {
      closest = { ahead: ahead.nickname, behind: behind.nickname, gap };
    }
  }
  const connectedCount = connected.length || snapshot.players.length;
  const answeredCount = play?.submissionCount ?? answeredAll.length;
  const lastRound = play
    ? play.question.index >= play.question.total && !snapshot.nextQuestion
    : false;
  return {
    roundLine: play ? `Round ${play.question.index} of ${play.question.total}` : null,
    currentPrompt: play?.question.prompt ?? null,
    nextLine: snapshot.nextQuestion
      ? `Coming up: ${snapshot.nextQuestion.title}`
      : lastRound
        ? "Last round"
        : null,
    phaseLine: snapshot.paused
      ? `${phaseLabel(snapshot.phase)} · paused`
      : snapshot.held
        ? `${phaseLabel(snapshot.phase)} · waiting for a cue`
        : phaseLabel(snapshot.phase),
    answeredLine: play
      ? `${answeredCount} of ${connectedCount} answered`
      : snapshot.players.length
        ? `${snapshot.players.length} in the lobby`
        : null,
    waiting: waiting.shown,
    waitingExtra: waiting.extra,
    answered: answered.shown,
    answeredExtra: answered.extra,
    top: scored.slice(0, 3),
    closest,
    highlights: (snapshot.highlights ?? [])
      .filter((card) => card.display === "eligible")
      .slice(0, highlightCap)
      .map((card) => card.stage),
    recent: play?.liveSample ?? [],
  };
}
