import { useEffect, useState } from "react";
import { Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { NetanyahuFlood } from "../troll/guest-troll";
import { readTrolls } from "./sections-api";
import { useSection } from "./use-section";

/** Phone previews for trolls with a bespoke overlay. */
const previews: Record<string, (label: string) => React.ReactNode> = {
  netanyahu: (label) => <NetanyahuFlood label={label} />,
};

export function TrollsPage() {
  const report = useSection(readTrolls);
  const [preview, setPreview] = useState<{ kind: string; label: string } | null>(
    null,
  );
  useEffect(() => {
    if (!preview) {
      return;
    }
    const timer = window.setTimeout(() => setPreview(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [preview]);
  const trolls = report.data?.trolls ?? [];
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Catalogue</p>
          <h1>Trolls</h1>
        </div>
        <Button
          variant="secondary"
          disabled={report.loading}
          onClick={() => void report.refresh()}
        >
          Refresh
        </Button>
      </header>
      <p>
        Every troll guests can send. Each guest gets one, unlocked from the third
        question.
      </p>
      <EntryNotice message={report.error} />
      {report.loading && !report.data ? <p role="status">Loading trolls…</p> : null}
      <div className="grid gap-3">
        {trolls.map((troll) => (
          <article
            key={troll.kind}
            className="grid gap-2 rounded-3xl border border-line bg-surface p-4"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">{troll.label}</h2>
              <code>{troll.kind}</code>
            </header>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt>Asset</dt>
              <dd>{troll.assetLabel}</dd>
              <dt>Type</dt>
              <dd>{troll.slot === "transient" ? "Transient" : "Persistent"}</dd>
              <dt>Lasts</dt>
              <dd>
                {troll.durationMs === null
                  ? "Until the question ends"
                  : `${troll.durationMs / 1_000} seconds`}
              </dd>
              <dt>Escape</dt>
              <dd>{troll.escape ?? "None"}</dd>
              <dt>Phases</dt>
              <dd>{troll.phases.join(", ")}</dd>
              <dt>Announced</dt>
              <dd>{troll.announce === "now" ? "Immediately" : `At ${troll.announce}`}</dd>
              <dt>Blocks sending</dt>
              <dd>{troll.disruptsSubmission ? "Yes" : "No"}</dd>
            </dl>
            {previews[troll.kind] ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPreview({ kind: troll.kind, label: troll.assetLabel })}
              >
                Preview on this screen
              </Button>
            ) : null}
          </article>
        ))}
      </div>
      {preview ? previews[preview.kind]?.(preview.label) : null}
    </section>
  );
}
