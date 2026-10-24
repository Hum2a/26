import type { LobbySnapshot } from "@26/shared";

/**
 * Every feature of the app and where the host sees, controls and rehearses it.
 * This list drives the admin sidebar and the room overview cards, and
 * `features.test.ts` fails when a source folder is not covered here or in
 * `adminExempt`. See `.agents/rules/50-admin-coverage.md`.
 */
export type AdminFeature = {
  id: string;
  label: string;
  /** `global` pages live under /admin; `room` pages under /admin/rooms/:gameId. */
  scope: "global" | "room";
  /** Path segment after /admin or /admin/rooms/:gameId. Empty is the index page. */
  path: string;
  /** One sentence for the overview card. */
  summary: string;
  /** What the host can try without live guests: a preview, rehearsal or sample. */
  rehearsal: string;
  /** Source folders this feature owns, relative to the repository root. */
  owns: string[];
  /** A short live line for the room overview card. */
  status?: (snapshot: LobbySnapshot) => string;
};

export const adminFeatures: readonly AdminFeature[] = [
  {
    id: "home",
    label: "Home",
    scope: "global",
    path: "",
    summary: "Recent rooms and a new lobby.",
    rehearsal: "Create a lobby with no guests and open its stage.",
    owns: ["apps/web/src/home"],
  },
  {
    id: "rooms",
    label: "Rooms",
    scope: "global",
    path: "rooms",
    summary: "Every saved room, with recovery for older ones.",
    rehearsal: "Open any older room to inspect its state.",
    owns: [],
  },
  {
    id: "content",
    label: "Question packs",
    scope: "global",
    path: "content",
    summary:
      "Manage the birthday running order and inspect questions, answers, readiness and media.",
    rehearsal: "Each question opens on a rehearsal phone and stage with no room.",
    owns: [
      "apps/api/src/questions",
      "apps/web/src/play",
      "apps/web/src/rounds",
      "apps/web/src/photo",
    ],
  },
  {
    id: "kart",
    label: "Kart",
    scope: "global",
    path: "kart",
    summary:
      "The kart engine, adaptive graphics, turbo tiers, course features and multiplayer notes.",
    rehearsal:
      "Drive the real engine; compare Auto/High/Low and rehearse 16/21-player graphics inside Course set-up, plus boosts, ramps and gliding.",
    owns: ["apps/web/src/kart"],
  },
  {
    id: "troll-catalogue",
    label: "Trolls",
    scope: "global",
    path: "trolls",
    summary: "Every troll, its rules and timing.",
    rehearsal: "Preview each phone gag on this screen.",
    owns: [],
  },
  {
    id: "overview",
    label: "Overview",
    scope: "room",
    path: "",
    summary: "Join code, phase, players and every feature at a glance.",
    rehearsal:
      "Fill an empty room with sample data to preview every page, or open the guest join link and the stage.",
    owns: ["apps/web/src/join", "apps/web/src/lobby", "apps/web/src/guest"],
    status: (snapshot) =>
      `${snapshot.phase}${snapshot.paused ? " · paused" : ""} · ${snapshot.players.length} players`,
  },
  {
    id: "live",
    label: "Live controls",
    scope: "room",
    path: "live",
    summary: "Start, pause, advance and fix the running game.",
    rehearsal: "Start the illustrative demo, or the kart rehearsal, with no guests.",
    owns: [
      "apps/api/src/room",
      "apps/web/src/live",
      "apps/web/src/stage",
      "apps/web/src/net",
    ],
    status: (snapshot) =>
      snapshot.play
        ? `Question ${snapshot.play.question.index + 1}`
        : "No question running",
  },
  {
    id: "players",
    label: "Players",
    scope: "room",
    path: "players",
    summary: "Rename, swap, kick, recover, adjust scores and move phones.",
    rehearsal: "Join from a second browser tab to try each player action.",
    owns: ["apps/api/src/credentials"],
    status: (snapshot) =>
      `${snapshot.players.length} players · ${snapshot.connections?.guests ?? 0} phones connected`,
  },
  {
    id: "media",
    label: "Media",
    scope: "room",
    path: "media",
    summary: "Every photo and voice clip, moderation and reversible iPhone photo bias.",
    rehearsal:
      "Run the real clean/rough photo processor on a stand-in sample; upload from a second tab to try hiding.",
    owns: ["apps/api/src/media", "apps/web/src/media"],
    status: (snapshot) => `${snapshot.media.length} question photos and clips`,
  },
  {
    id: "wall",
    label: "Photo wall",
    scope: "room",
    path: "wall",
    summary: "Approve, pull and pace guest photos on the big screen.",
    rehearsal: "Preview every frame with a sample photo; send one from a second tab.",
    owns: ["apps/api/src/wall", "apps/web/src/wall"],
    status: (snapshot) => {
      const wall = snapshot.wall;
      if (!wall) return "Unavailable";
      if (!wall.enabled) return "Switched off";
      const pending =
        wall.queue?.filter((item) => item.status === "pending").length ?? 0;
      return `${pending} waiting for you · ${wall.waiting} queued${wall.now ? " · one on screen" : ""}`;
    },
  },
  {
    id: "trolls",
    label: "Trolls",
    scope: "room",
    path: "trolls",
    summary: "Switch trolls on or off and see every troll sent.",
    rehearsal: "Preview each phone gag; send one between two tabs.",
    owns: ["apps/api/src/troll", "apps/web/src/troll"],
    status: (snapshot) =>
      `${snapshot.trollHistory?.length ?? 0} sent · ${snapshot.trolls.disabled?.length ?? 0} switched off`,
  },
  {
    id: "analytics",
    label: "Analytics",
    scope: "room",
    path: "analytics",
    summary: "Room statistics, podium highlights, fun facts and activity totals.",
    rehearsal: "Highlights preview live, including ones held back as too small.",
    owns: ["apps/api/src/stats"],
    status: (snapshot) => `${snapshot.highlights?.length ?? 0} highlights ready`,
  },
  {
    id: "results",
    label: "Results",
    scope: "room",
    path: "results",
    summary: "The archive, the public results page and result emails.",
    rehearsal: "Open the public results page; retry delivery and the archive.",
    owns: ["apps/api/src/results", "apps/api/src/archive", "apps/web/src/results"],
    status: (snapshot) =>
      snapshot.archive ? `Archive ${snapshot.archive.status}` : "Not archived yet",
  },
  {
    id: "health",
    label: "Health",
    scope: "room",
    path: "health",
    summary:
      "Connections, scheduler, media processing, script errors and device telemetry.",
    rehearsal: "Refresh to check every subsystem; release stuck uploads.",
    owns: [
      "apps/api/src/device",
      "apps/api/src/security",
      "apps/web/src/device",
      "apps/web/src/controller",
    ],
    status: (snapshot) =>
      snapshot.connections ? `${snapshot.connections.stage} stage screens` : "Checking",
  },
  {
    id: "settings",
    label: "Account & appearance",
    scope: "global",
    path: "settings",
    summary: "Your administrator session and this browser's theme.",
    rehearsal: "Switch themes with ?theme=… to preview them.",
    owns: ["apps/api/src/auth", "apps/web/src/theme"],
  },
];

/**
 * Folders that are plumbing rather than features, each with the reason. A new
 * folder must be added to a feature above or here; the test will not let it
 * be forgotten.
 */
export const adminExempt: Readonly<Record<string, string>> = {
  "apps/web/src/admin": "The admin workspace itself.",
  "apps/web/src/anim": "Shared animation helpers used by every surface.",
  "apps/web/src/api": "Shared request helpers.",
  "apps/web/src/ui": "Shared primitives and layout.",
};

export function featurePath(feature: AdminFeature, gameId?: string): string {
  if (feature.scope === "room") {
    const base = `/admin/rooms/${gameId ?? ""}`;
    return feature.path ? `${base}/${feature.path}` : base;
  }
  return feature.path ? `/admin/${feature.path}` : "/admin";
}

export const globalFeatures = adminFeatures.filter(
  (feature) => feature.scope === "global",
);
export const roomFeatures = adminFeatures.filter((feature) => feature.scope === "room");
