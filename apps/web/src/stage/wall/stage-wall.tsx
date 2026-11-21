import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { animate } from "motion";
import { type LobbySnapshot, type WallReaction } from "@26/shared";
import { FramedPhoto, reactionEmoji } from "../../wall/framed-photo";
import { serverOffset } from "../../live/server-clock";
import { withClientApiKey } from "../../api/client-key";
import {
  clearRoomMediaCache,
  evictMediaUrl,
  preloadMediaUrl,
  supportsBlobMediaCache,
  useCachedMediaSrc,
} from "../../media/media-cache";
import { wallPopupPose } from "./wall-popup-pose";

type Wall = NonNullable<LobbySnapshot["wall"]>;
type Now = NonNullable<Wall["now"]>;

/**
 * The photo wall on the projector. Approved photos pop up as a framed overlay
 * on top of whatever the stage is showing, then leave after the room's timer.
 * Nothing here decides what shows or for how long: that is the room.
 *
 * `onImageFailed` tells the room the photo on screen did not load, once per
 * post. Only the projector passes it, and the room accepts it only from the
 * projector's own credential for the post it is showing; it then ends that
 * photo after a short "could not be shown" card through the normal rotation.
 */
export function StageWall({
  wall,
  gameId,
  phase,
  onImageFailed,
}: {
  wall: Wall;
  gameId: string;
  phase: string;
  onImageFailed?: (postId: string) => void;
}) {
  const reported = useRef(new Set<string>());
  const nowId = wall.now?.postId;
  // A photo on its way out (its exit animation) cannot report: only the photo
  // the room says is on screen now. The room checks this again.
  const current = useRef(nowId);
  useEffect(() => {
    current.current = nowId;
  }, [nowId]);
  useEffect(() => {
    clearRoomMediaCache(gameId);
  }, [gameId]);
  const report = useCallback(
    (postId: string) => {
      if (!onImageFailed || reported.current.has(postId)) return;
      if (postId !== current.current) return;
      reported.current.add(postId);
      onImageFailed(postId);
    },
    [onImageFailed],
  );
  // Only a screen that reports failures says the wall is moving on.
  const failed = nowId && onImageFailed ? () => report(nowId) : undefined;
  const src = (mediaId: string) =>
    withClientApiKey(`/api/rooms/${gameId}/media/${mediaId}`);
  return (
    <>
      {wall.next ? <Preload src={src(wall.next.mediaId)} /> : null}
      {phase === "podium" && wall.reel && wall.reel.length > 0 && !wall.now ? (
        <Reel reel={wall.reel} src={src} />
      ) : null}
      <AnimatePresence mode="wait">
        {wall.now ? (
          <Popup
            key={wall.now.postId}
            now={wall.now}
            next={wall.next}
            src={src}
            onFailed={failed}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {wall.waiting > 0 ? (
          <motion.p
            key="waiting"
            className="wall-waiting"
            role="status"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            📸 {wall.waiting} waiting
          </motion.p>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Popup({
  now,
  next,
  src,
  onFailed,
}: {
  now: Now;
  next: Wall["next"];
  src: (mediaId: string) => string;
  onFailed?: () => void;
}) {
  const reduce = useReducedMotion();
  const pose = wallPopupPose(now.postId);
  const meter = useMotionValue(1);
  useEffect(() => {
    if (reduce) return;
    const localNow = Date.now();
    const remaining = Math.max(
      0,
      now.untilAt - (localNow + (serverOffset(localNow) ?? 0)),
    );
    meter.set(1);
    const animation = animate(meter, 0, {
      duration: remaining / 1_000,
      ease: "linear",
    });
    return () => animation.stop();
  }, [now.untilAt, now.postId, meter, reduce]);
  const restRotate = pose.rotate;
  return (
    <motion.section
      className="wall-popup-layer"
      aria-label={`Photo wall: ${now.nickname}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.18 : 0.32 }}
    >
      {next ? (
        <div
          className="wall-popup wall-popup-stack"
          data-side={pose.side}
          style={{
            [pose.side]: `${pose.x + 3}%`,
            top: `calc(${pose.y}% + 1.4rem)`,
            transform: `rotate(${pose.stackRotate}deg)`,
          }}
          aria-hidden="true"
        >
          <FramedPhoto
            src={src(next.mediaId)}
            frame="polaroid"
            nickname=""
            caption={null}
            size="popup"
          />
        </div>
      ) : null}
      <motion.div
        className="wall-popup"
        data-side={pose.side}
        style={{
          [pose.side]: `${pose.x}%`,
          top: `${pose.y}%`,
        }}
        initial={
          reduce
            ? { opacity: 0 }
            : { opacity: 0, y: 48, scale: 0.86, rotate: restRotate - 8 }
        }
        animate={
          reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, rotate: restRotate }
        }
        exit={{ opacity: 0, y: reduce ? 0 : -24, scale: reduce ? 1 : 0.94 }}
        transition={
          reduce
            ? { duration: 0.18 }
            : {
                type: "spring",
                stiffness: 220,
                damping: 18,
                opacity: { duration: 0.22 },
              }
        }
      >
        <FramedPhoto
          src={src(now.mediaId)}
          frame={now.frame}
          nickname={now.nickname}
          caption={now.caption}
          size="popup"
          onFailed={onFailed}
        />
        <motion.div
          className="wall-popup-meter"
          aria-hidden="true"
          style={{ scaleX: reduce ? 1 : meter }}
        />
      </motion.div>
      <Reactions now={now} reduce={Boolean(reduce)} />
    </motion.section>
  );
}

type Floater = { id: number; reaction: WallReaction; left: number };

/** Floating emoji for each new reaction, plus running totals. */
function Reactions({ now, reduce }: { now: Now; reduce: boolean }) {
  const [animation, setAnimation] = useState<{
    reactions: Now["reactions"] | null;
    reduce: boolean;
    nextId: number;
    floaters: Floater[];
  }>({ reactions: null, reduce, nextId: 0, floaters: [] });
  if (animation.reactions !== now.reactions || animation.reduce !== reduce) {
    const seen = new Map(
      animation.reactions?.map((item) => [item.reaction, item.count]),
    );
    let nextId = animation.nextId;
    const added: Floater[] = [];
    for (const { reaction, count } of now.reactions) {
      const before = seen.get(reaction) ?? 0;
      for (let index = 0; index < Math.min(6, count - before); index += 1) {
        const id = nextId++;
        added.push({ id, reaction, left: 8 + ((id * 37) % 85) });
      }
      seen.set(reaction, count);
    }
    setAnimation({
      reactions: now.reactions,
      reduce,
      nextId,
      floaters: reduce ? [] : [...animation.floaters, ...added].slice(-40),
    });
  }
  return (
    <>
      {reduce ? null : (
        <div className="wall-floaters" aria-hidden="true">
          <AnimatePresence>
            {animation.floaters.map((floater) => (
              <motion.span
                key={floater.id}
                className="wall-floater"
                style={{ left: `${floater.left}%` }}
                initial={{ y: 0, opacity: 1, scale: 0.6 }}
                animate={{ y: "-90vh", opacity: 0, scale: 1.3 }}
                transition={{ duration: 2.4, ease: "easeOut" }}
                onAnimationComplete={() =>
                  setAnimation((current) => ({
                    ...current,
                    floaters: current.floaters.filter((item) => item.id !== floater.id),
                  }))
                }
              >
                {reactionEmoji[floater.reaction]}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
      {now.reactions.length > 0 ? (
        <p className="wall-tally" aria-label="Reactions">
          {now.reactions.map(({ reaction, count }) => (
            <span key={reaction}>
              {reactionEmoji[reaction]} {count}
            </span>
          ))}
        </p>
      ) : null}
    </>
  );
}

/**
 * The closing filmstrip at the podium: every photo shown tonight, most loved
 * first, drifting along the bottom so the standings stay readable.
 */
function Reel({
  reel,
  src,
}: {
  reel: NonNullable<Wall["reel"]>;
  src: (mediaId: string) => string;
}) {
  const reduce = useReducedMotion();
  // Two copies make the loop seamless.
  const strip = reduce ? reel : [...reel, ...reel];
  return (
    <section className="wall-reel" aria-label="Tonight's photo wall">
      <motion.div
        className="wall-reel-track"
        animate={reduce ? undefined : { x: ["0%", "-50%"] }}
        transition={{
          duration: Math.max(20, reel.length * 4),
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {strip.map((item, index) => (
          <ReelPhoto
            key={`-${index}`}
            src={src(item.mediaId)}
            alt={index < reel.length ? `Photo from ${item.nickname}` : ""}
          />
        ))}
      </motion.div>
    </section>
  );
}

function ReelPhoto({ src, alt }: { src: string; alt: string }) {
  const displaySrc = useCachedMediaSrc(src, { preload: true }) ?? src;
  return (
    <img
      src={displaySrc}
      alt={alt}
      className="wall-reel-photo"
      onError={() => {
        if (displaySrc !== src) evictMediaUrl(src);
      }}
    />
  );
}

/** Loads the next photo in the background so it never appears half-drawn. */
function Preload({ src }: { src: string }) {
  useEffect(() => {
    let cancelled = false;
    const canCache = supportsBlobMediaCache();
    if (canCache) {
      void preloadMediaUrl(src).then((blobUrl) => {
        if (cancelled || !blobUrl) return;
        const decoded = new Image();
        decoded.src = blobUrl;
      });
    }
    const image = new Image();
    if (
      !canCache ||
      typeof HTMLImageElement === "undefined" ||
      !(image instanceof HTMLImageElement)
    ) {
      image.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, [src]);
  return null;
}
