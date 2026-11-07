import { AnimatePresence, motion } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { Button, LinkButton } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { PhonePreviewPanel } from "./phone-preview-panel";
import { readContent } from "./sections-api";
import { useSection } from "./use-section";
import "./kart-page.css";
import { KartLobbyCreate } from "./kart-lobby-create";
import { KartAssetsPanel } from "./kart-assets-panel";
import { KartVehicleRehearsal } from "./kart-vehicle-rehearsal";
import { KartStageRehearsal } from "./kart-stage-rehearsal";
import { VfxBench } from "./vfx-bench";
import { EnvironmentBench } from "./environment-bench";
import { KartControlsBench } from "./kart-controls-bench";
import { KartCollisionBench } from "./kart-collision-overlay";
import { KartTrialBench } from "./kart-trial-bench";
import { KartStartBench } from "./kart-start-bench";
import { KartRecapBench } from "./kart-recap-bench";
import { KartItemsBench } from "./kart-items-bench";
import { KartTracksBench } from "./kart-tracks-bench";

const views = [
  ["drive", "Drive"],
  ["layouts", "Phone & stage"],
  ["files", "Files & limits"],
  ["vehicles", "Vehicles"],
  ["stage", "Stage views"],
  ["effects", "Effects"],
  ["look", "Look"],
  ["controls", "Controls"],
  ["collisions", "Collisions"],
  ["trials", "Time trials"],
  ["start", "Race start"],
  ["recap", "Race results"],
  ["items", "Items sandbox"],
  ["tracks", "Tracks & modes"],
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
      <KartLobbyCreate />
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
                Graphics are local to each screen. Inside Course set-up, compare Auto,
                High and Low, then rehearse room sizes of 16 and 21. Auto also measures
                visible frames while driving and lowers detail after sustained slow
                frames; choose High to override it. It does not benchmark a phone model.
              </p>
              <p>
                Charge Mini, Super and Ultra turbos by holding drift, then release. On
                the opening straight, take the left lane for a floor boost and ramp; the
                right lane has a moving sweeper. Keep accelerating to glide and brake to
                descend. Course set-up inside the driving view can switch each feature
                off, clear the track or restore it. Changes reset and pause practice.
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
          ) : view === "vehicles" ? (
            <KartVehicleRehearsal />
          ) : view === "stage" ? (
            <KartStageRehearsal />
          ) : view === "effects" ? (
            <VfxBench />
          ) : view === "look" ? (
            <EnvironmentBench />
          ) : view === "controls" ? (
            <KartControlsBench />
          ) : view === "collisions" ? (
            <KartCollisionBench />
          ) : view === "trials" ? (
            <KartTrialBench />
          ) : view === "start" ? (
            <KartStartBench />
          ) : view === "recap" ? (
            <KartRecapBench />
          ) : view === "items" ? (
            <KartItemsBench />
          ) : view === "tracks" ? (
            <KartTracksBench />
          ) : view === "files" ? (
            <section
              className="admin-kart-pane"
              aria-label="Files and rendering rehearsal"
            >
              <KartAssetsPanel />
              <iframe
                className="admin-kart-drive-frame"
                title="Solo kart practice"
                src="/kart-engine/index.html"
                allow="fullscreen"
              />
            </section>
          ) : (
            <section className="admin-kart-pane" aria-label="Multiplayer rehearsal">
              <h2>Race with phones</h2>
              <p>
                The multiplayer race uses this imported circuit, with up to 80 racers
                and a three-minute limit. Room scores set the starting grid, highest
                first; equal scores keep joining order. Guests drive on their phones
                while the stage shows the field and scoreboard.
              </p>
              <ol className="list-decimal space-y-2 pl-6">
                <li>
                  Choose Create kart lobby above. Its Live controls open with a new join
                  code.
                </li>
                <li>Connect the stage and join from each phone using the room code.</li>
                <li>
                  Choose Start kart race when everyone is ready. Advance through the
                  get-ready beats, then drive. The race leads to results and the podium.
                </li>
              </ol>
              <p>
                The grid freezes when the race starts. Late arrivals can join the room
                and watch; create another kart lobby for their race. To rehearse without
                guests, join the new lobby from a private second tab and open its stage.
                Pause, end the race or switch course features off from Live controls.
                Layout previews do not start a race or change a room.
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
