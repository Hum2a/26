import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  analyseTrends,
  pickStageCards,
  publicTrendCard,
  selfTrendLines,
  type TrendControl,
} from "@26/shared";
import { Button } from "../ui/primitives";
import { PhoneTrends, StageTrends, TrendCardView } from "../play/trends";
import { useAdminRoom } from "./room-provider";
import { CommandFeedback } from "./command-feedback";
import { rehearsalTrendInput, trendScenarios, type TrendScenario } from "./trend-rehearsal-data";

const changeCopy: Record<TrendControl["history"][number]["change"], string> = {
  "stage-shown": "showed trends on the big screen",
  "stage-hidden": "hid trends on the big screen",
  "phones-shown": "showed trends on phones",
  "phones-hidden": "hid trends on phones",
  "card-hidden": "hid a card",
  "card-restored": "restored a card",
};

/**
 * Answer trends for the host: both switches, every candidate card for the
 * question just revealed (with what is on the big screen), earlier questions,
 * and a rehearsal that runs the real engine and components on stand-ins.
 */
export function TrendsPanel() {
  const { snapshot, execute, busy, connection, command } = useAdminRoom();
  const locked = busy || connection !== "open" || command.retryable;
  const control = snapshot.trendControl;
  const stageHidden = control?.stage === "hidden";
  const phonesHidden = control?.phones === "hidden";
  const current = control?.current ?? null;

  return (
    <section className="admin-task-section" aria-label="Answer trends">
      <div className="admin-page-heading">
        <h2>Answer trends</h2>
        <span className="admin-badge" data-tone={stageHidden ? "warn" : "ok"}>
          <span
            className="admin-status-dot"
            data-tone={stageHidden ? "warn" : "ok"}
            aria-hidden="true"
          />
          {stageHidden ? "Off the big screen" : "On the big screen"}
        </span>
      </div>
      <p>
        After each reveal the projector rotates up to six cards on how groups answered:
        iPhone against Android, dark mode, the fastest quarter, the leaders, the trolls and
        more. Phones show each guest how they compared. Device cards never name anyone.
      </p>
      <CommandFeedback scope="analytics" />

      <div className="admin-card-grid">
        <section className="admin-card" aria-label="Trend switches">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Switches</h3>
          </div>
          <div className="admin-card-body grid gap-2">
            <Button
              variant="secondary"
              disabled={locked || !control}
              onClick={() =>
                void execute(
                  { action: stageHidden ? "trends-stage-shown" : "trends-stage-hidden" },
                  stageHidden ? "Show trends on the big screen" : "Hide trends on the big screen",
                  "analytics",
                )
              }
            >
              {stageHidden ? "Show trends on the big screen" : "Hide trends on the big screen"}
            </Button>
            <Button
              variant="secondary"
              disabled={locked || !control}
              onClick={() =>
                void execute(
                  { action: phonesHidden ? "trends-phones-shown" : "trends-phones-hidden" },
                  phonesHidden ? "Show trends on phones" : "Hide trends on phones",
                  "analytics",
                )
              }
            >
              {phonesHidden ? "Show trends on phones" : "Hide trends on phones"}
            </Button>
            {control?.history.length ? (
              <ol aria-label="Trend switch history" className="admin-data-list">
                <AnimatePresence initial={false}>
                  {control.history.map((entry, index) => (
                    <motion.li
                      key={`${entry.atMs}:${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="admin-data-row"
                    >
                      <span>
                        Host {changeCopy[entry.change]} ·{" "}
                        {new Date(entry.atMs).toLocaleTimeString("en-GB")}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            ) : (
              <p className="text-sm text-muted">No changes yet. Both are on by default.</p>
            )}
          </div>
        </section>
      </div>

      <section className="admin-card" aria-label="Trends for this question">
        <div className="admin-card-header">
          <h3 className="admin-card-title">This question</h3>
          {current ? (
            <span className="admin-mono-tag">
              {current.responses} answers · {current.classified} with a known device
            </span>
          ) : null}
        </div>
        <div className="admin-card-body">
          {current ? (
            <>
              <p>{current.prompt}</p>
              {current.cards.length === 0 ? (
                <p>No trends stood out this time. The big screen shows nothing extra.</p>
              ) : (
                <ul className="admin-trend-cards" aria-label="Candidate cards">
                  <AnimatePresence initial={false}>
                    {current.cards.map((card) => (
                      <motion.li
                        key={card.id}
                        layout="position"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        data-hidden={card.hidden || undefined}
                        className="admin-card"
                      >
                        <div className="admin-card-header">
                          <span className="admin-badge" data-tone={card.onStage ? "ok" : "muted"}>
                            {card.hidden ? "Hidden" : card.onStage ? "On the big screen" : "Standby"}
                          </span>
                          <span className="admin-mono-tag">score {Math.round(card.score)}</span>
                        </div>
                        <div className="admin-card-body">
                          <TrendCardView card={card} size="compact" />
                          <Button
                            variant="secondary"
                            disabled={locked}
                            onClick={() =>
                              void execute(
                                {
                                  action: card.hidden ? "trends-card-restore" : "trends-card-hide",
                                  trendCardId: card.id,
                                },
                                card.hidden ? "Restore trend card" : "Hide trend card",
                                "analytics",
                              )
                            }
                          >
                            {card.hidden ? "Restore card" : "Hide card"}
                          </Button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </>
          ) : (
            <p>
              Trends appear here when a question is revealed, with every candidate card and
              which ones the big screen is showing.
            </p>
          )}
        </div>
      </section>

      <section className="admin-card" aria-label="Earlier questions">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Earlier questions</h3>
        </div>
        <div className="admin-card-body">
          {control?.recent.length ? (
            <ol className="admin-data-list">
              {control.recent.map((row) => (
                <li key={row.questionId} className="admin-data-row grid gap-1">
                  <span className="font-bold">
                    {row.prompt} <span className="admin-mono-tag">{row.responses} answers</span>
                  </span>
                  {row.headlines.length ? (
                    <span className="text-muted">{row.headlines.join(" · ")}</span>
                  ) : (
                    <span className="text-muted">No trends stood out.</span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>Nothing revealed yet in this room.</p>
          )}
        </div>
      </section>

      <TrendsRehearsal />
    </section>
  );
}

/**
 * The real engine and the real projector and phone components on stand-in
 * players. Isolated: no room command, no socket, no score.
 */
export function TrendsRehearsal() {
  const [scenario, setScenario] = useState<TrendScenario>("choice");
  const [seed, setSeed] = useState(26);
  const preview = useMemo(() => {
    const analysis = analyseTrends(rehearsalTrendInput(scenario, seed));
    const stage = pickStageCards(analysis);
    const first = analysis.rows[0]?.player.playerId;
    const lines = first ? selfTrendLines(analysis, first, stage) : null;
    return { analysis, stage, lines };
  }, [scenario, seed]);
  return (
    <section className="admin-card" aria-label="Trend rehearsal">
      <div className="admin-card-header">
        <h3 className="admin-card-title">Rehearse with stand-ins</h3>
        <span className="admin-badge" data-tone="muted">
          24 stand-in players · made-up answers
        </span>
      </div>
      <div className="admin-card-body grid gap-3">
        <div className="flex flex-wrap gap-2">
          {trendScenarios.map((item) => (
            <Button
              key={item.id}
              variant={item.id === scenario ? "primary" : "secondary"}
              aria-pressed={item.id === scenario}
              onClick={() => setScenario(item.id)}
            >
              {item.label}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => setSeed((value) => value + 1)}>
            Shuffle stand-ins
          </Button>
        </div>
        <p className="text-sm text-muted">
          {preview.analysis.cards.length} candidate cards; the big screen would rotate{" "}
          {preview.stage.length}. Stand-in 1’s phone is shown below.
        </p>
        <div className="admin-trend-stage-preview stage-presentation">
          {preview.stage.length > 0 ? (
            <StageTrends
              trends={{
                questionId: `${preview.analysis.questionId}:${seed}`,
                responses: preview.analysis.responses,
                cards: preview.stage.map(publicTrendCard),
              }}
            />
          ) : (
            <p>No trends stood out for these stand-ins. Shuffle them.</p>
          )}
        </div>
        {preview.lines ? (
          <div className="max-w-sm">
            <PhoneTrends
              trends={{ questionId: preview.analysis.questionId, lines: preview.lines }}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
