import type { LobbySnapshot } from "@26/shared";

/**
 * Every feature of the app and where the host sees, controls and rehearses it.
 * This list drives the admin sidebar and the room overview cards, and
 * `features.test.ts` fails when a source folder is not covered here or in
 * `adminExempt`. See `.agents/rules/50-admin-coverage.md`.
 */
export type AdminNavGroup =
  | "start"
  | "catalogue"
  | "tonight"
  | "screens"
  | "after"
  | "you";

export type AdminFeature = {
  id: string;
  label: string;
  /** Sidebar and overview grouping. Admin chrome is built from this. */
  group: AdminNavGroup;
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

export const adminNavGroups: readonly {
  id: AdminNavGroup;
  label: string;
  hint: string;
}[] = [
  { id: "start", label: "Start", hint: "Dashboard and saved rooms" },
  { id: "catalogue", label: "Catalogue", hint: "Questions, kart and trolls" },
  { id: "tonight", label: "Tonight", hint: "Run this room" },
  { id: "screens", label: "Screens", hint: "Photos, votes and gags" },
  { id: "after", label: "After", hint: "Results, health and rehearsal" },
  { id: "you", label: "You", hint: "This browser" },
];

export const adminFeatures: readonly AdminFeature[] = [
  {
    id: "developer",
    label: "Developer tools",
    group: "after",
    scope: "room",
    path: "developer",
    summary:
      "Run isolated shows with 100 bots, question controls, real phones, failure scenarios and checks.",
    rehearsal:
      "Create a saved rehearsal setup, run the show with ten bots, repeat a question, disconnect bots and inspect the timeline. In a kart lobby, start and advance the race here to keep the bot fleet connected.",
    owns: ["apps/api/src/developer", "apps/web/src/developer"],
    status: (snapshot) =>
      `${snapshot.developerTools?.bots.length ?? 0} bots · ${snapshot.connections?.guests ?? 0} guest connections`,
  },
  {
    id: "home",
    label: "Home",
    group: "start",
    scope: "global",
    path: "",
    summary: "Tonight at a glance: selected room, recent lobbies and shortcuts.",
    rehearsal: "Create a lobby with no guests and open its stage.",
    owns: ["apps/web/src/home"],
  },
  {
    id: "rooms",
    label: "Rooms",
    group: "start",
    scope: "global",
    path: "rooms",
    summary: "Every saved room, with recovery for older ones.",
    rehearsal: "Open any older room to inspect its state.",
    owns: [],
  },
  {
    id: "content",
    label: "Question packs",
    group: "catalogue",
    scope: "global",
    path: "content",
    summary:
      "Manage the birthday running order and inspect questions, answers, readiness and media.",
    rehearsal: "Each question opens on a rehearsal phone and stage with no room.",
    owns: ["apps/api/src/questions", "apps/web/src/play", "apps/web/src/photo"],
  },
  {
    id: "kart",
    label: "Kart",
    group: "catalogue",
    scope: "global",
    path: "kart",
    summary:
      "Check kart files, rehearse race results, starts, time trials, vehicles, controls, collisions, stage cameras, effects and lighting, create a kart-only lobby and drive the real engine.",
    rehearsal:
      "Rehearse 80 stand-ins, vehicles, lighting and effects in real renderers; test all input methods and pause/release in Controls. In Collisions compare original slide and arcade bounce with the real swept solver. In Items sandbox launch actual bounded tennis/bomb/homing simulations against parked stand-ins; try shields, airborne/finished targets, fuses, full pools, personal Treats and clear/stop controls without a room; run the finite moving two-racer script through actual driving. Choose and freeze allowed room items before racing, inspect private held slots/history and stop spawning or clear hazards in Live controls. In Tracks & modes inspect installed geometry/mode availability and select any of80 actual starting/recovery slots on all three courses, including the new original26 Park, with real maps, optional3D preview and the finite three-second actual-driving sample. In kart-only Live controls choose the course before Start, inspect host selection history and rehearse all three courses without guests. In Race results rehearse accepted splits, recovery, timeout, early end and older race fallbacks on the real phone, stage and host. In Race start rehearse actual loading, interruption, map fallback, retry and disconnected countdown; inspect heading, next sectors and the optional small map with labelled circuit/ring samples. In Time trials rehearse waiting, pause, invalid, assisted and split results, then drive an actual one-/three-lap trial and manage local opt-in records. Choose/freeze handling before a room race, inspect private impact history, or try the same profiles in solo Course set-up.",
    owns: ["apps/web/src/kart"],
  },
  {
    id: "troll-catalogue",
    label: "Trolls",
    group: "catalogue",
    scope: "global",
    path: "trolls",
    summary: "Every troll, its rules and timing.",
    rehearsal: "Preview each phone gag on this screen.",
    owns: [],
  },
  {
    id: "overview",
    label: "Overview",
    group: "tonight",
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
    group: "tonight",
    scope: "room",
    path: "live",
    summary:
      "Start, pause, advance and fix the running game, end it early or destroy the room.",
    rehearsal:
      "Start the illustrative demo, or the kart rehearsal, with no guests. Try End game now and Destroy room on a throwaway lobby with bots.",
    owns: ["apps/api/src/room", "apps/web/src/live", "apps/web/src/stage"],
    status: (snapshot) =>
      snapshot.play
        ? `Question ${snapshot.play.question.index} of ${snapshot.play.question.total}`
        : "No question running",
  },
  {
    id: "players",
    label: "Players",
    group: "tonight",
    scope: "room",
    path: "players",
    summary:
      "Open or close joining, rename, remove, recover, adjust scores and move phones.",
    rehearsal:
      "Close joining, try the join link in a private browser, reopen it and join mid-question; try recovery and phone transfer with that player.",
    owns: ["apps/api/src/credentials"],
    status: (snapshot) =>
      `${snapshot.players.length} players · ${snapshot.connections?.guests ?? 0} phones connected`,
  },
  {
    id: "media",
    label: "Media",
    group: "screens",
    scope: "room",
    path: "media",
    summary: "Every photo and voice clip, moderation and reversible iPhone photo bias.",
    rehearsal:
      "Run the real clean/rough photo processor on a stand-in sample; upload from a second tab to try hiding.",
    owns: ["apps/api/src/media", "apps/web/src/media"],
    status: (snapshot) => `${snapshot.media.length} question photos and clips`,
  },
  {
    id: "voters",
    label: "Vote board",
    group: "screens",
    scope: "room",
    path: "voters",
    summary:
      "Who is picking what on the big screen, the room-wide switch, and every guest's profile photo.",
    rehearsal:
      "Run the real stage vote board with stand-in players: add votes one by one or in a wave, change a mind, then reveal. Nothing is sent to the room.",
    // The board's code lives with questions (projection) and media (photos);
    // this page is their shared host view.
    owns: [],
    status: (snapshot) => {
      const display = snapshot.voterDisplay;
      if (!display) return "Unavailable";
      const photos = `${display.avatars} of ${snapshot.players.length} with photos`;
      return display.mode === "hidden"
        ? `Picks hidden on screen · ${photos}`
        : `Picks follow each question · ${photos}`;
    },
  },
  {
    id: "wall",
    label: "Photo wall",
    group: "screens",
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
    group: "screens",
    scope: "room",
    path: "trolls",
    summary: "Switch trolls on or off and see every troll sent.",
    rehearsal:
      "Preview each phone gag; for points, identity and big-screen trolls, open “Rehearse this troll” to see the target banner and step through a bot test with a second tab.",
    owns: ["apps/api/src/troll", "apps/web/src/troll"],
    status: (snapshot) =>
      `${snapshot.trollHistory?.length ?? 0} sent · ${snapshot.trolls.disabled?.length ?? 0} switched off`,
  },
  {
    id: "analytics",
    label: "Analytics",
    group: "after",
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
    group: "after",
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
    group: "after",
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
    group: "you",
    scope: "global",
    path: "settings",
    summary: "Your administrator session and this browser's theme.",
    rehearsal:
      "Switch themes in the header, then try the real 100-player scoreboard and notification preview in Account & appearance.",
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
  "apps/web/src/chess": "Chess mechanic (admin view pending, catalogue-only).",
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

export function featuresInGroup(group: AdminNavGroup): AdminFeature[] {
  return adminFeatures.filter((feature) => feature.group === group);
}
