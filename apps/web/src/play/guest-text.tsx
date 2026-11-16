import { useRef, useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "./controls/SubmitButton";
import { TextField } from "../ui/primitives";

export function GuestText({
  play,
  blocked,
  pending,
  onSubmit,
  onDraft,
  label = "Your line",
  action = "Send line",
  maxLength = 80,
}: {
  play: PlaySnapshot;
  blocked: boolean;
  pending: boolean;
  onSubmit: (body: string) => void;
  onDraft?: (body: string) => void;
  label?: string;
  action?: string;
  maxLength?: number;
}) {
  const accepted = play.selfAnswer?.kind === "text" ? play.selfAnswer.body : undefined;
  if (accepted) {
    return (
      <div className="grid gap-3">
        <p>
          {label}: {accepted}
        </p>
        <SubmitButton label={action} state="locked" onClick={() => undefined} />
      </div>
    );
  }
  return (
    <TextDraft
      blocked={blocked}
      pending={pending}
      onSubmit={onSubmit}
      onDraft={onDraft}
      label={label}
      action={action}
      maxLength={maxLength}
    />
  );
}

function TextDraft({
  blocked,
  pending,
  onSubmit,
  onDraft,
  label,
  action,
  maxLength,
}: {
  blocked: boolean;
  pending: boolean;
  onSubmit: (body: string) => void;
  onDraft?: (body: string) => void;
  label: string;
  action: string;
  maxLength: number;
}) {
  const [draft, setDraft] = useState("");
  const submit = useRef<HTMLButtonElement>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit.current?.click();
      }}
    >
      <TextField
        label={label}
        hint={`Up to ${maxLength} characters. Tap ${action.toLowerCase()} when you’re ready.`}
        value={draft}
        maxLength={maxLength}
        disabled={blocked}
        onChange={(event) => {
          setDraft(event.target.value);
          onDraft?.(event.target.value);
        }}
      />
      <SubmitButton
        ref={submit}
        label={action}
        state={pending ? "sending" : "idle"}
        disabled={blocked || draft.trim().length === 0}
        onClick={() => onSubmit(draft)}
      />
    </form>
  );
}
