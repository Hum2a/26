import { useEffect, useRef, useState } from "react";
import type { LobbySnapshot } from "@26/shared";
import { Wordmark } from "../theme/wordmark";
import { SkinMotif } from "../theme/skin-motif";
import { LiquidGround } from "../ui/liquid-ground";
import { Button } from "../ui/primitives";
import { JoinMark } from "../lobby/join-mark";
import { NameCloud, NameReveal } from "../lobby/name-cloud";
import { StagePlay } from "../play/stage-play";
import { StageTrends } from "../play/trends";
import { Celebration } from "../anim/Celebration";
import { useThemeVoice } from "../theme/voices";
import { PhaseTransition } from "../anim/PhaseTransition";
import { kartRaceScene } from "../kart/race-scene";
import { withClientApiKey } from "../api/client-key";
import { evictMediaUrl, useCachedMediaSrc } from "../media/media-cache";
import { usePhaseCountdown } from "../live/use-phase-countdown";
import { SafeArea } from "./SafeArea";
import { StageFullscreen } from "./fullscreen";
import { StageCountdown } from "./Countdown";
import { WaitingLine } from "./WaitingLine";
import { AnimatePresence, motion } from "motion/react";

/** Long enough that a Wi-Fi blip passes unremarked; short enough to act on. */
const stageOfflineHintMs = 15_000;

/** Mounted only while the stage is offline, so each outage starts its own wait. */
function OfflineHint() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), stageOfflineHintMs);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <AnimatePresence>
      {shown ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          Still trying. Check this screen’s network.
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

export function StagePresentation({
  snapshot,
  observedAt,
  connected,
  onSetup,
}: {
  snapshot: LobbySnapshot;
  observedAt: number;
  connected: boolean;
  onSetup: () => void;
}) {
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.focus();
  }, []);
  const clock = usePhaseCountdown(snapshot, observedAt);
  const voice = useThemeVoice();
  const lobby = snapshot.phase === "lobby";
  const hidden = snapshot.stageHidden && !lobby;
  const collecting = ["collect", "vote", "predict"].includes(snapshot.phase);
  // Answer trends sit beside the reveal and the scores. A kart reveal keeps the
  // whole screen for its results; its trends wait for the scores beat.
  const trends =
    snapshot.trends &&
    (snapshot.phase === "scores" ||
      (snapshot.phase === "reveal" && snapshot.play?.question.kind !== "kart"))
      ? snapshot.trends
      : undefined;
  return (
    <SafeArea dev={false}>
      <StageFullscreen controls={false} onExit={onSetup}>
        <div className="skin-ground" aria-hidden="true">
          <LiquidGround />
          <SkinMotif />
          {/* The theme's burst, once per reveal, behind the question so it never covers it. */}
          {connected && !hidden && snapshot.phase === "reveal" && snapshot.play ? (
            <Celebration key={`:${snapshot.revealNonce}`} size="stage" />
          ) : null}
        </div>
        <main
          ref={main}
          tabIndex={-1}
          className="stage-presentation"
          aria-label="Projector presentation"
        >
          <h1 className="sr-only">26 projector</h1>
          <header className="projector-top">
            <Wordmark />
            {connected &&
            !lobby &&
            !hidden &&
            clock &&
            !(
              snapshot.play?.question.kind === "kart" && snapshot.phase === "collect"
            ) ? (
              <StageCountdown
                {...clock}
                label={
                  snapshot.paused
                    ? "Paused."
                    : snapshot.play?.question.kind === "kart" &&
                        snapshot.phase === "reveal"
                      ? "The reveal"
                      : clock.label
                }
                compact
              />
            ) : (
              <p>{lobby ? "Join the party" : "26"}</p>
            )}
          </header>
          {!connected ? (
            <div className="projector-wait" role="status">
              <h2>Reconnecting to the room.</h2>
              <p>The question will return when connected.</p>
              <OfflineHint />
            </div>
          ) : hidden ? (
            <div className="projector-wait" role="status">
              <h2>Hidden by the host.</h2>
              <p>Stay with us.</p>
            </div>
          ) : lobby ? (
            <section className="projector-lobby" aria-label="In the lobby">
              <div className="projector-invitation">
                <p>{voice.invite}</p>
                <p className="projector-code">{snapshot.joinCode}</p>
                <JoinMark code={snapshot.joinCode} />
                <p>{snapshot.players.length} players in the room</p>
              </div>
              <div className="projector-names">
                <h2>In the lobby</h2>
                {snapshot.namesReveal ? (
                  <NameReveal reveal={snapshot.namesReveal} />
                ) : null}
                {snapshot.cloud.length ? (
                  <NameCloud names={snapshot.cloud} minRem={2.5} maxRem={3.5} />
                ) : (
                  <p>Nicknames appear here after guests join.</p>
                )}
              </div>
            </section>
          ) : (
            <>
              {/* One wrapper always, so trends arriving never remount the round. */}
              <div className="projector-with-trends">
                <PhaseTransition
                  phase={snapshot.phase}
                  scene={kartRaceScene(snapshot)}
                  stage
                >
                  <StagePlay snapshot={snapshot} observedAt={observedAt} />
                </PhaseTransition>
                <AnimatePresence>
                  {trends ? (
                    <motion.div
                      key="trends"
                      className="projector-trends-slot"
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <StageTrends trends={trends} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
              {collecting && snapshot.play && snapshot.play.question.kind !== "kart" ? (
                <WaitingLine
                  count={snapshot.play.submissionCount}
                  players={snapshot.players.length}
                />
              ) : null}
              {snapshot.highlights?.length ? (
                <section className="projector-highlights" aria-label="From this room">
                  {snapshot.highlights.map((card) => (
                    <p key={card.id}>{card.stage}</p>
                  ))}
                </section>
              ) : null}
              {snapshot.media.length ? (
                <section className="projector-media" aria-label="Shared moments">
                  {snapshot.media.map((item) =>
                    item.kind === "photo" ? (
                      <StagePhoto
                        key={item.mediaId}
                        nickname={item.nickname}
                        src={withClientApiKey(
                          `/api/rooms/${snapshot.gameId}/media/${item.mediaId}`,
                        )}
                      />
                    ) : (
                      <audio
                        key={item.mediaId}
                        controls
                        preload="none"
                        aria-label={`Voice clip from ${item.nickname}`}
                        src={withClientApiKey(
                          `/api/rooms/${snapshot.gameId}/media/${item.mediaId}`,
                        )}
                      />
                    ),
                  )}
                </section>
              ) : null}
              {snapshot.draft ? (
                <p aria-live="polite">
                  {snapshot.draft.nickname} is typing: {snapshot.draft.text}
                </p>
              ) : null}
            </>
          )}
          {connected && !lobby ? (
            <footer className="projector-footer">
              <p>Join {snapshot.joinCode}</p>
              <p>{snapshot.players.length} players</p>
            </footer>
          ) : null}
          <Button
            variant="secondary"
            className="projector-setup-return"
            onClick={onSetup}
          >
            Projector setup
          </Button>
        </main>
      </StageFullscreen>
    </SafeArea>
  );
}
function StagePhoto({ nickname, src }: { nickname: string; src: string }) {
  const displaySrc = useCachedMediaSrc(src, { preload: true }) ?? src;
  const [failedSource, setFailedSource] = useState<string>();
  return failedSource === src ? (
    <p>Photo from {nickname} is unavailable.</p>
  ) : (
    <img
      alt={`Photo from ${nickname}`}
      src={displaySrc}
      onError={() => {
        if (displaySrc !== src) {
          evictMediaUrl(src);
          return;
        }
        evictMediaUrl(src);
        setFailedSource(src);
      }}
    />
  );
}
