import {
  minimumComparisonGroup,
  screenGroupVersion,
  widerScreenShortEdge,
  type StatCard,
} from "@26/shared";

export type ClientClass = "guest" | "synthetic" | "test" | "host";

export type StatsPlayer = {
  playerId: string;
  nickname: string;
  clientClass: ClientClass;
  family: string | null;
  classification: "reported" | "ambiguous" | "unknown" | null;
  reconnects: number;
};

export type StatsAnswer = {
  playerId: string;
  questionId: string;
  optionId: string;
  optionLabel: string;
  correct: boolean;
  remainingMs: number;
  timed: boolean;
  family: string | null;
  screenGroup: "narrower" | "wider" | "unknown" | null;
};

export type StatsQuestion = {
  questionId: string;
  label: string;
  eligiblePlayerIds: string[];
};

export type StatsTroll = {
  effectId: string;
  actorId: string;
  targetId: string;
  kind: string;
  label: string;
  refunded: boolean;
};

/**
 * Records already accepted by the room. Counts are players or those responses.
 * Sockets, retries, and raw browser reports are not inputs.
 */
export type StatsSource = {
  gameId: string;
  sourceRevision: number;
  illustrative: boolean;
  complete: boolean;
  players: StatsPlayer[];
  questions: StatsQuestion[];
  answers: StatsAnswer[];
  trolls: StatsTroll[];
  scores: { playerId: string; points: number }[];
  revealedQuestionIds: string[];
  mediaPlayers: { playerId: string; kind: "photo" | "voice" }[];
};

export type StatFact = {
  id: string;
  scope: "game" | "question" | "player";
  scopeId: string;
  sourceRevision: number;
  metric: string;
  grouping: string;
  numerator: number;
  denominator: number;
  unknownCount: number;
  display: "eligible" | "suppressed" | "withheld";
  labels: string[];
  parts: { label: string; count: number }[];
};

const deviceGrouping =
  "First participating device context. One guest once. Host, test, and synthetic clients are excluded. A transferred session stays one player.";

const submissionGrouping =
  "Device family on the context stored with the accepted response. A missing context stays unknown.";

const screenGrouping = `Reported screen-size group, screenGroupVersion ${screenGroupVersion}. Wider means a short CSS edge of at least ${widerScreenShortEdge} pixels. The cutoff was fixed before analysis. Context at submission.`;

const divisiveGrouping =
  "Smallest gap between the two most common accepted answers, divided by the accepted responses. Equal gaps tie. A missing answer is not another option.";

const fastestGrouping =
  "Correct accepted answers. Faster means more time left before the deadline on the server receipt. Equal time left is a tie.";

const trollGrouping =
  "Accepted troll effects that were not refunded. One effect is one use. A retry is not another use.";

const reconnectGrouping =
  "The stored reconnect count for that player. Another socket is not another player. Submission retries are not reconnects.";

const familyNoun: Record<string, [string, string]> = {
  iphone: ["an iPhone", "iPhones"],
  ipad: ["an iPad", "iPads"],
  android: ["an Android phone", "Android phones"],
  desktop: ["a desktop", "desktops"],
  other: ["another kind of device", "other devices"],
};

export function aggregateFacts(source: StatsSource): StatFact[] {
  const facts: StatFact[] = [];
  facts.push(...deviceFacts(source));
  for (const question of source.questions) {
    facts.push(...questionFacts(source, question));
  }
  facts.push(...agreementFacts(source));
  facts.push(...fastestFacts(source));
  facts.push(...trollFacts(source));
  facts.push(...reconnectFacts(source));
  facts.push(...mediaFacts(source));
  facts.push(...recapFacts(source));
  return facts;
}

/**
 * Facts a future wording model may receive. There is no model call here.
 * A later wording pass may only repeat numbers already stored on these facts.
 */
export function factsForWording(facts: readonly StatFact[]): StatFact[] {
  return facts.map((fact) => ({
    id: fact.id,
    scope: fact.scope,
    scopeId: fact.scopeId,
    sourceRevision: fact.sourceRevision,
    metric: fact.metric,
    grouping: fact.grouping,
    numerator: fact.numerator,
    denominator: fact.denominator,
    unknownCount: fact.unknownCount,
    display: fact.display,
    labels: [...fact.labels],
    parts: fact.parts.map((part) => ({ label: part.label, count: part.count })),
  }));
}

export function factFigures(fact: StatFact): number[] {
  return [
    fact.numerator,
    fact.denominator,
    fact.unknownCount,
    ...fact.parts.map((part) => part.count),
  ];
}

export function presentStats(
  source: StatsSource,
  place: "preview" | "stage" | "recap",
  playerId?: string,
): { highlights?: StatCard[]; recap?: StatCard[] } {
  const facts = aggregateFacts(source);
  const revealed = new Set(source.revealedQuestionIds);
  if (place === "recap" && playerId) {
    const recap = recapCards(
      source,
      facts.filter(
        (fact) =>
          fact.scope === "player" &&
          fact.scopeId === playerId &&
          fact.display !== "withheld" &&
          (fact.metric !== "recap-fastest" || revealed.has(fact.labels[1] ?? "")),
      ),
    );
    return recap.length > 0 ? { recap } : {};
  }
  const host = place === "preview";
  const shown = facts.filter((fact) => {
    if (fact.scope === "player" || fact.display === "withheld") {
      return false;
    }
    if (!host && fact.display === "suppressed") {
      return false;
    }
    if (fact.metric === "fastest" && !host && !revealed.has(fact.scopeId)) {
      return false;
    }
    return fact.display === "eligible" || fact.display === "suppressed";
  });
  const highlights = highlightCards(source, shown);
  return highlights.length > 0 ? { highlights } : {};
}

function deviceFacts(source: StatsSource): StatFact[] {
  const people = guests(source);
  const known = people.filter(classified);
  const unknown = people.length - known.length;
  const counts = new Map<string, { total: number; ambiguous: number }>();
  for (const player of known) {
    const family = player.family ?? "unknown";
    const row = counts.get(family) ?? { total: 0, ambiguous: 0 };
    row.total += 1;
    if (player.classification === "ambiguous") {
      row.ambiguous += 1;
    }
    counts.set(family, row);
  }
  const facts: StatFact[] = [];
  for (const [family, row] of counts) {
    facts.push(
      make(source, {
        id: `device-family:${family}`,
        scope: "game",
        scopeId: source.gameId,
        metric: "device-family",
        grouping: deviceGrouping,
        numerator: row.total,
        denominator: known.length,
        unknownCount: unknown,
        display: known.length > 0 ? "eligible" : "withheld",
        labels: [family],
        parts: [
          { label: "ambiguous", count: row.ambiguous },
          known.length >= minimumComparisonGroup
            ? { label: "percent", count: percent(row.total, known.length) }
            : { label: "minimumGroup", count: minimumComparisonGroup },
        ],
      }),
    );
  }
  if (unknown > 0 || known.length === 0) {
    facts.push(
      make(source, {
        id: "device-unclassified",
        scope: "game",
        scopeId: source.gameId,
        metric: "device-unclassified",
        grouping: deviceGrouping,
        numerator: unknown,
        denominator: people.length,
        unknownCount: unknown,
        display: people.length > 0 ? "eligible" : "withheld",
        labels: [],
        parts: [],
      }),
    );
  }
  return facts;
}

function questionFacts(source: StatsSource, question: StatsQuestion): StatFact[] {
  const answers = uniqueAnswers(
    guestAnswers(source).filter((answer) => answer.questionId === question.questionId),
  );
  const missing = missingCount(source, question, answers);
  if (answers.length === 0) {
    return [
      make(source, {
        id: `distribution:${question.questionId}`,
        scope: "question",
        scopeId: question.questionId,
        metric: "answer-distribution",
        grouping:
          "Accepted responses only. No accepted response means the denominator is zero.",
        numerator: 0,
        denominator: 0,
        unknownCount: missing,
        display: "withheld",
        labels: [question.label],
        parts: [],
      }),
    ];
  }
  const byOption = new Map<string, { label: string; count: number }>();
  for (const answer of answers) {
    const row = byOption.get(answer.optionId) ?? {
      label: answer.optionLabel,
      count: 0,
    };
    row.count += 1;
    byOption.set(answer.optionId, row);
  }
  const parts = [...byOption.entries()].map(([optionId, row]) => ({
    label: `${optionId}:${row.label}`,
    count: row.count,
  }));
  const facts: StatFact[] = [
    make(source, {
      id: `distribution:${question.questionId}`,
      scope: "question",
      scopeId: question.questionId,
      metric: "answer-distribution",
      grouping: "One accepted response per player. Sockets are not responses.",
      numerator: Math.max(...parts.map((part) => part.count)),
      denominator: answers.length,
      unknownCount: missing,
      display: "eligible",
      labels: [question.label],
      parts,
    }),
  ];
  const ranked = [...byOption.entries()].sort(
    (left, right) => right[1].count - left[1].count,
  );
  const leader = ranked[0];
  const second = ranked[1];
  if (leader && second && second[1].count > 0) {
    facts.push(
      make(source, {
        id: `divisive:${question.questionId}`,
        scope: "question",
        scopeId: question.questionId,
        metric: "divisive",
        grouping: divisiveGrouping,
        numerator: leader[1].count - second[1].count,
        denominator: answers.length,
        unknownCount: missing,
        display: "eligible",
        labels: [question.label, leader[1].label, second[1].label],
        parts: [
          { label: leader[1].label, count: leader[1].count },
          { label: second[1].label, count: second[1].count },
        ],
      }),
    );
  }
  facts.push(...compositionFacts(source, question, answers, missing));
  facts.push(...likelihoodFacts(source, question, answers, missing, "family"));
  facts.push(...likelihoodFacts(source, question, answers, missing, "screen"));
  return facts;
}

function compositionFacts(
  source: StatsSource,
  question: StatsQuestion,
  answers: StatsAnswer[],
  missing: number,
): StatFact[] {
  const facts: StatFact[] = [];
  const options = new Map<string, StatsAnswer[]>();
  for (const answer of answers) {
    const rows = options.get(answer.optionId) ?? [];
    rows.push(answer);
    options.set(answer.optionId, rows);
  }
  for (const [optionId, rows] of options) {
    const known = rows.filter((answer) => knownFamily(answer.family));
    const unknown = rows.length - known.length;
    const counts = countBy(known, (answer) => answer.family ?? "");
    const top = mode(counts);
    if (!top || top.count * 2 <= known.length) {
      continue;
    }
    const display = known.length >= minimumComparisonGroup ? "eligible" : "suppressed";
    facts.push(
      make(source, {
        id: `composition:${question.questionId}:${optionId}`,
        scope: "question",
        scopeId: question.questionId,
        metric: "answer-composition",
        grouping: `${submissionGrouping} Most means more than half of the classified responses for this answer.`,
        numerator: top.count,
        denominator: known.length,
        unknownCount: unknown,
        display,
        labels: [question.label, rows[0]?.optionLabel ?? optionId, top.key],
        parts: groupParts(display, [
          { label: "missingAnswers", count: missing },
          { label: "responses", count: rows.length },
        ]),
      }),
    );
  }
  return facts;
}

function likelihoodFacts(
  source: StatsSource,
  question: StatsQuestion,
  answers: StatsAnswer[],
  missing: number,
  axis: "family" | "screen",
): StatFact[] {
  const facts: StatFact[] = [];
  const keyOf = (answer: StatsAnswer) =>
    axis === "family" ? answer.family : answer.screenGroup;
  const known = (answer: StatsAnswer) =>
    axis === "family"
      ? knownFamily(answer.family)
      : answer.screenGroup === "wider" || answer.screenGroup === "narrower";
  const classified = answers.filter(known);
  const unknown = answers.filter((answer) => !known(answer)).length;
  const groups = [...new Set(classified.map((answer) => keyOf(answer) ?? ""))];
  const options = [...new Set(answers.map((answer) => answer.optionId))];
  for (const optionId of options) {
    const optionLabel =
      answers.find((answer) => answer.optionId === optionId)?.optionLabel ?? optionId;
    for (const group of groups) {
      const inside = classified.filter((answer) => keyOf(answer) === group);
      const outside = classified.filter((answer) => keyOf(answer) !== group);
      const chosen = inside.filter((answer) => answer.optionId === optionId).length;
      const others = outside.filter((answer) => answer.optionId === optionId).length;
      if (inside.length === 0 || outside.length === 0) {
        continue;
      }
      if (!greaterRate(chosen, inside.length, others, outside.length)) {
        continue;
      }
      const ready =
        inside.length >= minimumComparisonGroup &&
        outside.length >= minimumComparisonGroup;
      facts.push(
        make(source, {
          id: `${axis === "family" ? "likelihood" : "screen"}:${question.questionId}:${group}:${optionId}`,
          scope: "question",
          scopeId: question.questionId,
          metric: axis === "family" ? "answer-likelihood" : "screen-likelihood",
          grouping: axis === "family" ? submissionGrouping : screenGrouping,
          numerator: chosen,
          denominator: inside.length,
          unknownCount: unknown + missing,
          display: ready ? "eligible" : "suppressed",
          labels: [question.label, optionLabel, group],
          parts: groupParts(ready ? "eligible" : "suppressed", [
            { label: "othersChose", count: others },
            { label: "othersAnswered", count: outside.length },
            ...(axis === "screen"
              ? [{ label: "widerShortEdgeCss", count: widerScreenShortEdge }]
              : []),
          ]),
        }),
      );
    }
  }
  return facts;
}

function agreementFacts(source: StatsSource): StatFact[] {
  const facts: StatFact[] = [];
  for (const question of source.questions) {
    const answers = uniqueAnswers(
      guestAnswers(source).filter(
        (answer) => answer.questionId === question.questionId,
      ),
    );
    const families = [
      ...new Set(answers.map((answer) => answer.family).filter(knownFamily)),
    ];
    let best: StatFact | undefined;
    for (let left = 0; left < families.length; left += 1) {
      for (let right = left + 1; right < families.length; right += 1) {
        const familyA = families[left] ?? "";
        const familyB = families[right] ?? "";
        const groupA = answers.filter((answer) => answer.family === familyA);
        const groupB = answers.filter((answer) => answer.family === familyB);
        if (
          groupA.length < minimumComparisonGroup ||
          groupB.length < minimumComparisonGroup
        ) {
          continue;
        }
        const modalA = strictMode(countBy(groupA, (answer) => answer.optionId));
        const modalB = strictMode(countBy(groupB, (answer) => answer.optionId));
        if (!modalA || !modalB || modalA.key !== modalB.key) {
          continue;
        }
        const label =
          groupA.find((answer) => answer.optionId === modalA.key)?.optionLabel ??
          modalA.key;
        const candidate = make(source, {
          id: `agreement:${question.questionId}:${familyA}:${familyB}`,
          scope: "question",
          scopeId: question.questionId,
          metric: "agreement",
          grouping:
            "Both device groups have at least 5 accepted responses and the same single most common answer. Closest means the higher of the two within-group rates is the smallest such lead.",
          numerator: modalA.count,
          denominator: groupA.length,
          unknownCount: answers.filter((answer) => !knownFamily(answer.family)).length,
          display: "eligible",
          labels: [question.label, label, familyA, familyB],
          parts: [
            { label: "otherChose", count: modalB.count },
            { label: "otherAnswered", count: groupB.length },
            { label: "minimumGroup", count: minimumComparisonGroup },
          ],
        });
        if (!best || strongerAgreement(candidate, best)) {
          best = candidate;
        }
      }
    }
    if (best) {
      facts.push(best);
    }
  }
  return facts;
}

function fastestFacts(source: StatsSource): StatFact[] {
  const people = new Map(guests(source).map((player) => [player.playerId, player]));
  const timed = uniqueAnswers(guestAnswers(source)).filter(
    (answer) => answer.correct && answer.timed && people.has(answer.playerId),
  );
  const byQuestion = new Map<string, StatsAnswer[]>();
  for (const answer of timed) {
    const rows = byQuestion.get(answer.questionId) ?? [];
    rows.push(answer);
    byQuestion.set(answer.questionId, rows);
  }
  const facts: StatFact[] = [];
  for (const [questionId, rows] of byQuestion) {
    const best = Math.max(...rows.map((answer) => answer.remainingMs));
    const winners = rows.filter((answer) => answer.remainingMs === best);
    const label =
      source.questions.find((question) => question.questionId === questionId)?.label ??
      questionId;
    const seconds = Math.round(best / 1000);
    facts.push(
      make(source, {
        id: `fastest:${questionId}`,
        scope: "question",
        scopeId: questionId,
        metric: "fastest",
        grouping: fastestGrouping,
        numerator: best,
        denominator: rows.length,
        unknownCount: 0,
        display: "eligible",
        labels: [
          label,
          ...winners.map((answer) => people.get(answer.playerId)?.nickname ?? ""),
        ],
        parts: [{ label: "seconds", count: seconds }],
      }),
    );
  }
  return facts;
}

function trollFacts(source: StatsSource): StatFact[] {
  const people = new Set(guests(source).map((player) => player.playerId));
  const used = source.trolls.filter(
    (troll) => !troll.refunded && people.has(troll.actorId),
  );
  const unique = dedupe(used, (troll) => troll.effectId);
  if (unique.length === 0) {
    return [
      make(source, {
        id: "troll-popular",
        scope: "game",
        scopeId: source.gameId,
        metric: "troll-popular",
        grouping: trollGrouping,
        numerator: 0,
        denominator: 0,
        unknownCount: 0,
        display: "withheld",
        labels: [],
        parts: [],
      }),
    ];
  }
  const counts = countBy(unique, (troll) => troll.kind);
  const top = Math.max(...[...counts.values()]);
  const leaders = [...counts.entries()].filter((entry) => entry[1] === top);
  return [
    make(source, {
      id: "troll-popular",
      scope: "game",
      scopeId: source.gameId,
      metric: "troll-popular",
      grouping: trollGrouping,
      numerator: top,
      denominator: unique.length,
      unknownCount: 0,
      display: "eligible",
      labels: leaders.map(
        ([kind]) => unique.find((troll) => troll.kind === kind)?.label ?? kind,
      ),
      parts: leaders.map(([kind, count]) => ({ label: kind, count })),
    }),
  ];
}

function reconnectFacts(source: StatsSource): StatFact[] {
  if (!source.complete) {
    return [];
  }
  const people = guests(source);
  const totals = new Map<string, number>();
  for (const player of people) {
    totals.set(player.playerId, 0);
  }
  for (const score of source.scores) {
    if (!totals.has(score.playerId)) {
      continue;
    }
    totals.set(score.playerId, (totals.get(score.playerId) ?? 0) + score.points);
  }
  const best = Math.max(0, ...totals.values());
  if (best <= 0) {
    return [
      make(source, {
        id: "reconnect-winner",
        scope: "game",
        scopeId: source.gameId,
        metric: "reconnect-winner",
        grouping: reconnectGrouping,
        numerator: 0,
        denominator: 0,
        unknownCount: 0,
        display: "withheld",
        labels: [],
        parts: [],
      }),
    ];
  }
  const winners = people.filter((player) => totals.get(player.playerId) === best);
  return [
    make(source, {
      id: "reconnect-winner",
      scope: "game",
      scopeId: source.gameId,
      metric: "reconnect-winner",
      grouping: reconnectGrouping,
      numerator: winners.length === 1 ? (winners[0]?.reconnects ?? 0) : winners.length,
      denominator: people.length,
      unknownCount: 0,
      display: "eligible",
      labels: winners.map((player) => player.nickname),
      parts: winners.map((player) => ({
        label: player.nickname,
        count: player.reconnects,
      })),
    }),
  ];
}

function mediaFacts(source: StatsSource): StatFact[] {
  const people = new Set(guests(source).map((player) => player.playerId));
  const photos = new Set(
    source.mediaPlayers
      .filter((row) => row.kind === "photo" && people.has(row.playerId))
      .map((row) => row.playerId),
  );
  if (photos.size === 0) {
    return [];
  }
  return [
    make(source, {
      id: "media-photos",
      scope: "game",
      scopeId: source.gameId,
      metric: "media-players",
      grouping: "Players with an accepted photo. Upload attempts are not extra photos.",
      numerator: photos.size,
      denominator: people.size,
      unknownCount: 0,
      display: "eligible",
      labels: [],
      parts: [],
    }),
  ];
}

function recapFacts(source: StatsSource): StatFact[] {
  const facts: StatFact[] = [];
  const revealed = new Set(source.revealedQuestionIds);
  for (const player of guests(source)) {
    if (classified(player) && player.family) {
      facts.push(
        make(source, {
          id: `player:${player.playerId}:device`,
          scope: "player",
          scopeId: player.playerId,
          metric: "recap-device",
          grouping: deviceGrouping,
          numerator: 1,
          denominator: 1,
          unknownCount: 0,
          display: "eligible",
          labels: [player.family, player.classification ?? "unknown"],
          parts: [],
        }),
      );
    }
    const own = uniqueAnswers(guestAnswers(source)).filter(
      (answer) =>
        answer.playerId === player.playerId &&
        answer.correct &&
        answer.timed &&
        revealed.has(answer.questionId),
    );
    if (own.length > 0) {
      const best = own.reduce((left, right) =>
        right.remainingMs > left.remainingMs ? right : left,
      );
      const label =
        source.questions.find((question) => question.questionId === best.questionId)
          ?.label ?? best.questionId;
      facts.push(
        make(source, {
          id: `player:${player.playerId}:fastest`,
          scope: "player",
          scopeId: player.playerId,
          metric: "recap-fastest",
          grouping: fastestGrouping,
          numerator: best.remainingMs,
          denominator: own.length,
          unknownCount: 0,
          display: "eligible",
          labels: [label, best.questionId],
          parts: [{ label: "seconds", count: Math.round(best.remainingMs / 1000) }],
        }),
      );
    }
    const sent = source.trolls.filter(
      (troll) => !troll.refunded && troll.actorId === player.playerId,
    );
    const received = source.trolls.filter(
      (troll) =>
        !troll.refunded &&
        troll.targetId === player.playerId &&
        troll.actorId !== player.playerId,
    );
    const sentUnique = dedupe(sent, (troll) => troll.effectId);
    const receivedUnique = dedupe(received, (troll) => troll.effectId);
    if (sentUnique.length > 0 || receivedUnique.length > 0) {
      facts.push(
        make(source, {
          id: `player:${player.playerId}:trolls`,
          scope: "player",
          scopeId: player.playerId,
          metric: "recap-trolls",
          grouping: trollGrouping,
          numerator: sentUnique.length,
          denominator: sentUnique.length + receivedUnique.length,
          unknownCount: 0,
          display: "eligible",
          labels: [],
          parts: [{ label: "received", count: receivedUnique.length }],
        }),
      );
    }
    if (player.reconnects > 0) {
      facts.push(
        make(source, {
          id: `player:${player.playerId}:reconnects`,
          scope: "player",
          scopeId: player.playerId,
          metric: "recap-reconnect",
          grouping: reconnectGrouping,
          numerator: player.reconnects,
          denominator: 1,
          unknownCount: 0,
          display: "eligible",
          labels: [],
          parts: [],
        }),
      );
    }
  }
  return facts;
}

function highlightCards(source: StatsSource, facts: StatFact[]): StatCard[] {
  const chosen: StatFact[] = [];
  chosen.push(...pickFamily(facts));
  const divisive = tiedDivisive(facts);
  if (divisive.length > 0) {
    chosen.push(...divisive);
  } else {
    const distribution = facts.find((fact) => fact.metric === "answer-distribution");
    if (distribution) {
      chosen.push(distribution);
    }
  }
  chosen.push(...tiedFastest(facts));
  pushBest(chosen, facts, "answer-likelihood");
  pushBest(chosen, facts, "answer-composition");
  pushBest(chosen, facts, "screen-likelihood");
  pushBest(chosen, facts, "agreement");
  const troll = facts.find((fact) => fact.metric === "troll-popular");
  if (troll) {
    chosen.push(troll);
  }
  const reconnect = facts.find((fact) => fact.metric === "reconnect-winner");
  if (reconnect) {
    chosen.push(reconnect);
  }
  const media = facts.find((fact) => fact.metric === "media-players");
  if (media) {
    chosen.push(media);
  }
  const cards: StatCard[] = [];
  for (const fact of chosen) {
    if (cards.length === 8) {
      break;
    }
    const card = cardFor(source, fact, facts);
    if (card) {
      cards.push(card);
    }
  }
  return cards;
}

function recapCards(source: StatsSource, facts: StatFact[]): StatCard[] {
  const cards: StatCard[] = [];
  for (const fact of facts) {
    if (cards.length === 6) {
      break;
    }
    const card = cardFor(source, fact, facts);
    if (card) {
      cards.push(card);
    }
  }
  return cards;
}

function cardFor(
  source: StatsSource,
  fact: StatFact,
  facts: StatFact[],
): StatCard | null {
  const text = wordFact(fact, facts);
  if (!text) {
    return null;
  }
  const prefix = source.illustrative ? "Illustrative. " : "";
  return {
    id: fact.id.slice(0, 80),
    factId: fact.id.slice(0, 80),
    illustrative: source.illustrative,
    display: fact.display === "suppressed" ? "suppressed" : "eligible",
    stage: clip(`${prefix}${text.stage}`, 280),
    results: clip(`${prefix}${text.results}`, 400),
  };
}

function wordFact(
  fact: StatFact,
  facts: StatFact[],
): { stage: string; results: string } | null {
  if (fact.metric === "device-family") {
    return wordFamily(fact, facts);
  }
  if (
    fact.metric === "device-unclassified" &&
    fact.denominator > 0 &&
    fact.numerator === fact.denominator
  ) {
    return {
      stage: `${fact.numerator} of the ${fact.denominator} players had a device we could not classify.`,
      results: `${fact.numerator} of the ${fact.denominator} players had a device we could not classify. No family was invented for them.`,
    };
  }
  if (fact.metric === "answer-distribution") {
    return wordDistribution(fact);
  }
  if (fact.metric === "divisive") {
    return wordDivisive(fact);
  }
  if (fact.metric === "answer-composition") {
    return wordComposition(fact);
  }
  if (fact.metric === "answer-likelihood" || fact.metric === "screen-likelihood") {
    return wordLikelihood(fact);
  }
  if (fact.metric === "agreement") {
    return wordAgreement(fact);
  }
  if (fact.metric === "fastest") {
    return wordFastest(fact);
  }
  if (fact.metric === "troll-popular") {
    return wordTroll(fact);
  }
  if (fact.metric === "reconnect-winner") {
    return wordReconnect(fact);
  }
  if (fact.metric === "media-players") {
    return {
      stage: `${fact.numerator} of the ${fact.denominator} players had an accepted photo.`,
      results: `${fact.numerator} of the ${fact.denominator} players had an accepted photo. Upload retries are not counted again.`,
    };
  }
  if (fact.metric === "recap-device") {
    const family = fact.labels[0] ?? "unknown";
    const ambiguous = fact.labels[1] === "ambiguous";
    const noun = familyNoun[family]?.[0] ?? "a device";
    const stage = ambiguous
      ? `Your first recorded device was ${noun}, and that classification is ambiguous.`
      : `Your first recorded device was ${noun}.`;
    return {
      stage,
      results: `${stage} A later phone does not change this line, and it is not a model check.`,
    };
  }
  if (fact.metric === "recap-fastest") {
    const seconds = fact.parts[0]?.count ?? 0;
    return {
      stage: `Your fastest correct accepted answer was on ${fact.labels[0]}, with ${seconds} seconds left.`,
      results: `Your fastest correct accepted answer was on ${fact.labels[0]}, with ${seconds} seconds left. ${fact.denominator} of your correct answers were timed.`,
    };
  }
  if (fact.metric === "recap-trolls") {
    const received = fact.parts[0]?.count ?? 0;
    return {
      stage: `You sent ${fact.numerator} trolls and ${received} were aimed at you.`,
      results: `You sent ${fact.numerator} trolls and ${received} were aimed at you. Refunded effects are not included.`,
    };
  }
  if (fact.metric === "recap-reconnect") {
    return {
      stage: `You reconnected ${fact.numerator} times.`,
      results: `You reconnected ${fact.numerator} times. That count is for this player, not for each socket.`,
    };
  }
  return null;
}

function wordFamily(
  fact: StatFact,
  facts: StatFact[],
): { stage: string; results: string } | null {
  const siblings = facts.filter(
    (row) => row.metric === "device-family" && row.display !== "withheld",
  );
  const best = Math.max(...siblings.map((row) => row.numerator));
  if (fact.numerator !== best) {
    return null;
  }
  const tied = siblings.filter((row) => row.numerator === best);
  if (tied[0]?.id !== fact.id) {
    return null;
  }
  const names = tied.map((row) => pluralFamily(row.labels[0] ?? "", row.numerator));
  const unknown = fact.unknownCount;
  const ambiguous = fact.parts.find((part) => part.label === "ambiguous")?.count ?? 0;
  const lead =
    tied.length === 1
      ? `${fact.numerator} of the ${fact.denominator} players whose device we could classify joined on ${names[0]}.`
      : `${names.join(" and ")} tied, with ${fact.numerator} players each of the ${fact.denominator} we could classify.`;
  const share = fact.parts.find((part) => part.label === "percent")?.count;
  const extra = [
    unknown > 0 ? `${unknown} players had a device we could not classify.` : "",
    ambiguous === 1
      ? "1 of those classifications is ambiguous."
      : ambiguous > 1
        ? `${ambiguous} of those classifications are ambiguous.`
        : "",
    tied.length === 1 && share !== undefined
      ? `That is ${share}% of the classified players.`
      : "",
    fact.denominator < minimumComparisonGroup
      ? "A percentage needs at least 5 classified players."
      : "",
  ]
    .filter((line) => line.length > 0)
    .join(" ");
  return { stage: lead, results: `${lead} ${extra}`.trim() };
}

function wordDistribution(fact: StatFact): { stage: string; results: string } | null {
  const options = fact.parts.map((part) => {
    const split = part.label.indexOf(":");
    return {
      label: split === -1 ? part.label : part.label.slice(split + 1),
      count: part.count,
    };
  });
  const top = Math.max(...options.map((option) => option.count));
  const leaders = options.filter((option) => option.count === top);
  const lead =
    leaders.length === 1
      ? `${top} of the ${fact.denominator} accepted answers on ${fact.labels[0]} chose ${leaders[0]?.label}.`
      : `${leaders.map((option) => option.label).join(" and ")} each received ${top} of the ${fact.denominator} accepted answers on ${fact.labels[0]}.`;
  const missing =
    fact.unknownCount > 0
      ? ` ${fact.unknownCount} players who were in time have no accepted answer.`
      : "";
  return { stage: lead, results: `${lead}${missing}` };
}

function wordDivisive(fact: StatFact): { stage: string; results: string } {
  const first = fact.parts[0];
  const second = fact.parts[1];
  const stage = `${fact.labels[0]} split the room ${first?.count ?? 0} to ${second?.count ?? 0}.`;
  const missing =
    fact.unknownCount > 0
      ? ` ${fact.unknownCount} players who were in time have no accepted answer.`
      : "";
  return {
    stage,
    results: `${first?.count ?? 0} chose ${fact.labels[1]} and ${second?.count ?? 0} chose ${fact.labels[2]}, out of ${fact.denominator} accepted answers.${missing}`,
  };
}

function wordComposition(fact: StatFact): { stage: string; results: string } {
  const noun = pluralFamily(fact.labels[2] ?? "", fact.numerator);
  const small = fact.display === "suppressed";
  const stage = small
    ? `${fact.numerator} of ${fact.denominator} people who chose ${fact.labels[1]} had joined on ${noun}. A percentage needs at least 5 in the group.`
    : `Most people who chose ${fact.labels[1]} had joined on ${noun}: ${fact.numerator} of ${fact.denominator} with a classified device.`;
  const unknown =
    fact.unknownCount > 0
      ? ` ${fact.unknownCount} more choices had no classified device.`
      : "";
  return {
    stage,
    results: `${stage}${unknown} This is who chose it, not whether that device group was more likely to choose it.`,
  };
}

function wordLikelihood(fact: StatFact): { stage: string; results: string } {
  const othersChose =
    fact.parts.find((part) => part.label === "othersChose")?.count ?? 0;
  const othersAnswered =
    fact.parts.find((part) => part.label === "othersAnswered")?.count ?? 0;
  const option = fact.labels[1] ?? "";
  const small = fact.display === "suppressed";
  if (fact.metric === "screen-likelihood") {
    const group = fact.labels[2] === "wider" ? "wider" : "narrower";
    const other = group === "wider" ? "narrower" : "wider";
    const stage = small
      ? `${fact.numerator} of ${fact.denominator} in the ${group} reported screen group chose ${option}, against ${othersChose} of ${othersAnswered} in the ${other} group. A percentage needs at least 5 in each group.`
      : `Players in the ${group} reported screen group were more likely to choose ${option}: ${fact.numerator} of ${fact.denominator}, against ${othersChose} of ${othersAnswered} in the ${other} group.`;
    return {
      stage,
      results: `${stage} The wider group is a short edge of at least ${widerScreenShortEdge} CSS pixels, fixed before the party. It is not inches and it is not a phone model.`,
    };
  }
  const noun = pluralFamily(fact.labels[2] ?? "", fact.denominator);
  const stage = small
    ? `${fact.numerator} of ${fact.denominator} who joined on ${noun} chose ${option}, against ${othersChose} of ${othersAnswered} other classified players. A percentage needs at least 5 in each group.`
    : `Players who joined on ${noun} were more likely to choose ${option} than the other classified players who answered: ${fact.numerator} of ${fact.denominator}, against ${othersChose} of ${othersAnswered}.`;
  return {
    stage,
    results: `${stage} This compares rates inside each group. It does not say the phone caused the answer.`,
  };
}

function wordAgreement(fact: StatFact): { stage: string; results: string } {
  const otherChose = fact.parts.find((part) => part.label === "otherChose")?.count ?? 0;
  const otherAnswered =
    fact.parts.find((part) => part.label === "otherAnswered")?.count ?? 0;
  const left = pluralFamily(fact.labels[2] ?? "", fact.denominator);
  const right = pluralFamily(fact.labels[3] ?? "", otherAnswered);
  return {
    stage: `Players on ${left} and ${right} agreed most strongly on ${fact.labels[0]}.`,
    results: `${fact.numerator} of ${fact.denominator} on ${left}, and ${otherChose} of ${otherAnswered} on ${right}, chose ${fact.labels[1]}. Both groups had at least 5 accepted answers.`,
  };
}

function wordFastest(fact: StatFact): { stage: string; results: string } {
  const names = fact.labels.slice(1).filter((label) => label.length > 0);
  const seconds = fact.parts[0]?.count ?? 0;
  const who =
    names.length === 1
      ? `${names[0]} gave the fastest correct answer`
      : `${names.join(" and ")} tied for the fastest correct answer`;
  return {
    stage: `${who} on ${fact.labels[0]}, with ${seconds} seconds left.`,
    results: `${who} on ${fact.labels[0]}, with ${seconds} seconds left. ${fact.denominator} correct accepted answers were timed.`,
  };
}

function wordTroll(fact: StatFact): { stage: string; results: string } {
  const names = fact.labels;
  const stage =
    names.length === 1
      ? `The most-used troll was ${names[0]}, sent ${fact.numerator} times.`
      : `${names.join(" and ")} were each sent ${fact.numerator} times.`;
  return {
    stage,
    results: `${stage} ${fact.denominator} accepted trolls were counted, once each.`,
  };
}

function wordReconnect(fact: StatFact): { stage: string; results: string } {
  if (fact.labels.length === 1) {
    const times = fact.parts[0]?.count ?? fact.numerator;
    return {
      stage: `${fact.labels[0]} finished first and reconnected ${times} times.`,
      results: `${fact.labels[0]} finished first and reconnected ${times} times. The count belongs to that player.`,
    };
  }
  const lines = fact.parts.map(
    (part) => `${part.label} reconnected ${part.count} times`,
  );
  return {
    stage: `${fact.labels.join(" and ")} tied for first.`,
    results: `${fact.labels.join(" and ")} tied for first. ${lines.join(". ")}.`,
  };
}

function pickFamily(facts: StatFact[]): StatFact[] {
  const rows = facts.filter((fact) => fact.metric === "device-family");
  if (rows.length === 0) {
    const unknown = facts.find((fact) => fact.metric === "device-unclassified");
    return unknown && unknown.numerator > 0 ? [unknown] : [];
  }
  const best = Math.max(...rows.map((fact) => fact.numerator));
  const lead = rows.find((fact) => fact.numerator === best);
  return lead ? [lead] : [];
}

function tiedDivisive(facts: StatFact[]): StatFact[] {
  const rows = facts.filter((fact) => fact.metric === "divisive");
  const best = rows.reduce<StatFact | undefined>((lead, fact) => {
    if (
      !lead ||
      fact.numerator * lead.denominator < lead.numerator * fact.denominator
    ) {
      return fact;
    }
    return lead;
  }, undefined);
  if (!best) {
    return [];
  }
  return rows.filter(
    (fact) => fact.numerator * best.denominator === best.numerator * fact.denominator,
  );
}

function tiedFastest(facts: StatFact[]): StatFact[] {
  const rows = facts.filter((fact) => fact.metric === "fastest");
  const best = rows.reduce((lead, fact) => Math.max(lead, fact.numerator), -1);
  if (best < 0) {
    return [];
  }
  return rows.filter((fact) => fact.numerator === best);
}

function pushBest(chosen: StatFact[], facts: StatFact[], metric: string): void {
  const rows = facts.filter(
    (fact) => fact.metric === metric && fact.display === "eligible",
  );
  const pool = rows.length > 0 ? rows : facts.filter((fact) => fact.metric === metric);
  const best = pool.reduce<StatFact | undefined>((lead, fact) => {
    if (!lead) {
      return fact;
    }
    if (metric === "agreement") {
      return strongerAgreement(fact, lead) ? fact : lead;
    }
    return gapOf(fact) > gapOf(lead) ? fact : lead;
  }, undefined);
  if (best) {
    chosen.push(best);
  }
}

function gapOf(fact: StatFact): number {
  const othersChose =
    fact.parts.find((part) => part.label === "othersChose")?.count ?? 0;
  const othersAnswered =
    fact.parts.find((part) => part.label === "othersAnswered")?.count ??
    fact.denominator;
  if (fact.denominator === 0 || othersAnswered === 0) {
    return fact.numerator;
  }
  return fact.numerator * othersAnswered - othersChose * fact.denominator;
}

function groupParts(
  display: StatFact["display"],
  parts: { label: string; count: number }[],
): { label: string; count: number }[] {
  if (display === "suppressed") {
    return [...parts, { label: "minimumGroup", count: minimumComparisonGroup }];
  }
  return parts;
}

function strongerAgreement(candidate: StatFact, best: StatFact): boolean {
  const candidateOther =
    candidate.parts.find((part) => part.label === "otherAnswered")?.count ?? 0;
  const bestOther =
    best.parts.find((part) => part.label === "otherAnswered")?.count ?? 0;
  const candidateChose =
    candidate.parts.find((part) => part.label === "otherChose")?.count ?? 0;
  const bestChose = best.parts.find((part) => part.label === "otherChose")?.count ?? 0;
  const left = Math.min(
    candidate.numerator * candidateOther,
    candidateChose * candidate.denominator,
  );
  const right = Math.min(best.numerator * bestOther, bestChose * best.denominator);
  const scaleLeft = candidate.denominator * candidateOther;
  const scaleRight = best.denominator * bestOther;
  return left * scaleRight > right * scaleLeft;
}

function guests(source: StatsSource): StatsPlayer[] {
  return source.players.filter((player) => player.clientClass === "guest");
}

function guestAnswers(source: StatsSource): StatsAnswer[] {
  const ids = new Set(guests(source).map((player) => player.playerId));
  return source.answers.filter((answer) => ids.has(answer.playerId));
}

function classified(player: StatsPlayer): boolean {
  return (
    player.family !== null &&
    player.family !== "unknown" &&
    player.classification !== null &&
    player.classification !== "unknown"
  );
}

function knownFamily(family: string | null): family is string {
  return family !== null && family !== "unknown" && familyNoun[family] !== undefined;
}

function missingCount(
  source: StatsSource,
  question: StatsQuestion,
  answers: StatsAnswer[],
): number {
  if (question.eligiblePlayerIds.length === 0) {
    return 0;
  }
  const people = new Set(guests(source).map((player) => player.playerId));
  const answered = new Set(answers.map((answer) => answer.playerId));
  let missing = 0;
  for (const playerId of question.eligiblePlayerIds) {
    if (people.has(playerId) && !answered.has(playerId)) {
      missing += 1;
    }
  }
  return missing;
}

function uniqueAnswers(answers: StatsAnswer[]): StatsAnswer[] {
  return dedupe(answers, (answer) => `${answer.questionId}:${answer.playerId}`);
}

function pluralFamily(family: string, count: number): string {
  const pair = familyNoun[family];
  if (!pair) {
    return "a device we could not classify";
  }
  return count === 1 ? pair[0] : pair[1];
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((100 * numerator) / denominator);
}

function greaterRate(
  numerator: number,
  denominator: number,
  otherN: number,
  otherD: number,
): boolean {
  return denominator > 0 && otherD > 0 && numerator * otherD > otherN * denominator;
}

function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = key(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function mode(counts: Map<string, number>): { key: string; count: number } | null {
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) {
      best = { key, count };
    }
  }
  if (!best) {
    return null;
  }
  const tied = [...counts.values()].filter((count) => count === best?.count).length;
  return tied === 1 ? best : null;
}

function strictMode(
  counts: Map<string, number>,
): { key: string; count: number } | null {
  return mode(counts);
}

function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    const id = key(row);
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(row);
  }
  return unique;
}

function make(source: StatsSource, fact: Omit<StatFact, "sourceRevision">): StatFact {
  return { ...fact, sourceRevision: source.sourceRevision };
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd();
}
