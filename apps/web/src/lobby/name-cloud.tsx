import type { ComponentProps } from "react";
import type { LobbySnapshot } from "@26/shared";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";

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
    <ul className="flex max-w-full flex-wrap gap-2">
      <AnimatePresence initial={false} mode="popLayout">
        {names.map((name) => {
          const mine = reactions?.find((item) => item.playerId === name.playerId);
          const size = Math.min(maxRem, minRem + name.likes * 0.08);
          return (
            <CloudItem
              key={name.playerId}
              layout={!reduced ? "position" : false}
              initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
              transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.2, 0, 0, 1] }}
              className="flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-full bg-surface px-3 py-2"
              style={{ fontSize: `${size}rem`, color: tone(name) }}
            >
              <span className="max-w-full break-words">{name.nickname}</span>
              {onReact && name.playerId !== selfId ? (
                <>
                  <button
                    type="button"
                    className="min-h-11 rounded-full px-2 underline"
                    aria-pressed={mine?.reaction === "like"}
                    aria-label={`Like ${name.nickname}`}
                    onClick={() => onReact(name.playerId, "like")}
                  >
                    Like
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-full px-2 underline"
                    aria-pressed={mine?.reaction === "dislike"}
                    aria-label={`Dislike ${name.nickname}`}
                    onClick={() => onReact(name.playerId, "dislike")}
                  >
                    Dislike
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
