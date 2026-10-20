import { useState } from "react";
import { Button } from "../ui/primitives";
import "./phone-preview.css";

export function PhonePreviewPanel({
  version,
  questionId,
}: {
  version: string;
  questionId: string;
}) {
  const [phase, setPhase] = useState("collect");
  const [width, setWidth] = useState(390);
  const [revision, setRevision] = useState(0);
  const path = `/admin/phone-preview/${encodeURIComponent(version)}/${encodeURIComponent(questionId)}?phase=${phase}&take=${revision}`;
  return (
    <section
      className="admin-phone-preview"
      id="phone-preview"
      aria-label="Phone preview"
    >
      <header>
        <div>
          <p className="entry-eyebrow">Guest experience</p>
          <h2>Phone preview</h2>
        </div>
        <a className="entry-text-link" href={path} target="_blank" rel="noreferrer">
          Open at full size ↗
        </a>
      </header>
      <p>
        Try the actual phone layout. Preview answers stay here; no game is connected.
        Reveal answers and scores are not simulated.
      </p>
      <div className="admin-preview-controls">
        <div role="group" aria-label="Preview phase">
          {[
            ["prompt", "Get ready"],
            ["collect", "Answering"],
            ["vote", "Voting (vote rounds)"],
          ].map(([id, label]) => (
            <Button
              key={id}
              variant="secondary"
              aria-pressed={phase === id}
              onClick={() => setPhase(id!)}
            >
              {label}
            </Button>
          ))}
        </div>
        <label>
          Phone width{" "}
          <select
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          >
            {[320, 390, 430].map((value) => (
              <option key={value} value={value}>
                {value} px
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" onClick={() => setRevision((value) => value + 1)}>
          Reset preview
        </Button>
      </div>
      <div className="admin-phone-preview-frame" style={{ maxWidth: width }}>
        <iframe
          key={path}
          title="Interactive phone preview"
          src={path}
          loading="lazy"
        />
      </div>
      <p className="admin-meta">
        {width}px maximum width; the frame fits smaller admin windows. Use “Open at full
        size” to try it on your phone.
      </p>
    </section>
  );
}
