import { motion, useReducedMotion } from "motion/react";

/**
 * Identity gags on the target's own phone. The silly name and Guest 14 are
 * applied by the room to every screen; this is the fake last place, which only
 * the target sees.
 */
export function FakeLastPlace({ label, others }: { label: string; others: string[] }) {
  const reduce = useReducedMotion();
  const above = others.slice(0, 4);
  const rows = [...above.map((name) => ({ name, you: false })), { name: "You", you: true }];
  return (
    <div className="troll-cover troll-last" role="alert" aria-label={label}>
      <p className="troll-cover-title">Current standings</p>
      <ol className="troll-last-board">
        {rows.map((row, index) => (
          <motion.li
            key={`${row.name}-${index}`}
            data-you={row.you || undefined}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: row.you ? 0 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduce ? 0 : index * 0.15 }}
          >
            <span>{row.you ? "LAST" : `${index + 1}.`}</span>
            <span>{row.name}</span>
          </motion.li>
        ))}
      </ol>
      <p>Don't worry. It's only a party. (It isn't real. Probably.)</p>
    </div>
  );
}
