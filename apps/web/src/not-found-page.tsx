import { useEffect } from "react";
import { EntryFrame, EntryHeading } from "./ui/entry-frame";
import { LinkButton } from "./ui/primitives";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Not found · 26";
  }, []);

  return (
    <EntryFrame>
      <section className="skin-panel entry-recovery">
        <span className="entry-recovery-number" aria-hidden="true">
          404
        </span>
        <EntryHeading eyebrow="A wrong turn" title="That page isn’t here.">
          This link may be old or incomplete. You can still join with the code on the
          stage.
        </EntryHeading>
        <div className="grid gap-3">
          <LinkButton to="/join">Join the room</LinkButton>
          <LinkButton variant="secondary" to="/">
            Back to the party
          </LinkButton>
        </div>
      </section>
    </EntryFrame>
  );
}
