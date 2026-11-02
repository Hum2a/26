import type { ComponentProps, CSSProperties } from "react";
import type { LobbySnapshot } from "@26/shared";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { PlayerAvatar, looksLikeBot, playerHue } from "../ui/player-avatar";
import "./name-cloud.css";

type CloudName = LobbySnapshot["cloud"][number];

export function NameCloud({
  names,
  selfId,
  reactions,
  onReact,
  minRem,
  maxRem = 1.8,
}: {
  names: CloudName[];
  selfId?: string;
  reactions?: { playerId: string; reaction: "like" | "dislike" }[];
  onReact?: (playerId: string, reaction: "like" | "dislike") => void;
  minRem: number;
  maxRem?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <ul className="name-cloud" data-count={names.length}>
      <AnimatePresence initial={false} mode="popLayout">
        {names.map((name) => {
          const mine = reactions?.find((item) => item.playerId === name.playerId);
          const size = Math.min(maxRem, minRem + name.likes * 0.08);
          const seed = playerHue(name.playerId + name.nickname);
          return (
            <CloudItem
              key={name.playerId}
              layout={!reduced ? "position" : false}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.4, y: reduced ? 0 : 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
              transition={
                reduced
                  ? { duration: 0.12 }
                  : { type: "spring", stiffness: 380, damping: 22 }
              }
              className="name-bubble glass"
              data-self={name.playerId === selfId || undefined}
              data-bot={looksLikeBot(name.nickname) || undefined}
              data-hue={playerHue(name.playerId)}
              style={
                {
                  fontSize: `${size}rem`,
                  "--name-tone": tone(name),
                  "--float-delay": `${-seed * 1.3}s`,
                  "--float-time": `${5.5 + seed * 0.7}s`,
                  "--float-tilt": `${seed % 2 === 0 ? -1 : 1}deg`,
                } as CSSProperties
              }
            >
              <PlayerAvatar
                playerId={name.playerId}
                nickname={name.nickname}
                size="sm"
              />
              <span className="name-bubble-name">{name.nickname}</span>
              {onReact && name.playerId !== selfId ? (
                <>
                  <button
                    type="button"
                    className="name-bubble-react"
                    aria-pressed={mine?.reaction === "like"}
                    aria-label={`Like ${name.nickname}`}
                    onClick={() => onReact(name.playerId, "like")}
                  >
                    <span aria-hidden="true">👍</span>
                  </button>
                  <button
                    type="button"
                    className="name-bubble-react"
                    aria-pressed={mine?.reaction === "dislike"}
                    aria-label={`Dislike ${name.nickname}`}
                    onClick={() => onReact(name.playerId, "dislike")}
                  >
                    <span aria-hidden="true">👎</span>
                  </button>
                </>
              ) : null}
            </CloudItem>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

export function NameReveal({
  reveal,
}: {
  reveal: NonNullable<LobbySnapshot["namesReveal"]>;
}) {
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-2xl font-bold">Most liked</p>
        {reveal.liked.length > 0 ? (
          <ul>
            {reveal.liked.map((row) => (
              <li key={`like-${row.nickname}`}>
                {row.nickname} · {row.count}
              </li>
            ))}
          </ul>
        ) : (
          <p>No likes yet.</p>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold">Most disliked</p>
        {reveal.disliked.length > 0 ? (
          <ul>
            {reveal.disliked.map((row) => (
              <li key={`dislike-${row.nickname}`}>
                {row.nickname} · {row.count}
              </li>
            ))}
          </ul>
        ) : (
          <p>No dislikes yet.</p>
        )}
      </div>
      <p>This opening beat does not change the scores.</p>
    </div>
  );
}

function tone(name: CloudName): string {
  if (name.dislikes > name.likes) {
    return "var(--color-accent)";
  }
  if (name.likes > 0) {
    return "var(--color-highlight)";
  }
  return "var(--color-muted)";
}

function CloudItem(props: ComponentProps<typeof motion.li>) {
  const present = useIsPresent();
  return <motion.li {...props} inert={!present} aria-hidden={!present || undefined} />;
}
