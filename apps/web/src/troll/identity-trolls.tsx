import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { trollAssets } from "./troll-assets";
import { useTrollClip } from "./troll-sound";

/** "You have left the party", with a door slam, then the reveal that it's a joke. */
export function FakeExit({ label }: { label: string }) {
  const [joking, setJoking] = useState(false);
  useTrollClip(trollAssets.doorSlam);
  useEffect(() => {
    const timer = window.setTimeout(() => setJoking(true), 3_500);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="troll-cover" role="alert" aria-label={label}>
      {joking ? (
        <>
          <p className="troll-cover-title">Only joking 😜</p>
          <p>You're still here. The whole room just watched you leave, though.</p>
        </>
      ) : (
        <>
          <p className="troll-cover-title">You have left the party</p>
          <p>Thanks for playing. Your session has ended.</p>
        </>
      )}
    </div>
  );
}

const rowStaggerMs = 150;

/**
 * Identity gags on the target's own phone. The silly name and Guest 14 are
 * applied by the room to every screen; this is the fake last place, which only
 * the target sees.
 */
export function FakeLastPlace({ label, others }: { label: string; others: string[] }) {
  const reduce = useReducedMotion();
  const above = others.slice(0, 4);
  const rows = [
    ...above.map((name) => ({ name, you: false })),
    { name: "You", you: true },
  ];
  // The trombone lands with the "LAST" row, which enters after the others.
  useTrollClip(trollAssets.sadTrombone, reduce ? 0 : (rows.length - 1) * rowStaggerMs);
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
            transition={{ delay: reduce ? 0 : (index * rowStaggerMs) / 1000 }}
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
