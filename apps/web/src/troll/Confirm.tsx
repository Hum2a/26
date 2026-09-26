import { useRef } from "react";
import { Button } from "../ui/primitives";

/** Confirm before the existing troll command. There is no separate USE_TROLL message. */
export function TrollConfirm({
  nickname,
  troll,
  onCancel,
  onConfirm,
}: {
  nickname: string;
  troll: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const sent = useRef(false);

  return (
    <div
      className="grid gap-3 rounded-3xl border border-line bg-surface p-4"
      role="dialog"
      aria-label="Confirm troll"
    >
      <p className="text-xl font-bold">
        Troll {nickname} with {troll}?
      </p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (sent.current) {
              return;
            }
            sent.current = true;
            onConfirm();
          }}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}
