import { useEffect, useRef, useState } from "react";
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
  const stagePath = path.replace("/phone-preview/", "/stage-preview/");
  return (
    <section
      className="admin-phone-preview"
      id="phone-preview"
      aria-label="Screen comparison"
    >
      <header>
        <div>
          <p className="entry-eyebrow">Rehearse the question</p>
          <h2>Phone & big screen</h2>
        </div>
      </header>
      <p>
        Compare the actual guest and projector layouts. These controls change both
        screens. Phone answers stay in the phone rehearsal; no live game is connected.
        Reveal answers, countdowns and scores are not simulated.
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
      <div className="admin-screen-comparison">
        <section className="admin-screen-pane" aria-label="Big-screen preview">
          <header>
            <h3>Big screen</h3>
            <a
              className="entry-text-link"
              href={stagePath}
              target="_blank"
              rel="noreferrer"
            >
              Open big screen ↗
            </a>
          </header>
          <StagePreviewFrame path={stagePath} />
          <p className="admin-meta">
            16:9 projector view, scaled from 1920 × 1080. Open it for a closer look.
          </p>
        </section>
        <section className="admin-screen-pane" aria-label="Phone preview">
          <header>
            <h3>Phone</h3>
            <a className="entry-text-link" href={path} target="_blank" rel="noreferrer">
              Open at full size ↗
            </a>
          </header>
          <div className="admin-phone-preview-frame" style={{ maxWidth: width }}>
            <iframe
              key={path}
              title="Interactive phone preview"
              src={path}
              loading="lazy"
            />
          </div>
          <p className="admin-meta">
            {width}px maximum width; the frame fits smaller admin windows. Use “Open at
            full size” to try it on your phone.
          </p>
        </section>
      </div>
    </section>
  );
}

/** Preserve a real projector viewport rather than letting its layout collapse to phone width. */
function StagePreviewFrame({ path }: { path: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => setScale(element.clientWidth / 1920);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={frame} className="admin-stage-preview-frame">
      <iframe
        key={path}
        title="Big-screen preview"
        src={path}
        style={{ transform: `scale(${scale})` }}
        loading="lazy"
      />
    </div>
  );
}
