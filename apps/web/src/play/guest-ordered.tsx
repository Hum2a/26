import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import type { PlaySnapshot } from "@26/shared";
import { Button } from "../ui/primitives";
import { SubmitButton } from "./controls/SubmitButton";
import { roundSubmitState } from "./controls/submit-state";
import { useDesignMotion } from "./designs/kit";

type Question = Extract<PlaySnapshot["question"], { kind: "rank" }>;
export function GuestOrdered({
  question,
  accepted,
  open,
  pending,
  onSubmit,
}: {
  question: Question;
  accepted?: { itemId: string; tierId: string }[];
  open: boolean;
  pending: boolean;
  onSubmit: (placements: { itemId: string; tierId: string }[]) => void;
}) {
  const [order, setOrder] = useState(() =>
    accepted
      ? [...accepted]
          .sort(
            (a, b) =>
              question.tiers.findIndex((t) => t.id === a.tierId) -
              question.tiers.findIndex((t) => t.id === b.tierId),
          )
          .map((p) => p.itemId)
      : question.items.map((i) => i.id),
  );
  function move(id: string, delta: number) {
    if (!open) return;
    const from = order.indexOf(id),
      to = from + delta;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    setOrder(next);
  }
  return (
    <div className="grid gap-3">
      <p>Least sinful at the top. Drag the handles, or use the move buttons.</p>
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={(next) => {
          if (open) setOrder(next);
        }}
        className="grid gap-3"
        aria-label="Your order"
      >
        {order.map((id, index) => (
          <OrderedItem
            key={id}
            id={id}
            label={question.items.find((i) => i.id === id)?.label ?? id}
            index={index}
            count={order.length}
            open={open}
            move={move}
          />
        ))}
      </Reorder.Group>
      <p role="status">{order.length} items · least to most sinful</p>
      {open || pending || accepted ? (
        <SubmitButton
          label="Send ranking"
          state={roundSubmitState(Boolean(accepted), pending)}
          onClick={() =>
            onSubmit(
              order.map((itemId, i) => ({ itemId, tierId: question.tiers[i]!.id })),
            )
          }
        />
      ) : null}
    </div>
  );
}

function OrderedItem({
  id,
  label,
  index,
  count,
  open,
  move,
}: {
  id: string;
  label: string;
  index: number;
  count: number;
  open: boolean;
  move: (id: string, delta: number) => void;
}) {
  const controls = useDragControls();
  const motionKit = useDesignMotion();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      layout={motionKit.reduce ? undefined : "position"}
      transition={motionKit.reduce ? motionKit.soft : motionKit.spring}
      className="relative grid gap-2 rounded-panel border border-line bg-surface p-3"
    >
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={!open}
          aria-label={`Drag ${label}`}
          style={{ touchAction: "none" }}
          onPointerDown={(event) => {
            if (open) controls.start(event);
          }}
        >
          ↕
        </Button>
        <span className="font-bold">
          {index + 1}. {label}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={!open || index === 0}
          aria-label={`Move ${label} up`}
          onClick={() => move(id, -1)}
        >
          ↑ Up
        </Button>
        <Button
          variant="secondary"
          disabled={!open || index === count - 1}
          aria-label={`Move ${label} down`}
          onClick={() => move(id, 1)}
        >
          ↓ Down
        </Button>
      </div>
    </Reorder.Item>
  );
}
