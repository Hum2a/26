import { motion, useReducedMotion } from "motion/react";
import type { LobbySnapshot, KartInput } from "@26/shared";
import { KartDriverView } from "./KartDriverView";
import { TouchController } from "./TouchController";
import { useKartSocket } from "./useKartSocket";
import { Button } from "../ui/primitives";

export function GuestKart({
  snapshot,
  connected = true,
  onInput,
  onRecover,
  recoveryPending = false,
  recoveryNotice = "",
}: {
  snapshot: LobbySnapshot;
  connected?: boolean;
  onInput?: (input: KartInput) => void;
  onRecover?: (raceId: string) => void;
  recoveryPending?: boolean;
  recoveryNotice?: string;
}) {
  const reduced = useReducedMotion();
  const race = snapshot.play?.kart;
  const self = race?.participants.find((d) => d.playerId === race.selfPlayerId);
  const place = race?.leaderboard.find((d) => d.playerId === self?.playerId)?.place;
  const complete = self && self.status !== "RACING";
  const open =
    snapshot.phase === "collect" && !snapshot.paused && !snapshot.held && connected;
  const change = useKartSocket(race, open && !recoveryPending, onInput);
  const rehearsal = !onInput && !race;
  const instruction = !connected
    ? "Connection lost — controls released"
    : snapshot.paused || snapshot.held
      ? "Paused — controls released"
      : race?.ended || complete
        ? "Race complete — watch the stage"
        : snapshot.phase !== "collect" && !rehearsal
          ? "Your driving view opens here. Wait for the race to start."
          : race && !self
            ? "You’re watching this race. Join the next round."
            : "Drive on this screen. Hold A and steer clockwise.";
  return (
    <section className="kart-phone" aria-label="Sprint controller">
      <header className="kart-phone-heading">
        <p className="kart-eyebrow">ONE LAP · 45 SECONDS</p>
        <h1 className="phone-prompt">
          {complete
            ? self.status === "FINISHED"
              ? "Lap complete"
              : "Time’s up"
            : self
              ? `Kart ${self.number}`
              : "Start your engines"}
        </h1>
      </header>
      <p role="status">
        {rehearsal ? "Controller rehearsal — no race is running." : instruction}
      </p>
      {self ? (
        <div className="kart-phone-hud">
          <div>
            <strong>
              {self.status === "FINISHED"
                ? `${(self.lapTimeMs! / 1000).toFixed(2)}s`
                : `${self.checkpoint} / 8 gates`}
            </strong>
            <p>
              {complete
                ? self.status === "FINISHED"
                  ? `Position ${place ?? "—"}`
                  : `${Math.round(self.progress * 100)}% of the lap`
                : `${Math.max(0, ((race?.timeLimitMs ?? 45_000) - (race?.elapsedMs ?? 0)) / 1000).toFixed(1)}s left`}
            </p>
            <p>
              {complete
                ? "Your result is saved by the server."
                : `Position ${place ?? "—"}${race?.participantCount === undefined ? "" : ` of ${race.participantCount}`}`}
            </p>
          </div>
        </div>
      ) : null}
      {race && self && !complete ? (
        <KartDriverView race={race} reducedMotion={Boolean(reduced) || !open} />
      ) : null}
      {self && !complete ? (
        <div className="kart-telemetry" aria-label="Driving feedback">
          <p className="kart-driving-state" role="status">
            {!open
              ? "Controls released"
              : self.wrongWay
                ? "Wrong way — turn around"
                : self.boostRemainingMs > 0
                  ? "BOOST! Keep holding A"
                  : self.driftCharge >= 1
                    ? "Drift ready — release R!"
                    : self.drifting
                      ? "Charging drift…"
                      : "Hold A · steer gently to the right"}
          </p>
          <div
            className="kart-drift-meter"
            role="progressbar"
            aria-label="Drift charge"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(self.driftCharge * 100)}
            aria-valuetext={
              self.driftCharge >= 1
                ? "Charged — release R to boost"
                : `${Math.round(self.driftCharge * 100)} per cent`
            }
          >
            <motion.span
              animate={{ scaleX: self.driftCharge }}
              style={{ transformOrigin: "left" }}
              transition={{ duration: reduced ? 0.1 : 0.18, ease: "easeOut" }}
            />
          </div>
          <div className="kart-telemetry-labels">
            <span>R: hold to charge, release to boost</span>
            <span>
              {Math.round(Math.min(1, Math.abs(self.speed) / 14) * 100)}% speed
            </span>
          </div>
        </div>
      ) : null}
      {!complete ? (
        <TouchController
          disabled={
            !open ||
            recoveryPending ||
            (!rehearsal && (!self || self.status !== "RACING" || race?.ended))
          }
          onChange={change}
        />
      ) : (
        <motion.div
          className="kart-finish-card"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <strong>{self.status === "FINISHED" ? "Chequered flag" : "DNF"}</strong>
          <p>
            {self.status === "FINISHED"
              ? "You made it. Take your hands off the wheel."
              : "The 45-second limit is up. There’s always the next round."}
          </p>
          <p>Watch the stage for the results.</p>
        </motion.div>
      )}
      {!complete ? (
        <div className="kart-recovery">
          {race && self && onRecover ? (
            <Button
              variant="secondary"
              disabled={!open || recoveryPending || race.ended}
              onClick={() => onRecover(race.raceId)}
            >
              {recoveryPending ? "Returning…" : "Back to track"}
            </Button>
          ) : null}
          <p role="status">
            {recoveryPending
              ? "Returning to the track — controls released"
              : recoveryNotice}
          </p>
        </div>
      ) : null}
      {!complete ? (
        <p className="kart-help">
          A: accelerate · B: brake / reverse · R: drift / boost
          <br />
          Keyboard: arrows and space. Follow the clockwise arrows.
        </p>
      ) : null}
      {snapshot.play?.selfAward != null ? (
        <p className="kart-result">+{snapshot.play.selfAward} points</p>
      ) : null}
    </section>
  );
}
