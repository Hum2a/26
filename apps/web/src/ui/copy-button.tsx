import { useState } from "react";
import { Button } from "./primitives";
import { EntryNotice } from "./entry-frame";
import { writeClipboardText } from "./clipboard";

export function CopyButton({
  text,
  label = "Copy link",
}: {
  text: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  return (
    <div className="grid gap-2 min-w-0">
      <Button
        variant="secondary"
        disabled={state === "copying"}
        onClick={async () => {
          setState("copying");
          setState((await writeClipboardText(text)) ? "copied" : "failed");
        }}
      >
        {state === "copying" ? "Copying…" : label}
      </Button>
      <EntryNotice
        message={
          state === "copied"
            ? "Link copied. Ready to share."
            : state === "failed"
              ? "Copying is unavailable here. Select and copy the link above."
              : ""
        }
      />
    </div>
  );
}
