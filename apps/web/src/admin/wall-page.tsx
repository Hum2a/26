import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { wallFrames, type LobbySnapshot } from "@26/shared";
import { Button, Disclosure } from "../ui/primitives";
import { FramedPhoto, frameLabels } from "../wall/framed-photo";
import type { PlayIntent } from "../live/room-api";
import { CommandFeedback } from "./command-feedback";
import { useAdminRoom, type AdminCommand } from "./room-provider";

type Wall = NonNullable<LobbySnapshot["wall"]>;
type Queued = NonNullable<Wall["queue"]>[number];

const showOptions = [4, 6, 8, 10, 12, 15, 20];

/** Commands for the photo wall, shared by this page and the live desk panel. */
export function useWallCommands() {
  const { execute, busy, connection, command } = useAdminRoom();
  const locked = busy || connection !== "open" || command.retryable;
  const run = (value: AdminCommand, label: string) => {
    if (!locked) {
      void execute(value, label, "wall");
    }
  };
  return {
    locked,
    approve: (post: { postId: string; nickname: string }) =>
      run({ action: "wall-approve", postId: post.postId }, `Approve ${post.nickname}'s photo`),
    decline: (post: { postId: string; nickname: string }) =>
      run({ action: "wall-decline", postId: post.postId }, `Decline ${post.nickname}'s photo`),
    pull: (post: { postId: string; nickname: string }) =>
      run({ action: "wall-pull", postId: post.postId }, `Pull ${post.nickname}'s photo`),
    skip: () => run({ action: "wall-skip" }, "Skip to the next photo"),
    next: () => run({ action: "wall-next" }, "Show the next photo now"),
    settings: (wallSettings: NonNullable<PlayIntent["wallSettings"]>) =>
      run({ action: "wall-settings", wallSettings }, "Save photo wall settings"),
    mute: (playerId: string, nickname: string, muted: boolean) =>
      run(
        { action: muted ? "wall-mute" : "wall-unmute", playerId },
        `${muted ? "Mute" : "Unmute"} ${nickname} on the photo wall`,
      ),
  };
}

/**
 * The host's photo wall page: approvals (A approves and D declines the first
 * waiting photo), what is on screen, the queue, settings, muted guests and
 * everything shown so far.
 */
export function WallPage() {
  const { snapshot, gameId } = useAdminRoomWithId();
  const commands = useWallCommands();
  const wall = snapshot.wall;
  const pending = wall?.queue?.filter((item) => item.status === "pending") ?? [];
  const queued = wall?.queue?.filter((item) => item.status === "queued") ?? [];
  const first = pending[0];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!first || target?.closest("input, textarea, select, [contenteditable]")) {
        return;
      }
      if (event.key === "a" || event.key === "A") {
        commands.approve(first);
      } else if (event.key === "d" || event.key === "D") {
        commands.decline(first);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [first, commands]);

  if (!wall) {
    return <p role="status">Loading the photo wall…</p>;
  }
  const src = (mediaId: string) => `/api/rooms/${gameId}/media/${mediaId}`;
  const muted = new Set(wall.muted ?? []);

  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">This room</p>
          <h1>Photo wall</h1>
        </div>
      </header>
      <p>
        Guests send photos from their phones. {wall.settings?.moderation === "approve"
          ? "You approve each one before it reaches the big screen."
          : "Photos go straight to the big screen. Pull anything you don't want."}{" "}
        Press <kbd>A</kbd> to approve and <kbd>D</kbd> to decline the first waiting photo.
      </p>
      <CommandFeedback scope="wall" />

      <section className="admin-task-section" aria-label="On screen now">
        <h2>On screen now</h2>
        {wall.now ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_1fr] items-start">
            <FramedPhoto
              src={src(wall.now.mediaId)}
              frame={wall.now.frame}
              nickname={wall.now.nickname}
              caption={wall.now.caption}
              size="thumb"
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={commands.locked} onClick={() => wall.now && commands.pull(wall.now)}>
                Pull it
              </Button>
              <Button variant="secondary" disabled={commands.locked} onClick={commands.skip}>
                Skip
              </Button>
            </div>
          </div>
        ) : (
          <p>Nothing on the wall right now.</p>
        )}
        <Button
          variant="secondary"
          disabled={commands.locked || queued.length === 0}
          onClick={commands.next}
        >
          Show next now{queued.length > 0 ? ` (${queued.length} in the queue)` : ""}
        </Button>
      </section>

      <section className="admin-task-section" aria-label="Waiting for approval">
        <h2>Waiting for approval ({pending.length})</h2>
        {pending.length === 0 ? <p>Nothing waiting.</p> : null}
        <div className="admin-card-grid">
          <AnimatePresence initial={false}>
            {pending.map((item) => (
              <PendingCard
                key={item.postId}
                item={item}
                src={src(item.mediaId)}
                locked={commands.locked}
                onApprove={() => commands.approve(item)}
                onDecline={() => commands.decline(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      </section>

      <section className="admin-task-section" aria-label="Queue">
        <h2>Queue ({queued.length})</h2>
        {queued.length === 0 ? <p>The queue is empty.</p> : null}
        <ol className="grid gap-2">
          {queued.map((item) => (
            <li key={item.postId} className="flex flex-wrap items-center gap-3">
              <span className="font-bold">{item.position}.</span>
              <span>
                {item.nickname}
                {item.caption ? ` · ${item.caption}` : ""}
              </span>
              <Button variant="secondary" disabled={commands.locked} onClick={() => commands.decline(item)}>
                Remove
              </Button>
            </li>
          ))}
        </ol>
      </section>

      <WallSettings wall={wall} locked={commands.locked} onChange={commands.settings} />

      <Disclosure title={`Guests (${muted.size} muted)`}>
        <ul className="grid gap-2">
          {snapshot.players.map((player) => {
            const isMuted = muted.has(player.playerId);
            return (
              <li key={player.playerId} className="flex flex-wrap items-center gap-3">
                <span>{player.nickname}</span>
                <Button
                  variant="secondary"
                  disabled={commands.locked}
                  onClick={() => commands.mute(player.playerId, player.nickname, !isMuted)}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </Button>
              </li>
            );
          })}
        </ul>
      </Disclosure>

      <Disclosure title={`Shown so far (${wall.recent?.length ?? 0})`}>
        <ul className="admin-card-grid">
          {(wall.recent ?? []).map((item) => (
            <li key={item.postId} className="grid gap-2">
              {item.status === "shown" ? (
                <FramedPhoto
                  src={src(item.mediaId)}
                  frame={item.frame}
                  nickname={item.nickname}
                  caption={item.caption}
                  size="thumb"
                />
              ) : (
                <p>
                  {item.nickname} · {item.status === "declined" ? "declined" : "removed"}
                </p>
              )}
              {item.status === "shown" ? (
                <div className="flex items-center gap-3">
                  <span>{item.reactions} reactions</span>
                  <Button variant="secondary" disabled={commands.locked} onClick={() => commands.pull(item)}>
                    Hide everywhere
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Disclosure>

      <Disclosure title="Rehearse: preview every frame">
        <p>How a photo looks on the big screen in each frame, using a sample picture.</p>
        <ul className="admin-card-grid">
          {wallFrames.map((frame) => (
            <li key={frame} className="grid gap-1">
              <span className="font-bold">{frameLabels[frame]}</span>
              <FramedPhoto
                src={samplePhoto}
                frame={frame}
                nickname="Sample guest"
                caption="A sample caption"
                size="thumb"
              />
            </li>
          ))}
        </ul>
      </Disclosure>
    </section>
  );
}

/** A picture already shipped with the questions, used only for frame previews. */
const samplePhoto = "/assets/questions/favourite-pokemon/mudkip.png";

function PendingCard({
  item,
  src,
  locked,
  onApprove,
  onDecline,
}: {
  item: Queued;
  src: string;
  locked: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  return (
    <motion.article
      layout
      className="grid gap-3 rounded-3xl border border-line bg-surface p-3"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      aria-label={`${item.nickname}'s photo`}
    >
      <FramedPhoto
        src={src}
        frame={item.frame}
        nickname={item.nickname}
        caption={item.caption}
        size="thumb"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={locked} onClick={onApprove}>
          Approve
        </Button>
        <Button variant="secondary" disabled={locked} onClick={onDecline}>
          Decline
        </Button>
      </div>
    </motion.article>
  );
}

function WallSettings({
  wall,
  locked,
  onChange,
}: {
  wall: Wall;
  locked: boolean;
  onChange: ReturnType<typeof useWallCommands>["settings"];
}) {
  const settings = wall.settings;
  if (!settings) {
    return null;
  }
  return (
    <section className="admin-task-section" aria-label="Photo wall settings">
      <h2>Settings</h2>
      <label className="flex items-center gap-3 font-bold">
        <input
          type="checkbox"
          role="switch"
          className="size-6"
          checked={wall.enabled}
          disabled={locked}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />
        Photo wall {wall.enabled ? "on" : "off"}
      </label>
      <fieldset className="grid gap-2" disabled={locked}>
        <legend className="font-bold">Moderation</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="wall-moderation"
            checked={settings.moderation === "approve"}
            onChange={() => onChange({ moderation: "approve" })}
          />
          Approve each photo first
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="wall-moderation"
            checked={settings.moderation === "direct"}
            onChange={() => onChange({ moderation: "direct" })}
          />
          Straight to the big screen
        </label>
      </fieldset>
      <fieldset className="grid gap-2" disabled={locked}>
        <legend className="font-bold">When photos show</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="wall-placement"
            checked={wall.placement === "breaks"}
            onChange={() => onChange({ placement: "breaks" })}
          />
          In breaks only
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="wall-placement"
            checked={wall.placement === "corner"}
            onChange={() => onChange({ placement: "corner" })}
          />
          Also in a corner during questions
        </label>
      </fieldset>
      <label className="grid gap-1">
        <span className="font-bold">Each photo shows for</span>
        <select
          className="min-h-12 rounded-xl border border-line bg-surface px-3"
          value={settings.showMs / 1_000}
          disabled={locked}
          onChange={(event) => onChange({ showMs: Number(event.target.value) * 1_000 })}
        >
          {showOptions.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} seconds
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="size-6"
          checked={settings.captions}
          disabled={locked}
          onChange={(event) => onChange({ captions: event.target.checked })}
        />
        Show captions on the big screen
      </label>
    </section>
  );
}

/**
 * A small panel for the live desk: the waiting count, the first waiting photo
 * with Approve and Decline, and Pull it for the photo on screen.
 */
export function WallQuickPanel() {
  const { snapshot, gameId } = useAdminRoomWithId();
  const commands = useWallCommands();
  const wall = snapshot.wall;
  if (!wall) {
    return null;
  }
  const first = wall.queue?.find((item) => item.status === "pending");
  const pendingCount = wall.queue?.filter((item) => item.status === "pending").length ?? 0;
  return (
    <section className="admin-task-section" aria-label="Photo wall">
      <h2>
        Photo wall · {pendingCount} waiting · {wall.waiting} queued
      </h2>
      {first ? (
        <div className="flex flex-wrap items-center gap-3">
          <img
            src={`/api/rooms/${gameId}/media/${first.mediaId}`}
            alt={`${first.nickname}'s photo`}
            className="h-20 w-20 rounded-xl object-cover"
          />
          <span>{first.nickname}</span>
          <Button disabled={commands.locked} onClick={() => commands.approve(first)}>
            Approve
          </Button>
          <Button variant="secondary" disabled={commands.locked} onClick={() => commands.decline(first)}>
            Decline
          </Button>
        </div>
      ) : null}
      {wall.now ? (
        <div className="flex flex-wrap items-center gap-3">
          <span>On screen: {wall.now.nickname}</span>
          <Button variant="secondary" disabled={commands.locked} onClick={() => wall.now && commands.pull(wall.now)}>
            Pull it
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function useAdminRoomWithId() {
  const room = useAdminRoom();
  return { ...room, gameId: room.snapshot.gameId };
}
