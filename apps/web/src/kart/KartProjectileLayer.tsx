import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { kartProjectileTuning, type KartProjectilePose } from "@26/shared";
import { mapX, mapZ } from "./navigation";

/** Original, bounded item geometry; accepts visible poses, not private target/history data. */
export function KartProjectileLayer({
  projectiles,
  elapsedMs,
  trackId = "party-ring-v1",
}: {
  projectiles: readonly KartProjectilePose[];
  elapsedMs: number;
  trackId?: import("@26/shared").KartRaceView["trackId"];
}) {
  const reduced = useReducedMotion();
  return (
    <g aria-label="Visible projectiles">
      <AnimatePresence initial={false}>
        {projectiles.slice(0, kartProjectileTuning.capacity).map((item) => (
          <motion.g
            key={item.id}
            data-projectile={item.kind}
            initial={{ opacity: 0, x: mapX(trackId, item.x), y: mapZ(trackId, item.z) }}
            animate={{ x: mapX(trackId, item.x), y: mapZ(trackId, item.z), opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              x: { duration: reduced ? 0 : 0.12 },
              y: { duration: reduced ? 0 : 0.12 },
              opacity: { duration: 0.1, ease: "easeOut" },
            }}
          >
            <circle
              r="2.2"
              fill={
                item.kind === "tennis"
                  ? "var(--highlight)"
                  : item.kind === "bomb"
                    ? "var(--foreground)"
                    : "var(--accent)"
              }
              stroke="var(--background)"
              strokeWidth="0.5"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="2.8"
              fill={
                item.kind === "tennis"
                  ? "var(--highlight-foreground)"
                  : item.kind === "bomb"
                    ? "var(--background)"
                    : "var(--accent-foreground)"
              }
            >
              {item.kind === "tennis" ? "T" : item.kind === "bomb" ? "B" : "H"}
            </text>
            <title>
              {item.kind === "bomb"
                ? `Bomb fuse: ${(Math.max(0, item.createdAt + kartProjectileTuning.bombFuseMs - elapsedMs) / 1000).toFixed(1)} seconds`
                : item.kind === "tennis"
                  ? "Tennis ball"
                  : "Homing bolt"}{" "}
              · {item.height.toFixed(1)} m
            </title>
          </motion.g>
        ))}
      </AnimatePresence>
    </g>
  );
}
