import { useState } from "react";
import { Button } from "../ui/primitives";
import {
  trollChoices,
  trollPickerLocked,
  trollTokenLabel,
  type TrollPlayer,
} from "./players";

export function TrollPicker({
  players,
  selfId,
  roundIndex,
  used,
  pending = false,
  selectedId,
  onSelect,
}: {
  players: readonly TrollPlayer[];
  selfId: string;
  roundIndex: number;
  used: boolean;
  pending?: boolean;
  selectedId?: string;
  onSelect: (playerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const locked = pending || trollPickerLocked(roundIndex, used);
  const choices = trollChoices(players, selfId, query);

  return (
    <div className="grid gap-3">
      <p className="font-bold">{trollTokenLabel(used)}</p>
      <label className="grid gap-2 font-bold">
        Find a player
        <input
          className="min-h-12 rounded-2xl border border-line bg-background px-4 text-lg font-normal"
          value={query}
          disabled={locked}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul className="grid max-h-64 gap-2 overflow-y-auto">
        {choices.map((player) => (
          <li key={player.playerId}>
            <Button
              type="button"
              className="w-full"
              variant={selectedId === player.playerId ? "primary" : "secondary"}
              aria-label={`Troll ${player.nickname}`}
              aria-pressed={selectedId === player.playerId}
              disabled={locked}
              onClick={() => onSelect(player.playerId)}
            >
              {player.nickname}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
