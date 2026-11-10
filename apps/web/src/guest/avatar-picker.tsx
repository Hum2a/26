import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import camera from "@iconify-icons/lucide/camera";
import { Button } from "../ui/primitives";
import { PlayerAvatar } from "../ui/player-avatar";
import { avatarUrl } from "../ui/roster-context";
import { CaptureFlow } from "../photo/CaptureFlow";
import { sendFacePhoto } from "../media/face-upload";
import { avatarEdge } from "./avatar-prompt";
import "./avatar-picker.css";

/**
 * The guest's profile photo: a selfie or a photo from their library, shown
 * beside their nickname all game. Optional. The photo is saved only after the
 * room accepts it; until then the button says so.
 */
export function AvatarPicker({
  gameId,
  playerId,
  nickname,
  avatarMediaId,
  pending,
  onChoose,
  onSkip,
  variant = "welcome",
}: {
  gameId: string;
  playerId: string;
  nickname: string;
  avatarMediaId: string | undefined;
  /** A choice is on its way to the room. */
  pending: boolean;
  onChoose: (mediaId: string | null) => void;
  /** Welcome card only: hide it for now. */
  onSkip?: () => void;
  variant?: "welcome" | "menu";
}) {
  const reduce = useReducedMotion() ?? false;
  const [taking, setTaking] = useState(false);
  const face = avatarMediaId ? avatarUrl(gameId, avatarMediaId) : null;
  const titleId = `avatar-picker-${variant}`;

  return (
    <section className="avatar-picker" data-variant={variant} aria-labelledby={titleId}>
      <header className="avatar-picker-head">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={avatarMediaId ?? "none"}
            className="avatar-picker-face"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -12 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={
              reduce
                ? { duration: 0.2 }
                : { type: "spring", stiffness: 420, damping: 20 }
            }
          >
            <PlayerAvatar
              playerId={playerId}
              nickname={nickname}
              faceSrc={face}
              size="xl"
            />
          </motion.span>
        </AnimatePresence>
        <div className="min-w-0">
          <h2 id={titleId}>{avatarMediaId ? "Your photo" : "Add your face"}</h2>
          <p>
            {avatarMediaId
              ? "Your photo sits beside your name: in the standings, on your kart and on the big screen whenever the host shows who picked what."
              : "Optional. Take a selfie so your face, not just your initials, appears beside your name, including on the big screen when the host shows who picked what."}
          </p>
        </div>
      </header>

      <div className="avatar-picker-actions">
        <Button
          variant={avatarMediaId ? "secondary" : "primary"}
          disabled={pending}
          aria-expanded={taking}
          onClick={() => setTaking((value) => !value)}
        >
          <Icon icon={camera} aria-hidden="true" />{" "}
          {taking
            ? "Close camera"
            : avatarMediaId
              ? "Change my photo"
              : "Take a selfie"}
        </Button>
        {avatarMediaId ? (
          <Button variant="secondary" disabled={pending} onClick={() => onChoose(null)}>
            Remove my photo
          </Button>
        ) : onSkip && !taking ? (
          <Button variant="secondary" onClick={onSkip}>
            Not now
          </Button>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {pending ? (
          <motion.p
            key="saving"
            role="status"
            className="avatar-picker-status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            Saving your photo…
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {taking ? (
          <motion.div
            key="camera"
            className="avatar-picker-camera"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.24, ease: [0.2, 0, 0, 1] }}
          >
            <CaptureFlow
              facing="user"
              library
              square
              upload={async (file, setStatus) => {
                const mediaId = await sendFacePhoto(
                  gameId,
                  file,
                  setStatus,
                  avatarEdge,
                );
                if (!mediaId) return false;
                onChoose(mediaId);
                setTaking(false);
                return true;
              }}
            />
            <p className="avatar-picker-fine">
              The host can remove a photo. It is not added to the photo wall.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
