import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "../ui/primitives";

const sizes = {
  Small: [320, 640],
  Standard: [390, 760],
  Large: [430, 820],
  Landscape: [740, 390],
} as const;
export function PhoneLauncher({
  gameId,
  joinCode,
}: {
  gameId: string;
  joinCode: string;
}) {
  const [take, setTake] = useState(""),
    [size, setSize] = useState<keyof typeof sizes>("Standard"),
    [stage, setStage] = useState(false);
  const [width, height] = sizes[size];
  return (
    <section
      className="skin-panel min-w-0 p-4 space-y-3"
      aria-label="Real phone launcher"
    >
      <h2>Real phone beside the stage</h2>
      <p>
        A generated test guest uses the real phone screen and live room connection.
        Leave a place free below 100 players. Credentials stay in memory; your ordinary
        guest session stays separate.
      </p>
      <div className="admin-actions">
        <Button onClick={() => setTake(crypto.randomUUID())}>
          {take ? "Add a new test phone" : "Open test phone"}
        </Button>
        {take ? (
          <Button variant="secondary" onClick={() => setTake("")}>
            Close phone preview
          </Button>
        ) : null}
        <Button
          variant="secondary"
          aria-pressed={stage}
          onClick={() => setStage(!stage)}
        >
          {stage ? "Hide stage preview" : "Show stage preview"}
        </Button>
        <label>
          Phone size{" "}
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as keyof typeof sizes)}
          >
            {Object.entries(sizes).map(([name, [w, h]]) => (
              <option key={name} value={name}>
                {name} · {w} × {h}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4 overflow-auto">
        <AnimatePresence>
          {take ? (
            <motion.iframe
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              key={take}
              title="Live rehearsal phone"
              src={`/admin/phone-preview/room/${gameId}?take=${take}`}
              style={{ width, height, flexShrink: 0 }}
              className="rounded-xl border border-line"
            />
          ) : null}
          {stage ? (
            <motion.iframe
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              title="Live rehearsal stage"
              src={`/host?code=${joinCode}&rehearsal=1`}
              style={{ width: 800, height: 450, flexShrink: 0 }}
              className="rounded-xl border border-line"
            />
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
