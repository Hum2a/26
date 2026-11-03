import type { AdminTrolls, LobbySnapshot, TrollKindName } from "@26/shared";
import { Link } from "react-router";
import { GuestTrolls } from "../troll/guest-troll";
import { trollGroupOf, trollMeta } from "../troll/troll-meta";

type Troll = AdminTrolls["trolls"][number];

const sampleEffectId = "00000000-0000-4000-8000-0000000000ee";
const samplePlayerId = "00000000-0000-4000-8000-0000000000aa";

/** Where to look once the troll lands, by group. */
const whatToWatch: Record<string, string> = {
  points:
    "Watch the scores at the reveal: the target's points move as the troll says. Room → Trolls → “Sent this game” shows when it settled.",
  identity:
    "Watch the target's name on the stage, the scores and every phone; it changes back by itself.",
  stage: "Watch the projector at the reveal or the scores, where this troll is shown.",
  sabotage:
    "Watch the target's answer controls while they answer; they stay usable but misbehave.",
  chaos: "Watch the target's phone screen.",
};

/**
 * A guided rehearsal for a troll with no full-screen preview. It draws the
 * real incoming banner from sample data, then explains how to see the live
 * effect with bots and a second browser tab. Nothing is sent to a room.
 */
export function TrollRehearsal({ troll }: { troll: Troll }) {
  const kind = troll.kind as TrollKindName;
  const group = trollGroupOf(kind);
  // The banner reads only the players and the active trolls; nothing here is a room.
  const sample = {
    phase: "collect",
    players: [{ playerId: samplePlayerId, nickname: "Sample troller" }],
    trolls: {
      token: "spent",
      offers: [],
      active: [
        {
          effectId: sampleEffectId,
          kind,
          role: "target",
          status: "active",
          expiresAt: null,
          label: troll.label,
          escape: troll.escape,
          assetLabel: troll.assetLabel,
          fromPlayerId: samplePlayerId,
        },
      ],
      announcement: null,
    },
  } as unknown as LobbySnapshot;
  return (
    <div className="admin-troll-rehearsal">
      <p className="entry-eyebrow">The target's phone shows</p>
      <div
        className="admin-troll-rehearsal-phone"
        aria-label={`${troll.label} banner preview`}
      >
        <GuestTrolls
          snapshot={sample}
          gameId="REHEARSE"
          selfId="admin-rehearsal"
          pending={false}
          onEscape={() => {}}
        />
      </div>
      <p className="entry-eyebrow">Try it for real</p>
      <ol className="admin-troll-rehearsal-steps">
        <li>
          Create or open a lobby, then in <strong>Developer tools</strong> choose{" "}
          <strong>Set 10 bots</strong>.
        </li>
        <li>
          Open <Link to="/join">/join</Link> in a second browser or private window and
          join as yourself.
        </li>
        <li>
          Start the game and reach question 2 or later
          {troll.modifier
            ? " on a scored multiple-choice question (points trolls only run there)"
            : troll.questionKinds.length > 0
              ? ` on a ${troll.questionKinds.join(" or ")} question`
              : ""}
          .
        </li>
        <li>
          On that phone open <strong>Troll</strong> → <strong>{group.label}</strong> →{" "}
          <strong>{troll.label}</strong>, pick a bot and confirm.
        </li>
        <li>{whatToWatch[group.id] ?? whatToWatch.chaos}</li>
      </ol>
      <p className="admin-troll-rehearsal-note">
        {trollMeta[kind]?.blurb ?? troll.assetLabel} You can cancel it from this room's
        Trolls page while it runs.
      </p>
    </div>
  );
}
