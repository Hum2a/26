import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  wallCaptionMax,
  wallFrames,
  wallReactions,
  type LobbySnapshot,
  type WallFrame,
  type WallReaction,
} from "@26/shared";
import { Button } from "../ui/primitives";
import { FramedPhoto, frameLabels, reactionEmoji, reactionLabels } from "./framed-photo";
import { sendWallPhoto } from "./wall-upload";
import { buzz } from "../device/haptics";
import { serverOffset } from "../live/server-clock";

/** Server time, ticking once a second while `active`. */
function useServerNow(active: boolean): number {
  const read = () => Date.now() + (serverOffset() ?? 0);
  const [now, setNow] = useState(read);
  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(read());
    const timer = window.setInterval(() => setNow(read()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

type Wall = NonNullable<LobbySnapshot["wall"]>;
type Mine = NonNullable<Wall["mine"]>[number];

const statusText: Record<Mine["status"], string> = {
  pending: "Waiting for the host",
  queued: "In the queue",
  showing: "On screen now!",
  shown: "Shown",
  declined: "Not shown this time",
  removed: "Taken down",
};

/**
 * The photo wall on a guest's phone: the composer, their photos with live
 * status, and the reaction bar while someone else's photo is up.
 */
export function GuestWall({
  wall,
  gameId,
  selfNickname,
  onPost,
  onWithdraw,
  onReact,
}: {
  wall: Wall;
  gameId: string;
  selfNickname: string;
  onPost: (post: { mediaId: string; caption: string; frame: WallFrame; keep: boolean }) => void;
  onWithdraw: (postId: string) => void;
  onReact: (postId: string, reaction: WallReaction) => void;
}) {
  const mine = wall.mine ?? [];
  const showingMine = Boolean(wall.now && mine.some((item) => item.postId === wall.now?.postId));
  // A buzz when your own photo reaches the big screen.
  const mineOnScreen = showingMine ? wall.now?.postId : undefined;
  useEffect(() => {
    if (mineOnScreen) {
      buzz([60, 40, 120]);
    }
  }, [mineOnScreen]);
  return (
    <div className="grid gap-5" data-wall="">
      {wall.now && !showingMine ? (
        <ReactionBar
          key={wall.now.postId}
          nickname={wall.now.nickname}
          onReact={(reaction) => wall.now && onReact(wall.now.postId, reaction)}
        />
      ) : null}
      {wall.enabled ? (
        <Composer
          gameId={gameId}
          nickname={selfNickname}
          blocked={wall.blocked ?? null}
          cooldownUntil={wall.cooldownUntil ?? null}
          onPost={onPost}
        />
      ) : (
        <p role="status">The photo wall is switched off right now.</p>
      )}
      {mine.length > 0 ? (
        <Tray mine={[...mine].reverse()} gameId={gameId} onWithdraw={onWithdraw} />
      ) : null}
    </div>
  );
}

function Composer({
  gameId,
  nickname,
  blocked,
  cooldownUntil,
  onPost,
}: {
  gameId: string;
  nickname: string;
  blocked: string | null;
  cooldownUntil: number | null;
  onPost: (post: { mediaId: string; caption: string; frame: WallFrame; keep: boolean }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [frame, setFrame] = useState<WallFrame>("polaroid");
  const [keep, setKeep] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  // Kept after a successful upload so "Try again" re-posts without re-uploading.
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const reduce = useReducedMotion();
  const now = useServerNow(cooldownUntil !== null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(next: File | undefined) {
    if (!next) {
      return;
    }
    setFile(next);
    setUploaded(null);
    setError("");
    setSent(false);
  }

  async function send() {
    if (!file) {
      return;
    }
    setError("");
    let mediaId = uploaded;
    if (!mediaId) {
      setProgress(0);
      const result = await sendWallPhoto(gameId, file, setProgress);
      setProgress(null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      mediaId = result.mediaId;
      setUploaded(mediaId);
    }
    onPost({ mediaId, caption: caption.trim(), frame, keep });
    setSent(true);
    setFile(null);
    setCaption("");
    setUploaded(null);
  }

  const cooling = cooldownUntil !== null && cooldownUntil > now;
  const busy = progress !== null;
  const characters = [...caption].length;

  return (
    <section className="wall-composer" aria-label="Send a photo to the big screen">
      <p>Your photo will appear on the big screen. The host can remove any photo.</p>
      <div className="wall-sources">
        <label>
          <span aria-hidden="true">📷</span>
          Take a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </label>
        <label>
          <span aria-hidden="true">🤳</span>
          Selfie
          <input
            type="file"
            accept="image/*"
            capture="user"
            disabled={busy}
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </label>
        <label>
          <span aria-hidden="true">🖼️</span>
          Camera roll
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </label>
      </div>
      <AnimatePresence initial={false}>
        {preview ? (
          <motion.div
            key="preview"
            className="grid gap-4"
            initial={{ opacity: 0, y: reduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -40 }}
          >
            <FramedPhoto
              src={preview}
              frame={frame}
              nickname={nickname}
              caption={caption.trim() || null}
            />
            <div className="grid gap-2">
              <label htmlFor="wall-caption" className="text-lg font-bold">
                Caption
              </label>
              <input
                id="wall-caption"
                className="min-h-12 rounded-xl border border-line bg-surface px-3"
                value={caption}
                maxLength={wallCaptionMax * 2}
                placeholder="Say something about it"
                onChange={(event) => setCaption([...event.target.value].slice(0, wallCaptionMax).join(""))}
                aria-describedby="wall-caption-count"
              />
              <p id="wall-caption-count" className="text-sm">
                {characters} of {wallCaptionMax} characters
              </p>
            </div>
            <div className="wall-chips" role="group" aria-label="Frame">
              {wallFrames.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="wall-chip"
                  aria-pressed={frame === item}
                  onClick={() => setFrame(item)}
                >
                  {frameLabels[item]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="size-6"
                checked={keep}
                onChange={(event) => setKeep(event.target.checked)}
              />
              Keep it in the results gallery
            </label>
            {busy ? (
              <div className="grid gap-1" role="status">
                <div className="wall-progress" aria-hidden="true">
                  <span style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
                </div>
                <p>Uploading, {Math.round((progress ?? 0) * 100)}%</p>
              </div>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
            <Button
              type="button"
              disabled={busy || cooling || Boolean(blocked)}
              onClick={() => void send()}
            >
              {error ? "Try again" : "Send it"}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {cooling ? (
        <p role="status">
          You can send another photo in {Math.ceil(((cooldownUntil ?? now) - now) / 1_000)}{" "}
          seconds.
        </p>
      ) : blocked && preview ? (
        <p role="status">{blocked}</p>
      ) : null}
      {sent ? (
        <motion.p
          role="status"
          className="font-bold"
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Sent! Watch your photo below.
        </motion.p>
      ) : null}
    </section>
  );
}

function Tray({
  mine,
  gameId,
  onWithdraw,
}: {
  mine: Mine[];
  gameId: string;
  onWithdraw: (postId: string) => void;
}) {
  return (
    <section className="wall-tray" aria-label="Your photos">
      <h3 className="text-lg font-bold">Your photos</h3>
      <AnimatePresence initial={false}>
        {mine.map((item) => (
          <motion.div
            key={item.postId}
            layout
            className="wall-tray-item"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {item.status === "declined" || item.status === "removed" ? (
              <span aria-hidden="true" className="text-4xl">
                🚫
              </span>
            ) : (
              <img src={`/api/rooms/${gameId}/media/${item.mediaId}`} alt="" />
            )}
            <div className="grid gap-1">
              <span className="wall-status" data-status={item.status}>
                {statusText[item.status]}
              </span>
              {item.status === "queued" && item.position ? (
                <span>
                  {item.position === 1 ? "You're next" : `${item.position - 1} ahead of you`}
                </span>
              ) : null}
              {item.reactions > 0 ? <span>{item.reactions} reactions</span> : null}
            </div>
            {item.status !== "declined" && item.status !== "removed" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onWithdraw(item.postId)}
              >
                Withdraw
              </Button>
            ) : (
              <span />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}

function ReactionBar({
  nickname,
  onReact,
}: {
  nickname: string;
  onReact: (reaction: WallReaction) => void;
}) {
  return (
    <section aria-label={`React to ${nickname}'s photo`} className="grid gap-2">
      <p className="font-bold">{nickname}'s photo is on the big screen</p>
      <div className="wall-reactions">
        {wallReactions.map((reaction) => (
          <button
            key={reaction}
            type="button"
            className="wall-reaction"
            aria-label={reactionLabels[reaction]}
            onClick={() => {
              buzz(15);
              onReact(reaction);
            }}
          >
            {reactionEmoji[reaction]}
          </button>
        ))}
      </div>
    </section>
  );
}
