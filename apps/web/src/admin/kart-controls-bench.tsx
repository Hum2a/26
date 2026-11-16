import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { kartNeutral, type KartControls } from "@26/shared";
import { TouchController } from "../kart/TouchController";
import { Button } from "../ui/primitives";
import { useKartContactFeedback } from "../kart/useKartContactFeedback";

/** The real input component, isolated from sockets, scores and room commands. */
export function KartControlsBench() {
  const [controls, setControls] = useState<KartControls>({ ...kartNeutral });
  const [paused, setPaused] = useState(false),
    [run, setRun] = useState(0);
  const [items, setItems] = useState(0),
    [recoveries, setRecoveries] = useState(0);
  const [history, setHistory] = useState<{ id: number; at: number; label: string }[]>(
    [],
  );
  const sequence = useRef(0);
  const [contact, setContact] = useState({ elapsedMs: 0, contact: false });
  const feedback = useKartContactFeedback({
    ...contact,
    raceId: `bench-${run}`,
    active: !paused,
  });
  const change = useCallback((next: KartControls) => setControls(next), []);
  const record = (label: string) => {
    const at = performance.now();
    const id = ++sequence.current;
    setHistory((rows) => [...rows, { id, at, label }].slice(-20));
  };
  return (
    <section
      className="admin-kart-pane kart-controls-bench"
      aria-label="Kart controls rehearsal"
    >
      {feedback.overlay}
      <h2>Controls bench</h2>
      <p>
        Try the real phone and solo controls here. No room is connected and nothing
        scores. Plug in a gamepad, release its buttons, then drive. Use Controls to tune
        steering or enable the mouse area.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={(event) => {
            if (paused) event.currentTarget.blur();
            setPaused((value) => !value);
          }}
        >
          {paused ? "Resume controls" : "Pause controls"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            feedback.reset();
            setRun((value) => value + 1);
            setPaused(false);
            setItems(0);
            setRecoveries(0);
            setHistory([]);
            setContact({ elapsedMs: 0, contact: false });
          }}
        >
          Reset rehearsal
        </Button>
      </div>
      <p role="status">
        {paused
          ? "Paused — controls released"
          : "Controls ready — fresh input after resuming"}
      </p>
      <TouchController
        key={run}
        disabled={paused}
        onChange={change}
        extraSettings={feedback.settings}
        onUseItem={() => {
          setItems((value) => value + 1);
          record("You tried an item");
        }}
        onRecover={() => {
          setRecoveries((value) => value + 1);
          record("You tried recovery");
        }}
      />
      <output aria-label="Current driving input">
        Steering {controls.steer.toFixed(2)} · Accelerate {controls.gas ? "on" : "off"}{" "}
        · Brake {controls.brake ? "on" : "off"} · Drift {controls.drift ? "on" : "off"}
      </output>
      <p>
        Item attempts: {items} · Recoveries: {recoveries}
      </p>
      <div className="flex flex-wrap gap-3" aria-label="Stand-in contact rehearsal">
        <Button
          variant="secondary"
          disabled={paused}
          onClick={() => {
            setContact((value) => ({
              elapsedMs: value.elapsedMs + 500,
              contact: !value.contact,
            }));
            record(contact.contact ? "Stand-in contact cleared" : "Stand-in contact");
          }}
        >
          {contact.contact ? "Clear contact" : "Rehearse contact"}
        </Button>
        <p>
          This contact is a stand-in, using the real feedback. Sound and vibration are
          optional in Controls.
        </p>
      </div>
      <p>
        Try holding accelerate, pause, then resume without releasing the key or gamepad.
        Driving stays released until a fresh press. Keyboard shortcuts ignore text
        fields and dialogs.
      </p>
      <ol aria-label="Local control rehearsal history">
        <AnimatePresence initial={false}>
          {history.map((entry) => (
            <motion.li
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              {entry.label} · {(entry.at / 1000).toFixed(1)}s on this page
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <p>
        For the actual moving kart, open Drive. These same controls drive its practice
        engine; recovery and items stay local to practice.
      </p>
    </section>
  );
}
