import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { Button, TextField } from "../ui/primitives";

export function GuestText({
  play,
  blocked,
  onSubmit,
  onDraft,
}: {
  play: PlaySnapshot;
  blocked: boolean;
  onSubmit: (body: string) => void;
  onDraft?: (body: string) => void;
}) {
  const accepted = play.selfAnswer?.kind === "text" ? play.selfAnswer.body : undefined;
  if (accepted) {
    return <p>Your line: {accepted}</p>;
  }
  return <TextDraft blocked={blocked} onSubmit={onSubmit} onDraft={onDraft} />;
}

function TextDraft({
  blocked,
  onSubmit,
  onDraft,
}: {
  blocked: boolean;
  onSubmit: (body: string) => void;
  onDraft?: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
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
      <Button type="submit" disabled={blocked || draft.trim().length === 0}>
        Send line
      </Button>
    </form>
  );
}
