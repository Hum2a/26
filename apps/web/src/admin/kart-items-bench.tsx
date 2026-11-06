import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  createKartProjectiles,
  launchKartProjectile,
  stepKartProjectiles,
  clearKartProjectiles,
  setKartProjectileSpawning,
  createKartPowers,
  useKartPower as applyKartPower,
  createKartRace,
  projectKartRace,
  ringWalls,
  kartProjectileTuning,
  restoreKartProjectiles,
  projectKartProjectiles,
  type KartProjectileActor,
  type KartProjectileKind,
  type KartProjectileWorld,
} from "@26/shared";
import { KartMap } from "../kart/KartMap";
import { KartProjectileLayer } from "../kart/KartProjectileLayer";
import { Button } from "../ui/primitives";
import { movingItemRehearsal, noTargetHomingRehearsal } from "../kart/item-rehearsal";

const context = { trackId: "party-ring-v1" as const, walls: () => ringWalls };
const names = { a: "Stand-in Amina", b: "Stand-in Bilal" };
function initial(): {
  world: KartProjectileWorld;
  actors: readonly KartProjectileActor[];
  notice: string;
} {
  return {
    world: createKartProjectiles(),
    notice: "Ready for a local item launch.",
    actors: [
      {
        playerId: "a",
        number: 1,
        status: "RACING",
        progress: 0.1,
        x: 42,
        z: -8,
        heading: Math.PI / 2,
        height: 0,
        power: createKartPowers(),
      },
      {
        playerId: "b",
        number: 2,
        status: "RACING",
        progress: 0.2,
        x: 42,
        z: 8,
        heading: Math.PI / 2,
        height: 0,
        power: createKartPowers(),
      },
    ],
  };
}
export function KartItemsBench() {
  const id = useId();
  const [state, setState] = useState(initial);
  const [kind, setKind] = useState<KartProjectileKind>("tennis");
  const target = state.actors[1]!;
  const launch = () =>
    setState((current) => {
      const next = launchKartProjectile(
        current.world,
        kind,
        current.actors[0]!,
        current.actors,
        context,
      );
      const refusal =
        next.reason === "capacity"
          ? "Pool full — advance time or clear projectiles."
          : next.reason === "target"
            ? "No active racer ahead to target."
            : next.reason === "blocked"
              ? "A barrier blocks this launch."
              : "This stand-in cannot launch now.";
      return {
        ...current,
        world: next.world,
        notice: next.accepted ? `${kind} launched by Stand-in Amina.` : refusal,
      };
    });
  const advance = (ms: number) =>
    setState((current) => {
      let world = current.world,
        actors = current.actors;
      const end = Math.min(180000, world.elapsedMs + ms);
      while (world.elapsedMs < end) {
        const next = stepKartProjectiles(
          world,
          actors,
          Math.min(end, world.elapsedMs + 20),
          context,
        );
        world = next.world;
        actors = next.actors;
      }
      return { world, actors, notice: "Advanced the actual shared item simulation." };
    });
  const changeTarget = (change: Partial<KartProjectileActor>) =>
    setState((current) => ({
      ...current,
      actors: current.actors.map((actor, index) =>
        index === 1 ? { ...actor, ...change } : actor,
      ),
    }));
  const race = projectKartRace(
    createKartRace(
      "items-rehearsal",
      state.actors.map((actor) => ({
        playerId: actor.playerId,
        name: names[actor.playerId as keyof typeof names],
      })),
    ),
    null,
    0,
  );
  race.elapsedMs = state.world.elapsedMs;
  delete race.powers;
  race.participants = race.participants.map((driver, index) => ({
    ...driver,
    x: state.actors[index]!.x,
    z: state.actors[index]!.z,
    heading: state.actors[index]!.heading,
    height: state.actors[index]!.height,
    status: state.actors[index]!.status,
    progress: state.actors[index]!.progress,
  }));
  return (
    <section className="admin-kart-pane" aria-label="Item physics rehearsal">
      <h2>Item physics sandbox</h2>
      <p>
        Isolated stand-ins using the actual shared projectile simulation and driving
        barriers. Between scripted samples the two karts stay parked so you can inspect
        hits, shields, height and fuses. This rehearsal changes no room, inventory or
        score. Live races use the host's frozen item selection.
      </p>
      <p>
        Tennis balls travel at 35 m/s, bounce up to 4 times and expire after 6 seconds.
        Homing bolts select an active racer ahead and stop at walls. Bombs drop behind,
        arm after 0.5 seconds and explode after 1.5 seconds within 6 m. Shields absorb
        one hit; a 0.3-second grace prevents rapid repeated slowdowns. Treats give the
        holder a personal 0.6-second turbo without dropping a collectible.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() =>
            setState({
              ...noTargetHomingRehearsal(),
              notice:
                "No eligible racer ahead: the actual homing item gives Amina a personal 0.6-second boost. Bilal has finished.",
            })
          }
        >
          Rehearse homing without a target
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setState({
              ...movingItemRehearsal(kind),
              notice:
                "Completed 3 seconds of actual two-racer driving and item physics. Stand-ins are now parked for inspection.",
            })
          }
        >
          Run moving two-racer sample
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setState((current) => {
              const actor = current.actors[0]!;
              const used = applyKartPower(
                { ...actor.power, item: "treat" },
                actor.playerId,
                actor,
                current.world.elapsedMs,
              )!;
              return {
                ...current,
                actors: [{ ...actor, power: used.powers }, ...current.actors.slice(1)],
                notice:
                  "Stand-in Amina received a personal 0.6-second boost; no collectible was dropped.",
              };
            })
          }
        >
          Try personal Treats boost
        </Button>
        <label htmlFor={`${id}-kind`}>Projectile</label>
        <select
          id={`${id}-kind`}
          value={kind}
          onChange={(event) => setKind(event.target.value as KartProjectileKind)}
        >
          <option value="tennis">Tennis ball</option>
          <option value="bomb">Bomb</option>
          <option value="homing">Homing bolt</option>
        </select>
        <Button onClick={launch} disabled={!state.world.spawning}>
          Launch stand-in item
        </Button>
        <Button variant="secondary" onClick={() => advance(200)}>
          Advance 0.2 seconds
        </Button>
        <Button variant="secondary" onClick={() => advance(1000)}>
          Advance 1 second
        </Button>
        <Button variant="secondary" onClick={() => setState(initial())}>
          Reset sandbox
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setState((current) => ({
              ...current,
              world: restoreKartProjectiles(JSON.parse(JSON.stringify(current.world))),
              notice: "Restored a validated copy with the same clock and projectiles.",
            }))
          }
        >
          Restore sample copy
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <label>
          <input
            type="checkbox"
            checked={target.power.shieldUntil > state.world.elapsedMs}
            onChange={(event) =>
              changeTarget({
                power: {
                  ...target.power,
                  shieldUntil: event.target.checked ? state.world.elapsedMs + 10000 : 0,
                },
              })
            }
          />{" "}
          Target shield
        </label>
        <label>
          <input
            type="checkbox"
            checked={target.height > 0}
            onChange={(event) => changeTarget({ height: event.target.checked ? 4 : 0 })}
          />{" "}
          Target airborne
        </label>
        <label>
          <input
            type="checkbox"
            checked={target.status === "FINISHED"}
            onChange={(event) =>
              changeTarget({ status: event.target.checked ? "FINISHED" : "RACING" })
            }
          />{" "}
          Target finished
        </label>
        <label>
          <input
            type="checkbox"
            checked={target.z < 0}
            onChange={(event) =>
              changeTarget({
                z: event.target.checked ? -11 : 8,
                progress: event.target.checked ? 0.05 : 0.2,
              })
            }
          />{" "}
          Target behind for bomb rehearsal
        </label>
      </div>
      <p role="status">{state.notice}</p>
      <p>
        Active sample time: {(state.world.elapsedMs / 1000).toFixed(2)}s ·{" "}
        {state.world.projectiles.length} / {kartProjectileTuning.capacity} projectiles ·
        spawning {state.world.spawning ? "on" : "off"}.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() =>
            setState((current) => ({
              ...current,
              world: setKartProjectileSpawning(current.world, !current.world.spawning),
            }))
          }
        >
          {state.world.spawning ? "Stop sandbox spawning" : "Enable sandbox spawning"}
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            setState((current) => ({
              ...current,
              world: clearKartProjectiles(current.world),
            }))
          }
        >
          Clear sandbox projectiles
        </Button>
        <Button
          variant="secondary"
          disabled={!state.world.spawning}
          onClick={() =>
            setState((current) => {
              let world = current.world;
              for (let i = world.projectiles.length; i < 64; i++)
                world = launchKartProjectile(
                  world,
                  "tennis",
                  current.actors[0]!,
                  current.actors,
                  context,
                ).world;
              return {
                ...current,
                world,
                notice: "Filled the bounded pool using actual launches.",
              };
            })
          }
        >
          Rehearse full pool
        </Button>
      </div>
      <div style={{ maxWidth: "36rem" }}>
        <KartMap race={race}>
          <KartProjectileLayer
            projectiles={projectKartProjectiles(state.world)}
            elapsedMs={state.world.elapsedMs}
          />
        </KartMap>
      </div>
      <ul aria-label="Stand-in item state">
        {state.actors.map((actor) => (
          <li key={actor.playerId}>
            {names[actor.playerId as keyof typeof names]} · {actor.status} ·{" "}
            {actor.height} m ·{" "}
            {actor.power.turboUntil > state.world.elapsedMs ? "Turbo active · " : ""}
            {actor.power.shieldUntil > state.world.elapsedMs
              ? "Shield ready"
              : "No shield"}{" "}
            ·{" "}
            {actor.power.slowedUntil > state.world.elapsedMs ? "Slowed" : "No slowdown"}
          </li>
        ))}
      </ul>
      <p>Latest {kartProjectileTuning.history} events from this rehearsal.</p>
      <ol aria-label="Item simulation history">
        <AnimatePresence initial={false}>
          {[...state.world.history].reverse().map((event) => (
            <motion.li
              key={event.eventId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              {(event.atMs / 1000).toFixed(2)}s · {event.kind} · {event.projectileId}
              {event.playerId
                ? ` · ${names[event.playerId as keyof typeof names] ?? event.playerId}`
                : ""}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}
