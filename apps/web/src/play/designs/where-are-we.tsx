import { lazy, Suspense, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { pinDistanceKm, type MapPin, type PlaySnapshot } from "@26/shared";
import { SubmitButton } from "../controls/SubmitButton";
import { roundSubmitState } from "../controls/submit-state";
import type { PhoneControls, PresentationProps } from "../presentation";
import { LiveCount, QuestionTag, StagePrompt, useDesignMotion } from "./kit";
import "./where-are-we.css";

const GuessMap = lazy(() =>
  import("../map-guess").then((board) => ({ default: board.GuessMap })),
);

type MapQuestion = Extract<PlaySnapshot["question"], { kind: "map-guess" }>;
type MapReveal = Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "map-guess" }>;

function km(value: number) {
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })} km`;
}

/** Clue photo plus a pin map on the phone, then a projector reveal of guesses vs truth. */
export function WhereAreWe(props: PresentationProps) {
  if (props.play.question.kind !== "map-guess") {
    return undefined;
  }
  const reveal =
    props.play.reveal?.kind === "map-guess" ? props.play.reveal : undefined;
  return props.surface === "phone" ? (
    <WherePhone key={props.play.question.id}
      play={props.play}
      phase={props.phase}
      controls={props.controls}
      question={props.play.question}
      reveal={reveal}
    />
  ) : (
    <WhereStage
      play={props.play}
      phase={props.phase}
      question={props.play.question}
      reveal={reveal}
    />
  );
}

function WherePhone({
  play,
  phase,
  controls,
  question,
  reveal,
}: {
  play: PlaySnapshot;
  phase: PresentationProps["phase"];
  controls: PhoneControls;
  question: MapQuestion;
  reveal: MapReveal | undefined;
}) {
  const motionSet = useDesignMotion();
  const [draft, setDraft] = useState<MapPin>();
  const [photoOpen, setPhotoOpen] = useState(false);
  const accepted =
    play.selfAnswer?.kind === "map-guess" ? play.selfAnswer.pin : undefined;
  const pin = reveal ? accepted : (accepted ?? draft);
  const locked = accepted !== undefined;
  const answering = phase === "collect";
  const editable = controls.open && !locked && answering;
  const photo = question.image;

  return (
    <section className="design-phone where-are-we" aria-label="Where are we?">
      <QuestionTag play={play}>Map guess</QuestionTag>
      <h1 className="phone-prompt">{question.prompt}</h1>
      {photo ? (
        <button
          type="button"
          className="where-clue"
          onClick={() => setPhotoOpen(true)}
          aria-label="Open clue photo"
        >
          <img
            src={photo.src}
            alt={photo.alt ?? "Clue photo for the mystery location"}
            width={1000}
            height={667}
            decoding="async"
          />
          <span className="where-clue-credit">
            Photo: {photo.credit} · tap to enlarge
          </span>
        </button>
      ) : (
        <p className="where-missing">
          Clue photo still to come. The map below is for rehearsal only.
        </p>
      )}
      <AnimatePresence>
        {photoOpen && photo ? (
          <motion.button
            type="button"
            className="where-clue-lightbox"
            aria-label="Close clue photo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
            onClick={() => setPhotoOpen(false)}
          >
            <img
              src={photo.src}
              alt={photo.alt ?? "Clue photo for the mystery location"}
              width={1000}
              height={667}
              decoding="async"
            />
          </motion.button>
        ) : null}
      </AnimatePresence>
      {reveal ? (
        <p className="where-result">
          {reveal.label}
          {accepted
            ? ` · Your pin was ${km(pinDistanceKm(accepted, reveal.target))} away.`
            : ""}
        </p>
      ) : answering ? (
        <p className="where-help">
          {editable
            ? "Pan and zoom, then tap to drop your pin. Send it from the dock."
            : "Watch the map. Pins lock in when the room accepts them."}
        </p>
      ) : (
        <p className="where-help">Study the clue. The map opens when answers do.</p>
      )}
      {answering || reveal ? (
        <div className="where-map-slot">
          <Suspense fallback={<p role="status">Loading the map…</p>}>
            <GuessMap
              className="where-map"
              pin={pin}
              target={reveal?.target}
              guesses={reveal?.pins}
              editable={editable}
              onPin={setDraft}
            />
          </Suspense>
        </div>
      ) : null}
      {pin && !reveal ? (
        <p aria-live="polite" className="where-coords">
          Pin at {pin.lat.toFixed(2)}°, {pin.lng.toFixed(2)}°
        </p>
      ) : null}
      {(controls.open || controls.pending || locked) && !reveal ? (
        <SubmitButton
          className={controls.dodge ? "troll-dodge" : ""}
          label="Send pin"
          state={roundSubmitState(locked, controls.pending)}
          disabled={!locked && !pin}
          onClick={() => {
            if (editable && pin) controls.onMapPin?.(pin);
          }}
        />
      ) : null}
    </section>
  );
}

function WhereStage({
  play,
  phase,
  question,
  reveal,
}: {
  play: PlaySnapshot;
  phase: PresentationProps["phase"];
  question: MapQuestion;
  reveal: MapReveal | undefined;
}) {
  const motionSet = useDesignMotion();
  const photo = question.image;
  const answering = phase === "collect";
  return (
    <section className="design-stage where-are-we-stage" aria-label="Where are we?">
      <QuestionTag play={play}>Map guess</QuestionTag>
      <StagePrompt text={reveal?.label ?? question.prompt} />
      <div className="where-stage-grid" data-revealed={reveal ? "" : undefined}>
        {photo ? (
          <motion.figure
            className="where-stage-photo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={motionSet.soft}
          >
            <img
              src={photo.src}
              alt={photo.alt ?? "Clue photo for the mystery location"}
              width={1000}
              height={667}
              decoding="async"
            />
            <figcaption>Photo: {photo.credit}</figcaption>
          </motion.figure>
        ) : (
          <p className="design-stage-line">Clue photo still to come.</p>
        )}
        {answering || reveal ? (
          <div className="where-stage-map">
            <Suspense fallback={<p role="status">Loading the map…</p>}>
              <GuessMap
                className="where-map"
                target={reveal?.target}
                guesses={reveal?.pins}
              />
            </Suspense>
          </div>
        ) : null}
      </div>
      {reveal ? (
        <>
          <p className="design-stage-line">
            Pink is the true spot. Blue pins are the room.
          </p>
          {reveal.closest.length ? (
            <ol className="where-closest" aria-label="Closest pins">
              {reveal.closest.map((row, index) => (
                <motion.li
                  key={`${row.nickname}-${index}`}
                  initial={{ opacity: 0, y: motionSet.move(16) }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...motionSet.soft,
                    delay: motionSet.delay(0.18 * index),
                  }}
                >
                  {row.nickname} · {km(row.distanceKm)} away
                </motion.li>
              ))}
            </ol>
          ) : (
            <p className="design-stage-line">No pins landed this round.</p>
          )}
        </>
      ) : (
        <p className="design-stage-line">
          {answering ? (
            <LiveCount value={play.submissionCount} one="pin sent" many="pins sent" />
          ) : (
            "Look at the clue. Phones get the map when answering opens."
          )}
        </p>
      )}
    </section>
  );
}
