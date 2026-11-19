import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button, TextField } from "../ui/primitives";
import { pairProjector } from "../live/room-api";
import { cleanPairingCode, pairingCodePattern } from "./pairing-code";

/**
 * Pairs a projector laptop that has no admin login. Humza shows a one-time
 * code in Live controls; this screen sends it with the room's join code and
 * the room sets this browser's presentation credential.
 */
export function ProjectorPairing({
  joinCode,
  onPaired,
}: {
  /** The join code typed in the connect form above. */
  joinCode: string;
  onPaired: (joinCode: string) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // A retry after a dropped connection reuses the request, so the room
  // returns the same credential instead of refusing a code it already used.
  const pending = useRef<{ key: string; requestId: string } | null>(null);
  const reduced = useReducedMotion();

  async function pair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const room = joinCode.trim().toUpperCase();
    const pairing = cleanPairingCode(code);
    if (!/^[A-Z0-9]{6}$/.test(room)) {
      setMessage("Enter the room’s six-character join code above first.");
      return;
    }
    if (!pairingCodePattern.test(pairing)) {
      setMessage("Enter the eight-character pairing code from Live controls.");
      return;
    }
    const key = `${room}:${pairing}`;
    const requestId =
      pending.current?.key === key ? pending.current.requestId : crypto.randomUUID();
    pending.current = { key, requestId };
    setBusy(true);
    setMessage("Pairing this screen…");
    try {
      const result = await pairProjector({ joinCode: room, code: pairing, requestId });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      pending.current = null;
      setCode("");
      setMessage("Paired. Connecting the room…");
      onPaired(result.joinCode);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="projector-connect projector-pairing"
      aria-label="Pair this screen"
      onSubmit={(event) => void pair(event)}
    >
      <h3>No admin login on this laptop?</h3>
      <p>
        In Live controls, choose Show pairing code. Type the join code above, then the
        pairing code here. Each code works once, for ten minutes.
      </p>
      <TextField
        label="Pairing code"
        hint="Eight letters or numbers from Live controls."
        value={code}
        onChange={(event) => setCode(event.target.value)}
        maxLength={12}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
      />
      <Button type="submit" variant="secondary" disabled={busy}>
        {busy ? "Pairing…" : "Pair this screen"}
      </Button>
      <AnimatePresence initial={false}>
        {message ? (
          <motion.p
            key="pairing-status"
            role="status"
            initial={{ opacity: 0, y: reduced ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.2, ease: "easeOut" }}
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
