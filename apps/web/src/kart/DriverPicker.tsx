import { lazy, Suspense, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { driverStyles, type DriverStyle, type LobbyDriver } from "@26/shared";
import { Button } from "../ui/primitives";
import { CaptureFlow } from "../photo/CaptureFlow";
import { sendFacePhoto } from "../media/face-upload";
import { DriverBadge, DriverEmblem } from "./DriverBadge";

const SoloPracticeFrame = lazy(() =>
  import("./SoloPracticeFrame").then((frame) => ({ default: frame.SoloPracticeFrame })),
);

/**
 * Lobby choice of kart driver. The style saves at once; a face photo is
 * optional and only used once the guest has read where it will appear.
 */
export function DriverPicker({
  gameId,
  nickname,
  driver,
  pending,
  onChoose,
  avatarMediaId,
}: {
  gameId: string;
  nickname: string;
  driver: LobbyDriver | undefined;
  pending: boolean;
  onChoose: (style: DriverStyle, faceMediaId: string | null) => void;
  /** The guest's profile photo; a driver with no photo of its own uses it. */
  avatarMediaId?: string;
}) {
  const reduced = useReducedMotion();
  const [taking, setTaking] = useState(false);
  const [practice, setPractice] = useState(false);
  const style = driver?.style ?? "racer";
  const face = driver?.faceMediaId ?? null;
  const borrowed = face !== null && face === avatarMediaId;

  return (
    <section className="driver-picker" aria-labelledby="driver-picker-title">
      <header className="driver-picker-head">
        <DriverBadge gameId={gameId} driver={driver} nickname={nickname} size={56} />
        <div>
          <h2 id="driver-picker-title">Your kart driver</h2>
          <p>
            Pick who drives your kart in the race. You can change this until the end.
          </p>
        </div>
      </header>

      <fieldset className="driver-picker-styles" disabled={pending}>
        <legend className="sr-only">Driver style</legend>
        {driverStyles.map((option) => (
          <label
            key={option.id}
            className="driver-style"
            data-selected={option.id === style}
          >
            <input
              type="radio"
              name="driver-style"
              value={option.id}
              checked={option.id === style}
              onChange={() => onChoose(option.id, face)}
            />
            <motion.span
              className="driver-style-art"
              animate={{ scale: option.id === style && !reduced ? 1.06 : 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
            >
              <DriverEmblem style={option.id} />
            </motion.span>
            <span className="driver-style-name">{option.name}</span>
            <span className="driver-style-note">{option.note}</span>
          </label>
        ))}
      </fieldset>
      <Button
        variant="secondary"
        aria-expanded={practice}
        onClick={() => setPractice((value) => !value)}
      >
        {practice ? "Close practice" : "Practise with my driver"}
      </Button>
      <AnimatePresence initial={false}>
        {practice ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <p>
              Solo practice uses your chosen driver and visible photo. No room controls
              or party points.
            </p>
            <Suspense fallback={<p role="status">Preparing solo practice…</p>}>
              <SoloPracticeFrame gameId={gameId} driver={driver} />
            </Suspense>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="driver-picker-face">
        <h3>Your face on the driver</h3>
        <p>
          Optional. Your photo is shown on your kart and on the big screen during the
          race. The host can remove it, and it is not added to the photo gallery.
          {borrowed
            ? " Your profile photo is on the driver now; take another to use a different one."
            : ""}
        </p>
        <div className="driver-picker-actions">
          <Button
            variant="secondary"
            disabled={pending}
            aria-expanded={taking}
            onClick={() => setTaking((value) => !value)}
          >
            {taking ? "Close camera" : face ? "Retake my photo" : "Use my photo"}
          </Button>
          {face && !borrowed ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => onChoose(style, null)}
            >
              Remove my photo
            </Button>
          ) : null}
        </div>
        <AnimatePresence initial={false}>
          {taking ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduced ? 0.01 : 0.22 }}
              className="driver-picker-camera"
            >
              <CaptureFlow
                upload={async (file, setStatus) => {
                  const mediaId = await sendFacePhoto(gameId, file, setStatus);
                  if (!mediaId) return false;
                  onChoose(style, mediaId);
                  setTaking(false);
                  return true;
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
