import { useState } from "react";
import { PlayerAvatar } from "../ui/player-avatar";
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
    <div className="troll-picker">
      <p className="troll-picker-token">{trollTokenLabel(used)}</p>
      <label className="troll-picker-search">
        Find a player
        <input
          className="skin-field"
          value={query}
          disabled={locked}
          placeholder="Type a name"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul className="troll-picker-list">
        {choices.map((player) => (
          <li key={player.playerId}>
            <button
              type="button"
              className="troll-picker-player glass"
              aria-label={`Troll ${player.nickname}`}
              aria-pressed={selectedId === player.playerId}
              disabled={locked}
              onClick={() => onSelect(player.playerId)}
            >
              <PlayerAvatar playerId={player.playerId} nickname={player.nickname} />
              <span>{player.nickname}</span>
            </button>
          </li>
        ))}
        {choices.length === 0 ? (
          <li className="troll-picker-empty">Nobody matches that name.</li>
        ) : null}
      </ul>
    </div>
  );
}
