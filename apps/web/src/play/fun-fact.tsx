import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import type { LobbySnapshot } from "@26/shared";
import "./fun-fact.css";

type ShownFact = NonNullable<LobbySnapshot["funFact"]>;

/** The first number in a frozen sentence rolls. The words stay the server's. */
function FactSentence({ text }: { text: string }) {
  const match = text.match(/^(.*?)(\d+)(.*)$/);
  if (!match) return text;
  return (
    <>
      {match[1]}
      <NumberFlow value={Number(match[2])} />
      {match[3]}
    </>
  );
}

export function FunFactStage({ fact }: { fact: ShownFact }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <section className="fun-fact-stage" aria-label="From your phones">
      <p className="fun-fact-count">
        {fact.index + 1} of {fact.total}
      </p>
      <AnimatePresence mode="wait">
        <motion.h2
          key={fact.card.id}
          initial={{ opacity: 0, y: reduce ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.45, ease: "easeOut" }}
        >
          <FactSentence text={fact.card.text} />
        </motion.h2>
      </AnimatePresence>
    </section>
  );
}

export function FunFactPhone({ fact }: { fact: ShownFact }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <section className="fun-fact-phone" aria-label="From your phones">
      <p className="entry-eyebrow">Watch the stage</p>
      <p className="fun-fact-count">
        {fact.index + 1} of {fact.total}
      </p>
      <AnimatePresence mode="wait">
        <motion.h2
          key={fact.card.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.15 : 0.35, ease: "easeOut" }}
        >
          <FactSentence text={fact.card.text} />
        </motion.h2>
      </AnimatePresence>
      {fact.appliesToYou ? <p className="fun-fact-you">That’s you.</p> : null}
    </section>
  );
}

export function FunFactReport({
  cards,
}: {
  cards: readonly { id: string; text: string; appliesToYou?: boolean }[];
}) {
  if (!cards.length) return null;
  return (
    <section className="results-facts" aria-label="From your phones">
      <h2>From your phones</h2>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <p>{card.text}</p>
            {card.appliesToYou ? <p className="fun-fact-you">That’s you.</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
