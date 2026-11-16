import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  importedWalls,
  importedRoute,
  ringWalls,
  ringBounds,
  parkWalls,
  parkRoute,
  createDrivingBody,
  moveWithWalls,
  type KartContactHistoryEntry,
  type KartTrackId,
  type Wall,
  kartHandlingSchema,
  kartHandlingNames,
  type KartHandling,
} from "@26/shared";
import { Button } from "../ui/primitives";

const ringRoute = Array.from({ length: 129 }, (_, index) => {
  const angle = (index * Math.PI * 2) / 128;
  const radius = (ringBounds.inner + ringBounds.outer) / 2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
});
function layer(walls: readonly Wall[], route: readonly (readonly number[])[]) {
  const bounds = walls.reduce(
    (box, wall) => ({
      minX: Math.min(box.minX, wall.ax, wall.bx),
      maxX: Math.max(box.maxX, wall.ax, wall.bx),
      minZ: Math.min(box.minZ, wall.az, wall.bz),
      maxZ: Math.max(box.maxZ, wall.az, wall.bz),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
  return {
    walls,
    path: walls.map((wall) => `M${wall.ax},${wall.az}L${wall.bx},${wall.bz}`).join(""),
    route: route.map(([x, z], index) => `${index ? "L" : "M"}${x},${z}`).join(""),
    viewBox: `${bounds.minX - 5} ${bounds.minZ - 5} ${bounds.maxX - bounds.minX + 10} ${bounds.maxZ - bounds.minZ + 10}`,
  };
}
const layers = {
  "party-ring-v1": layer(ringWalls, ringRoute),
  "mario-circuit-v1": layer(importedWalls, importedRoute),
  "26-park-v1": layer(parkWalls, parkRoute.points),
};

/** Real server solver data; this is an admin drawing, never browser collision authority. */
export function KartCollisionOverlay({
  trackId,
  history = [],
  names = {},
}: {
  trackId: KartTrackId;
  history?: readonly KartContactHistoryEntry[];
  names?: Readonly<Record<string, string>>;
}) {
  const [walls, setWalls] = useState(true),
    [route, setRoute] = useState(true),
    [impacts, setImpacts] = useState(true);
  const data = layers[trackId];
  return (
    <section className="kart-collision-overlay" aria-label="Kart collision inspection">
      <h3>Collision boundaries</h3>
      <p>
        {data.walls.length} boundary segments ·{" "}
        {trackId === "26-park-v1"
          ? "26 Park"
          : trackId === "mario-circuit-v1"
            ? "Imported circuit"
            : "Party ring"}
        . Boundaries are the actual swept solver’s X/Z data. Height clearance is
        conservative; this view does not claim 3D wall heights.
      </p>
      <div className="flex flex-wrap gap-3">
        <label>
          <input
            type="checkbox"
            checked={walls}
            onChange={(event) => setWalls(event.target.checked)}
          />{" "}
          Show collision boundaries
        </label>
        <label>
          <input
            type="checkbox"
            checked={route}
            onChange={(event) => setRoute(event.target.checked)}
          />{" "}
          Show centre line
        </label>
        <label>
          <input
            type="checkbox"
            checked={impacts}
            onChange={(event) => setImpacts(event.target.checked)}
          />{" "}
          Show accepted impacts and recoveries
        </label>
      </div>
      <svg
        viewBox={data.viewBox}
        role="img"
        aria-label="Actual course collision boundaries"
      >
        <motion.path
          data-layer="walls"
          initial={{ opacity: 0 }}
          data-segments={data.walls.length}
          d={data.path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1}
          animate={{ opacity: walls ? 1 : 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        />
        <motion.path
          data-layer="route"
          initial={{ opacity: 0 }}
          d={data.route}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={0.7}
          strokeDasharray="2 2"
          animate={{ opacity: route ? 0.65 : 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        />
        <AnimatePresence initial={false}>
          {impacts
            ? history.map((entry) => (
                <motion.circle
                  key={`${entry.kind}:${entry.eventId}`}
                  cx={entry.x}
                  cy={entry.z}
                  r={trackId === "party-ring-v1" ? 1.2 : 2.2}
                  fill={
                    entry.kind === "impact" ? "var(--highlight)" : "var(--foreground)"
                  }
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                >
                  <title>
                    {entry.kind === "impact" ? "Impact" : "Recovery"} · Kart{" "}
                    {entry.number} · {(entry.atMs / 1000).toFixed(2)}s
                  </title>
                </motion.circle>
              ))
            : null}
        </AnimatePresence>
      </svg>
      <p>
        Recent accepted history:{" "}
        {history.filter((entry) => entry.kind === "impact").length} impacts ·{" "}
        {history.filter((entry) => entry.kind === "recovery").length} recoveries. At
        most 20 entries, in race time.
      </p>
      <ol aria-label="Recent kart contacts and recoveries">
        <AnimatePresence initial={false}>
          {[...history].reverse().map((entry) => (
            <motion.li
              key={`${entry.kind}:${entry.eventId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              Kart {entry.number}
              {names[entry.playerId] ? ` · ${names[entry.playerId]}` : ""} ·{" "}
              {entry.kind === "impact" ? "Barrier impact" : "Back to track"} ·{" "}
              {(entry.atMs / 1000).toFixed(2)}s · {Math.round(entry.speed * 3.6)}km/h
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}

export function KartCollisionBench() {
  const [track, setTrack] = useState<KartTrackId>("mario-circuit-v1");
  const [history, setHistory] = useState<KartContactHistoryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);
  const [handling, setHandling] = useState<KartHandling>("slide-v1");
  const [response, setResponse] = useState<{
    rebound: boolean;
    stunMs: number;
    cooldownMs: number;
  } | null>(null);
  return (
    <section className="admin-kart-pane" aria-label="Kart collision rehearsal">
      <h2>Collision bench</h2>
      <p>
        Stand-in impacts use the real swept solver and actual boundaries. No room,
        socket, score or live racer is involved.
      </p>
      <label>
        Rehearsal course
        <select
          value={track}
          onChange={(event) => {
            setTrack(event.target.value as KartTrackId);
            setHistory([]);
            setAttempt(0);
            setResponse(null);
          }}
        >
          <option value="mario-circuit-v1">Imported circuit</option>
          <option value="party-ring-v1">Party ring</option>
          <option value="26-park-v1">26 Park</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <label>
          Rehearsal handling
          <select
            value={handling}
            onChange={(event) => {
              const parsed = kartHandlingSchema.safeParse(event.target.value);
              if (parsed.success) {
                setHandling(parsed.data);
                setResponse(null);
                setHistory([]);
                setAttempt(0);
              }
            }}
          >
            {kartHandlingSchema.options.map((preset) => (
              <option key={preset} value={preset}>
                {kartHandlingNames[preset]}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            const wall = layers[track].walls.find(
              (wall) => Math.hypot(wall.bx - wall.ax, wall.bz - wall.az) > 0.01,
            )!;
            const length = Math.hypot(wall.bx - wall.ax, wall.bz - wall.az);
            const nx = -(wall.bz - wall.az) / length,
              nz = (wall.bx - wall.ax) / length;
            const start = createDrivingBody(
              (wall.ax + wall.bx) / 2 + nx * 2,
              (wall.az + wall.bz) / 2 + nz * 2,
            );
            const result = moveWithWalls(
              { ...start, vx: -nx * 60, vz: -nz * 60 },
              0.1,
              layers[track].walls,
              0.85,
              handling,
            );
            setResponse({
              rebound: result.vx * nx + result.vz * nz > 0.01,
              stunMs: result.stunMs ?? 0,
              cooldownMs: result.impactCooldownMs ?? 0,
            });
            const next = attempt + 1;
            setAttempt(next);
            if (result.contact) {
              const id = ++sequence.current;
              const entry: KartContactHistoryEntry = {
                eventId: Math.min(18_000_100, id),
                atMs: Math.min(180_000, next * 500),
                kind: "impact",
                playerId: "stand-in",
                number: 1,
                x: result.x,
                z: result.z,
                speed: 60,
              };
              setHistory((rows) => [...rows, entry].slice(-20));
            }
          }}
        >
          Rehearse a swept wall impact
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setHistory([]);
            setAttempt(0);
            setResponse(null);
          }}
        >
          Clear collision rehearsal
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {response ? (
          <motion.output
            key={handling}
            aria-label="Collision handling result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            {kartHandlingNames[handling]} ·{" "}
            {response.rebound ? "Rebounded from the wall" : "Slid along the wall"} ·
            Stun {response.stunMs}ms · Cooldown {response.cooldownMs}ms
          </motion.output>
        ) : null}
      </AnimatePresence>
      <p>
        Stand-in attempts: {attempt}. The real solver decides whether a contact
        occurred.
      </p>
      <KartCollisionOverlay
        key={track}
        trackId={track}
        history={history}
        names={{ "stand-in": "Stand-in driver" }}
      />
    </section>
  );
}
