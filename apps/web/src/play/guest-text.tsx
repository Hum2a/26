import { useRef, useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { SubmitButton } from "../rounds/SubmitButton";
import { TextField } from "../ui/primitives";

export function GuestText({
  play,
  blocked,
  pending,
  onSubmit,
  onDraft,
}: {
  play: PlaySnapshot;
  blocked: boolean;
  pending: boolean;
  onSubmit: (body: string) => void;
  onDraft?: (body: string) => void;
}) {
  const accepted = play.selfAnswer?.kind === "text" ? play.selfAnswer.body : undefined;
  if (accepted) {
    return (
      <div className="grid gap-3">
        <p>Your line: {accepted}</p>
        <SubmitButton label="Send line" state="locked" onClick={() => undefined} />
      </div>
    );
  }
  return (
    <TextDraft
      blocked={blocked}
      pending={pending}
      onSubmit={onSubmit}
      onDraft={onDraft}
    />
  );
}

function TextDraft({
  blocked,
  pending,
  onSubmit,
  onDraft,
}: {
  blocked: boolean;
  pending: boolean;
  onSubmit: (body: string) => void;
  onDraft?: (body: string) => void;
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
        label="Your line"
        hint="1 to 80 characters. Sending stores this text."
        value={draft}
        maxLength={80}
        disabled={blocked}
        onChange={(event) => {
          setDraft(event.target.value);
          onDraft?.(event.target.value);
        }}
      />
      <SubmitButton
        ref={submit}
        label="Send line"
        state={pending ? "sending" : "idle"}
        disabled={blocked || draft.trim().length === 0}
        onClick={() => onSubmit(draft)}
      />
    </form>
  );
}
