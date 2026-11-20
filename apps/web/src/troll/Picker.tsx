import { useState } from "react";
import { PlayerAvatar } from "../ui/player-avatar";
import { trollChoices, trollTokenLabel, type TrollPlayer } from "./players";

export function TrollPicker({
  players,
  selfId,
  locked: closed,
  cooling,
  pending = false,
  selectedId,
  onSelect,
}: {
  players: readonly TrollPlayer[];
  selfId: string;
  /** Trolls are not open yet. */
  locked: boolean;
  /** Open, but this guest's cooldown is still running. A target can be chosen. */
  cooling: boolean;
  pending?: boolean;
  selectedId?: string;
  onSelect: (playerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const locked = pending || closed;
  const choices = trollChoices(players, selfId, query);

  return (
    <div className="troll-picker">
      <p className="troll-picker-token">{trollTokenLabel(cooling)}</p>
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
