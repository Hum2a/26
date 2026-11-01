import { motion, useReducedMotion } from "motion/react";
import type { PublicResults } from "@26/shared";
import { MediaPreview } from "../ui/media-preview";
import { FunFactReport } from "../play/fun-fact";
import { Scoreboard } from "../ui/scoreboard";
type Standings = NonNullable<PublicResults["standings"]>;
export function StandingsList({ standings }: { standings: Standings }) {
  return standings.length ? (
    <Scoreboard
      title="Every point counted"
      label="Final standings"
      entries={standings.map((row) => ({
        id: row.nickname,
        name: row.nickname,
        place: row.position,
        points: row.points,
      }))}
    />
  ) : (
    <p>No guest standings were stored for this game.</p>
  );
}
export function ResultsReport({
  gameId,
  published,
}: {
  gameId: string;
  published: PublicResults;
}) {
  const standings = published.standings ?? [];
  const reduced = useReducedMotion();
  return (
    <>
      <section className="results-podium" aria-label="Podium">
        {standings.slice(0, 3).map((row, index) => (
          <motion.article
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0.12 : 0.35,
              delay: reduced ? 0 : index * 0.07,
              ease: [0.2, 0, 0, 1],
            }}
            key={index}
            className={`results-podium-place results-podium-place-${row.position}`}
          >
            <p className="entry-eyebrow">Position {row.position}</p>
            <h2>{row.nickname}</h2>
            <p className="results-podium-points">
              {row.points}
              <small>points</small>
            </p>
          </motion.article>
        ))}
      </section>
      <div className="results-report-grid">
        <section>
          <h2>Standings</h2>
          <StandingsList standings={standings} />
        </section>
        <FunFactReport cards={published.funFacts ?? []} />
        <section>
          <h2>Highlights</h2>
          {published.highlights?.length ? (
            <ul className="results-highlights">
              {published.highlights.map((card) => (
                <li key={card.id}>
                  <p className="entry-eyebrow">
                    {card.illustrative ? "Illustrative" : "From this room"}
                  </p>
                  {card.results}
                </li>
              ))}
            </ul>
          ) : (
            <p>This room has no comparison cards.</p>
          )}
        </section>
      </div>
      <section className="results-gallery">
        <header>
          <p className="entry-eyebrow">From the night</p>
          <h2>Shared moments</h2>
          <p>{published.galleryNote}</p>
        </header>
        {published.gallery?.length ? (
          <ul className="admin-media-grid">
            {published.gallery.map((item) => (
              <li key={item.mediaId}>
                <MediaPreview
                  path={`/api/rooms/${gameId}/gallery/${item.mediaId}`}
                  kind={item.kind}
                  nickname={item.nickname}
                />
                <p>{item.attribution}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No shared media was kept.</p>
        )}
      </section>
      {published.retentionNote ? (
        <p className="results-retention">{published.retentionNote}</p>
      ) : null}
    </>
  );
}
