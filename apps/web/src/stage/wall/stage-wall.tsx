import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { animate } from "motion";
import { wallQuestionPhases, type LobbySnapshot, type WallReaction } from "@26/shared";
import { FramedPhoto, reactionEmoji } from "../../wall/framed-photo";
import { serverOffset } from "../../live/server-clock";
import { withClientApiKey } from "../../api/client-key";

type Wall = NonNullable<LobbySnapshot["wall"]>;
type Now = NonNullable<Wall["now"]>;

/**
 * The photo wall on the projector. In a break the photo takes the screen
 * (spotlight); with corner placement during a question it sits small in a
 * corner. Nothing here decides what shows or for how long: that is the room.
 */
export function StageWall({
  wall,
  gameId,
  phase,
}: {
  wall: Wall;
  gameId: string;
  phase: string;
}) {
  const src = (mediaId: string) =>
    withClientApiKey(`/api/rooms/${gameId}/media/${mediaId}`);
  const inQuestion = (wallQuestionPhases as readonly string[]).includes(phase);
  const corner = Boolean(wall.now) && inQuestion && wall.placement === "corner";
  return (
    <>
      {wall.next ? <Preload src={src(wall.next.mediaId)} /> : null}
      {phase === "podium" && wall.reel && wall.reel.length > 0 && !wall.now ? (
        <Reel reel={wall.reel} src={src} />
      ) : null}
      <AnimatePresence mode="wait">
        {wall.now && !corner ? (
          <Spotlight key={wall.now.postId} now={wall.now} src={src(wall.now.mediaId)} />
        ) : null}
        {wall.now && corner ? (
          <motion.div
            key={`corner-${wall.now.postId}`}
            className="wall-corner"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <FramedPhoto
              src={src(wall.now.mediaId)}
              frame={wall.now.frame}
              nickname={wall.now.nickname}
              caption={wall.now.caption}
              size="corner"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {wall.waiting > 0 && (!wall.now || corner) ? (
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

function Spotlight({ now, src }: { now: Now; src: string }) {
  const reduce = useReducedMotion();
  const meter = useMotionValue(1);
  useEffect(() => {
    if (reduce) return;
    const localNow = Date.now();
    const remaining = Math.max(
      0,
      now.untilAt - (localNow + (serverOffset(localNow) ?? 0)),
    );
    const animation = animate(meter, 0, {
      duration: remaining / 1_000,
      ease: "linear",
    });
    return () => animation.stop();
  }, [now.untilAt, meter, reduce]);
  return (
    <motion.section
      className="wall-stage"
      aria-label={`Photo wall: ${now.nickname}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        initial={
          reduce
            ? { opacity: 0 }
            : {
                opacity: 0,
                y: -80,
                rotate: -8,
                scale: 1.08,
                filter: "brightness(3) saturate(0)",
              }
        }
        animate={
          reduce
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: 0,
                rotate: [-8, 3, -1.5, 0],
                scale: 1,
                filter: "brightness(1) saturate(1)",
              }
        }
        transition={
          reduce
            ? { duration: 0.3 }
            : { type: "spring", stiffness: 140, damping: 14, filter: { duration: 1.6 } }
        }
      >
        <FramedPhoto
          src={src}
          frame={now.frame}
          nickname={now.nickname}
          caption={now.caption}
          size="stage"
        />
      </motion.div>
      <Reactions now={now} reduce={Boolean(reduce)} />
      <motion.div
        className="wall-stage-meter"
        aria-hidden="true"
        style={{ scaleX: reduce ? 1 : meter }}
      />
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
          <img
            key={`-${index}`}
            src={src(item.mediaId)}
            alt={index < reel.length ? `Photo from ${item.nickname}` : ""}
            className="wall-reel-photo"
          />
        ))}
      </motion.div>
    </section>
  );
}

/** Loads the next photo in the background so it never appears half-drawn. */
function Preload({ src }: { src: string }) {
  useEffect(() => {
    const image = new Image();
    image.src = src;
  }, [src]);
  return null;
}
