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
  const race = snapshot.play?.kart;
  const self = race?.participants.find((d) => d.playerId === race.selfPlayerId);
  const open =
    snapshot.phase === "collect" && !snapshot.paused && !snapshot.held && connected;
  const change = useKartSocket(race, open, onInput);
  const rehearsal = !onInput && !race;
  const instruction = !connected
    ? "Connection lost — controls released"
    : snapshot.paused
      ? "Paused — controls released"
      : race?.ended || self?.status === "FINISHED"
        ? "Race complete — watch the stage"
        : race && !self
          ? "You’re watching this race. Join the next round."
          : "Hold A to accelerate. Steer around the circuit. Release R for a drift boost.";
  return (
    <section className="kart-phone" aria-label="Sprint controller">
      <p className="kart-eyebrow">ONE LAP · 45 SECONDS</p>
      <h1 className="phone-prompt">
        {self ? `Kart ${self.number}` : "Start your engines"}
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
              {Math.max(0, (45_000 - (race?.elapsedMs ?? 0)) / 1000).toFixed(1)}s left
            </p>
            <p>Your kart is numbered on the TV.</p>
          </div>
        </div>
      ) : null}
      <TouchController
        disabled={
          !open || (!rehearsal && (!self || self.status !== "RACING" || race?.ended))
        }
        onChange={change}
      />
      <p className="kart-help">
        A: accelerate · B: brake / reverse · R: drift / hop
        <br />
        Keyboard: arrows and space. Follow the clockwise arrows.
      </p>
      {snapshot.play?.selfAward != null ? (
        <p className="kart-result">+{snapshot.play.selfAward} points</p>
      ) : null}
    </section>
  );
}
