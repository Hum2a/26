import { useCallback, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import type { AdminMedia } from "@26/shared";
import { Button } from "../ui/primitives";
import { EntryNotice } from "../ui/entry-frame";
import { MediaPreview } from "../ui/media-preview";
import { readMediaPage } from "./sections-api";
import { useSection } from "./use-section";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";

export function MediaPage() {
  const { snapshot, execute, busy, connection, command } = useAdminRoom();
  const [cursor, setCursor] = useState<string>();
  const [filter, setFilter] = useState("all");
  const mediaSignature = snapshot.media
    .map((item) => `${item.mediaId}:${item.hidden}`)
    .join(":");
  const mediaReceipt = command.scope === "media" ? command.status : "idle";
  const read = useCallback(
    () => readMediaPage(snapshot.gameId, cursor),
    [snapshot.gameId, cursor],
  );
  const page = useSection<AdminMedia>(read, mediaSignature + mediaReceipt);
  const locked = busy || connection !== "open" || command.retryable;
  const items =
    page.data?.items.filter(
      (item) =>
        filter === "all" || (filter === "hidden" ? item.hidden : item.kind === filter),
    ) ?? [];
  return (
    <section className="admin-section">
      <header className="admin-page-heading">
        <div>
          <p className="entry-eyebrow">Shared with the room</p>
          <h1>Media</h1>
        </div>
        <Button
          variant="secondary"
          disabled={page.loading}
          onClick={() => void page.refresh()}
        >
          Refresh media
        </Button>
      </header>
      <p>
        Accepted photos and voice notes. Hide removes an item from the stage and shared
        gallery.
      </p>
      <CommandFeedback scope="media" />
      <EntryNotice message={page.error} />
      <div className="admin-actions">
        <label htmlFor="media-filter">Show</label>
        <select
          id="media-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All media</option>
          <option value="photo">Photos</option>
          <option value="voice">Voice notes</option>
          <option value="hidden">Hidden</option>
        </select>
        <Link to="../health" className="entry-text-link">
          Processing problems → Health
        </Link>
      </div>
      {page.loading ? <p role="status">Checking accepted media…</p> : null}
      {page.error && page.data ? (
        <p>Showing the last successful check. Refresh before moderating.</p>
      ) : null}
      <ul className="admin-media-grid">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.mediaId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="admin-media-item"
            >
              <MediaPreview
                key={`${item.mediaId}:${item.hidden}`}
                path={`/api/admin/rooms/${snapshot.gameId}/media/${item.mediaId}`}
                kind={item.kind}
                nickname={item.nickname}
                hidden={item.hidden}
              />
              <div>
                <h2>{item.nickname}</h2>
                <p>
                  {item.kind === "photo" ? "Photo" : "Voice note"} ·{" "}
                  {item.hidden ? "Hidden" : "Accepted"}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={locked || item.hidden || page.loading || Boolean(page.error)}
                onClick={() =>
                  void execute(
                    { action: "hide-media", mediaId: item.mediaId },
                    `Hide ${item.kind} from ${item.nickname}`,
                    "media",
                  )
                }
              >
                {item.hidden
                  ? "Hidden from screens"
                  : `Hide ${item.kind} from ${item.nickname}`}
              </Button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!page.loading && !page.error && !items.length ? (
        <p>
          {page.data?.items.length
            ? "No media matches this filter on this page."
            : "No accepted media yet. New photos and voice notes will appear here."}
        </p>
      ) : null}
      <div className="admin-actions">
        {cursor ? (
          <Button
            variant="secondary"
            disabled={page.loading}
            onClick={() => setCursor(undefined)}
          >
            Newest media
          </Button>
        ) : null}
        {page.data?.nextCursor ? (
          <Button
            variant="secondary"
            disabled={page.loading}
            onClick={() => setCursor(page.data!.nextCursor!)}
          >
            Older media
          </Button>
        ) : null}
      </div>
    </section>
  );
}
