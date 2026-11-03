import { useEffect, useState } from "react";
import { useRouteError } from "react-router";
import { EntryFrame, EntryHeading } from "./entry-frame";
import { Button, LinkButton } from "./primitives";
import {
  canReloadForNewBuild,
  isStaleBuildError,
  reloadForNewBuild,
} from "./stale-build";

/**
 * Shown instead of the router's developer error page. A tab left open across
 * a deployment reloads itself once; anything else gets a calm way back.
 */
export function RouteError() {
  const error = useRouteError();
  const stale = isStaleBuildError(error);
  // Decided once: reload automatically unless that was just tried.
  const [reloading] = useState(() => stale && canReloadForNewBuild());

  useEffect(() => {
    document.title = stale ? "Updating · 26" : "Something went wrong · 26";
    if (reloading) reloadForNewBuild();
  }, [stale, reloading]);

  return (
    <EntryFrame>
      <section className="skin-panel entry-recovery" role="alert">
        <EntryHeading
          eyebrow={stale ? "A fresh version" : "A hiccup"}
          title={stale ? "26 has just been updated." : "That screen didn’t load."}
        >
          {stale
            ? reloading
              ? "Loading the latest version…"
              : "This tab was opened before the update. Reload to carry on; your game and sign-in are kept."
            : "Reload to try again. Your game and sign-in are kept."}
        </EntryHeading>
        <div className="grid gap-3">
          <Button onClick={() => window.location.reload()} disabled={reloading}>
            {reloading ? "Reloading…" : "Reload"}
          </Button>
          <LinkButton variant="secondary" to="/">
            Back to the party
          </LinkButton>
        </div>
      </section>
    </EntryFrame>
  );
}
