import { AnimatePresence, motion } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { Button, LinkButton } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { PhonePreviewPanel } from "./phone-preview-panel";
import { readContent } from "./sections-api";
import { useSection } from "./use-section";
import "./kart-page.css";

const views = [
  ["drive", "Drive"],
  ["layouts", "Phone & stage"],
  ["multiplayer", "Multiplayer"],
] as const;

export function AdminKartPage() {
  const [params, setParams] = useSearchParams();
  const view = views.find(([id]) => id === params.get("view"))?.[0] ?? "drive";
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">The 26 Grand Prix</p>
          <h1>Kart</h1>
        </div>
        <LinkButton to="/kart" target="_blank" rel="noreferrer">
          Open kart full screen ↗
        </LinkButton>
      </header>
      <p>
        Drive the circuit, check the phone and stage layouts, or prepare a room race.
      </p>
      <nav className="admin-kart-views" aria-label="Kart views">
        {views.map(([id, label]) => (
          <Button
            key={id}
            variant="secondary"
            aria-pressed={view === id}
            onClick={() => setParams({ view: id }, { replace: true })}
          >
            {label}
          </Button>
        ))}
      </nav>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {view === "drive" ? (
            <section className="admin-kart-pane" aria-label="Solo driving">
              <h2>Solo circuit</h2>
              <p>
                Press Start driving below. Use the arrow keys and Space, or the
                on-screen phone controls. Solo practice has no room connection or party
                points.
              </p>
              <p>
                Charge Mini, Super and Ultra turbos by holding drift, then release. On
                the opening straight, take the left lane for a floor boost and ramp; the
                right lane has a moving sweeper. Hold A to glide and B to descend.
                Course set-up inside the driving view can switch each feature off, clear
                the track or restore it. Changes reset and pause practice.
              </p>
              <iframe
                className="admin-kart-drive-frame"
                title="Solo kart practice"
                src="/kart-engine/index.html"
                allow="fullscreen"
              />
            </section>
          ) : view === "layouts" ? (
            <KartLayouts />
          ) : (
            <section className="admin-kart-pane" aria-label="Multiplayer rehearsal">
              <h2>Race with phones</h2>
              <p>
                The connected party race uses the ring circuit: guests drive on their
                phones and the stage shows the field and scoreboard. The imported solo
                circuit above is not connected to rooms yet.
              </p>
              <ol className="list-decimal space-y-2 pl-6">
                <li>Create or open a room, then open its Live controls.</li>
                <li>Connect the stage and join from each phone using the room code.</li>
                <li>
                  In local development, choose Start local kart rehearsal. Advance
                  through the quiz and kart get-ready beats to start the race.
                </li>
              </ol>
              <p>
                The rehearsal start is available only in local development. On the
                deployed site, kart must be included in the room’s released question
                pack. Layout previews do not start a race or change a room.
              </p>
              <Link className="entry-text-link" to="/admin/rooms">
                Open rooms →
              </Link>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function KartLayouts() {
  const content = useSection(readContent);
  const packs = content.data?.packs ?? [];
  const pack =
    packs.find(
      (item) =>
        item.id === "birthday" && item.questions.some((q) => q.mechanic === "kart"),
    ) ?? packs.find((item) => item.questions.some((q) => q.mechanic === "kart"));
  const question = pack?.questions.find((item) => item.mechanic === "kart");
  return (
    <section className="admin-kart-pane" aria-label="Kart layouts">
      <div>
        <Button
          variant="secondary"
          disabled={content.loading}
          onClick={() => void content.refresh()}
        >
          Refresh kart previews
        </Button>
      </div>
      <EntryNotice message={content.error} />
      {content.loading ? <p role="status">Loading kart previews…</p> : null}
      {pack && question ? (
        <>
          <p>
            {question.title} · {question.status} · {pack.version}
          </p>
          <PhonePreviewPanel version={pack.version} questionId={question.id} />
          <Link
            className="entry-text-link"
            to={`/admin/content/${encodeURIComponent(pack.version)}/${encodeURIComponent(question.id)}`}
          >
            Open kart question details →
          </Link>
        </>
      ) : !content.loading && !content.error ? (
        <p>No kart question is available in the current question packs.</p>
      ) : null}
    </section>
  );
}
