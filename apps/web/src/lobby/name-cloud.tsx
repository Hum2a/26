import type { LobbySnapshot } from "@26/shared";

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
  const settle = names.length >= 24;
  return (
    <ul className="flex max-w-full flex-wrap gap-2">
      {names.map((name) => {
        const mine = reactions?.find((item) => item.playerId === name.playerId);
        const size = Math.min(maxRem, minRem + name.likes * 0.08);
        return (
          <li
            key={name.playerId}
            className={`flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-full bg-surface px-3 py-2 ${settle ? "" : "motion-rise"}`}
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
          </li>
        );
      })}
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
