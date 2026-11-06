import { useState } from "react";
import { Link } from "react-router";
import {
  allowedKartItems,
  kartItemNames,
  type KartItem,
  type KartItemRules,
} from "@26/shared";
import { Button } from "../ui/primitives";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

const items = Object.keys(kartItemNames) as KartItem[];
export function KartItemControls() {
  const { snapshot, execute, busy, connection } = useAdminRoom();
  const data = snapshot.kartItems;
  const [selected, setSelected] = useState<KartItem[]>(() =>
    data?.next.version === 2 ? data.next.allowed : items,
  );
  if (!data) return null;
  const unavailable = busy || connection !== "open";
  const collecting = !!snapshot.play?.kart && snapshot.phase === "collect";
  const canManage =
    !!snapshot.play?.kart &&
    ["intro", "prompt", "collect", "reveal", "scores"].includes(snapshot.phase);
  const names = new Map(snapshot.players.map((p) => [p.playerId, p.nickname]));
  const describe = (version: number | undefined) =>
    version === 2 ? "Expanded items" : "Original items";
  const catalogue = (rules: KartItemRules) =>
    allowedKartItems(rules)
      .map((item) => kartItemNames[item])
      .join(", ") || "No item pickups";
  return (
    <section aria-label="Kart items">
      <h2>Kart items</h2>
      <p>
        Current: {data.current ? describe(data.current.version) : "No active race"} ·
        Next race: {describe(data.next.version)}.
      </p>
      {data.current && <p>Allowed now: {catalogue(data.current)}.</p>}
      <p>Saved for next start: {catalogue(data.next)}.</p>
      <p>
        {data.frozen
          ? "Current race rules are frozen."
          : "Choose the rules before racing starts."}{" "}
        Treats give a personal 0.6-second boost. Expanded items ask older tabs to
        refresh.
      </p>
      <fieldset
        className="flex flex-wrap items-center gap-3"
        disabled={unavailable || collecting}
      >
        <legend>Expanded item selection</legend>
        {items.map((item) => (
          <label key={item}>
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={(e) =>
                setSelected((previous) =>
                  e.target.checked
                    ? [...previous, item]
                    : previous.filter((value) => value !== item),
                )
              }
            />
            {kartItemNames[item]}
          </label>
        ))}
        <Button
          onClick={() =>
            void execute(
              {
                action: "kart-item-rules",
                itemRules: { version: 2, allowed: selected },
              },
              "Save expanded items",
              "kart-items",
            )
          }
        >
          Save expanded items
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            void execute(
              { action: "kart-item-rules", itemRules: { version: 1 } },
              "Use original items",
              "kart-items",
            )
          }
        >
          Use original items
        </Button>
      </fieldset>
      <p>
        {data.spawning ? "Item spawning on" : "Item spawning stopped"} ·{" "}
        {data.held.length} held · {data.projectiles} projectiles · {data.oils} oil
        slicks.
      </p>
      <p>
        Stopping spawning keeps held personal boosts and shields usable. Clear removes
        active track hazards.
      </p>
      <Button
        variant="secondary"
        disabled={unavailable || !canManage}
        onClick={() =>
          void execute(
            { action: data.spawning ? "kart-items-off" : "kart-items-on" },
            "Change item spawning",
            "kart-items",
          )
        }
      >
        {data.spawning ? "Stop item spawning" : "Resume item spawning"}
      </Button>
      <Button
        variant="secondary"
        disabled={unavailable || !canManage}
        onClick={() =>
          void execute(
            { action: "kart-items-clear" },
            "Clear track items",
            "kart-items",
          )
        }
      >
        Clear track items
      </Button>
      <CommandFeedback scope="kart-items" />
      <h3>Held items</h3>
      <ul aria-label="Held kart items">
        {data.held.map((held) => (
          <li key={held.playerId}>
            Kart {held.number} · {names.get(held.playerId) ?? "Departed player"} ·{" "}
            {kartItemNames[held.item]}
          </li>
        ))}
      </ul>
      <h3>Recent item events</h3>
      {!data.tracked && <p>This older race has no item history.</p>}
      <ol aria-label="Recent item events">
        {data.history.map((event) => (
          <li key={event.eventId}>
            {(event.atMs / 1000).toFixed(2)}s · {event.kind}
            {event.item ? ` · ${kartItemNames[event.item]}` : ""}
            {event.playerId
              ? ` · ${names.get(event.playerId) ?? "Departed player"}`
              : ""}
          </li>
        ))}
      </ol>
      <h3>Rule changes</h3>
      <ol aria-label="Item rule history">
        {data.rulesHistory.map((event, index) => (
          <li key={`${event.atMs}-${index}`}>
            {new Date(event.atMs).toLocaleTimeString("en-GB")} ·{" "}
            {describe(event.rules.version)}
          </li>
        ))}
      </ol>
      <Link to="/admin/kart?view=items">Rehearse items without guests</Link>
    </section>
  );
}
