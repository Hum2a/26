import { motion, useReducedMotion } from "motion/react";
import type { LobbySnapshot, KartInput } from "@26/shared";
import { TouchController } from "./TouchController";
import { useKartSocket } from "./useKartSocket";

export function GuestKart({
  snapshot,
  connected = true,
  onInput,
}: {
  snapshot: LobbySnapshot;
  connected?: boolean;
  onInput?: (input: KartInput) => void;
}) {
  const reduced = useReducedMotion();
  const race = snapshot.play?.kart;
  const self = race?.participants.find((d) => d.playerId === race.selfPlayerId);
  const place = race?.leaderboard.find((d) => d.playerId === self?.playerId)?.place;
  const complete = self && self.status !== "RACING";
  const open =
    snapshot.phase === "collect" && !snapshot.paused && !snapshot.held && connected;
  const change = useKartSocket(race, open, onInput);
  const rehearsal = !onInput && !race;
  const instruction = !connected
    ? "Connection lost — controls released"
    : snapshot.paused || snapshot.held
      ? "Paused — controls released"
      : race?.ended || complete
        ? "Race complete — watch the stage"
        : snapshot.phase !== "collect" && !rehearsal
          ? "Find your numbered kart on the TV. Wait for the race to start."
          : race && !self
            ? "You’re watching this race. Join the next round."
            : "Hold A and steer clockwise. Hold R, then release for a boost.";
  return (
    <section className="kart-phone" aria-label="Sprint controller">
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
      <p role="status">
        {rehearsal ? "Controller rehearsal — no race is running." : instruction}
      </p>
      {self ? (
        <div className="kart-phone-hud">
          <svg
            viewBox="-56 -56 112 112"
            aria-label={`Your track position: ${Math.round(self.progress * 100)} per cent`}
            role="img"
          >
            <circle r="42" className="kart-map-road" />
            {Array.from({ length: 8 }, (_, i) => {
              const a = ((i + 1) * Math.PI) / 4;
              return (
                <circle
                  key={i}
                  cx={Math.cos(a) * 42}
                  cy={Math.sin(a) * 42}
                  r="2.5"
                  className={
                    self.checkpoint > i
                      ? "kart-map-gate kart-map-gate-passed"
                      : "kart-map-gate"
                  }
                />
              );
            })}
            <path d="M34 0H50" className="kart-map-line" />
            <g
              transform={`translate(${self.x} ${self.z}) rotate(${(self.heading * 180) / Math.PI})`}
            >
              <path d="M4 0L-3 -3L-3 3Z" className="kart-map-driver" />
            </g>
          </svg>
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
                : `Position ${place ?? "—"} · find #${self.number} on the TV`}
            </p>
          </div>
        </div>
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
            !open || (!rehearsal && (!self || self.status !== "RACING" || race?.ended))
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
