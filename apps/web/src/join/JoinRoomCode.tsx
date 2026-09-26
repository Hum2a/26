import { TextField } from "../ui/primitives";
import { roomCodeFromQuery, sanitizeRoomCode } from "./room-code";

export function JoinRoomCode({
  roomQuery,
  pathCode,
  value,
  onChange,
}: {
  roomQuery: string | null;
  pathCode?: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const linked = roomCodeFromQuery(roomQuery) ?? roomCodeFromQuery(pathCode ?? null);
  if (linked) {
    return (
      <p>
        Room code <span className="font-bold tracking-[0.14em]">{linked}</span>
      </p>
    );
  }

  return (
    <TextField
      label="Join code"
      hint="Six characters from the stage or the admin screen."
      value={value}
      onChange={(event) => onChange(sanitizeRoomCode(event.target.value))}
      autoComplete="off"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="next"
      inputMode="text"
      required
    />
  );
}
