import { z } from "zod";
import {
  kartRaceSchema,
  kartLimitMs,
  createKartRace,
  reduceKart,
  projectKartRace,
  type KartTrackId,
} from "./kart.ts";
import {
  importedLapLength,
  importedTrackLimitMs,
  importedRoute,
} from "./kart-route.ts";
import { importedWalls } from "./kart-track.ts";
import { ringBounds, ringWalls, ringDriving, soloDriving } from "./kart-driving.ts";
import { ringItemBoxes, soloItemBoxes } from "./kart-powers.ts";
import { ringCourse, soloCourse } from "./kart-course.ts";

export const kartTrackSelectionSchema = z
  .object({
    track: kartRaceSchema.shape.trackId.default("mario-circuit-v1"),
    slot: z.coerce.number().int().min(1).max(80).default(1),
    beat: z.enum(["grid", "recovery"]).default("grid"),
  })
  .strict();
const modeSchema = z
  .object({
    id: z.enum(["room-race", "free-drive", "trial-1", "trial-3"]),
    label: z.string().min(1).max(60),
    available: z.boolean(),
    detail: z.string().min(1).max(240),
  })
  .strict();
export const kartTrackDefinitionSchema = z
  .object({
    id: kartRaceSchema.shape.trackId,
    name: z.string().min(1).max(60),
    origin: z.enum(["imported", "original"]),
    route: z
      .object({
        kind: z.enum(["polyline", "ring"]),
        metres: z.number().finite().positive(),
        segments: z.number().int().positive(),
        sectors: z.literal(8),
      })
      .strict(),
    collision: z
      .object({
        kind: z.enum(["baked-walls", "polygon-rings"]),
        segments: z.number().int().positive(),
        bodyRadius: z.number().positive().finite(),
      })
      .strict(),
    surface: z.enum(["baked-road-dirt", "annular-road"]),
    grid: z
      .object({
        slots: z.literal(80),
        columns: z.literal(5),
        rowSpacingMetres: z.literal(3),
        source: z.literal("shared-race-factory"),
      })
      .strict(),
    recovery: z.literal("last-accepted-safe-pose"),
    itemBoxes: z.number().int().min(0).max(24),
    features: z
      .object({
        boosts: z.number().int().nonnegative(),
        ramps: z.number().int().nonnegative(),
        sweepers: z.number().int().nonnegative(),
      })
      .strict(),
    raceLimitMs: z.number().int().positive(),
    modes: z.array(modeSchema).length(4),
  })
  .strict();
export const kartTrackCatalogueSchema = z
  .object({
    version: z.literal("kart-tracks-v1"),
    tracks: z.array(kartTrackDefinitionSchema).length(2),
  })
  .strict()
  .refine(
    (value) => new Set(value.tracks.map((track) => track.id)).size === 2,
    "Each installed track appears once",
  );
const grid = {
  slots: 80,
  columns: 5,
  rowSpacingMetres: 3,
  source: "shared-race-factory",
} as const;
const features = (course: typeof ringCourse) => ({
  boosts: course.filter((f) => f.kind === "boost").length,
  ramps: course.filter((f) => f.kind === "ramp").length,
  sweepers: course.filter((f) => f.kind === "hazard").length,
});
const definitions = {
  "mario-circuit-v1": {
    id: "mario-circuit-v1",
    name: "Mario circuit",
    origin: "imported",
    route: {
      kind: "polyline",
      metres: importedLapLength,
      segments: importedRoute.length - 1,
      sectors: 8,
    },
    collision: {
      kind: "baked-walls",
      segments: importedWalls.length,
      bodyRadius: soloDriving.radius,
    },
    surface: "baked-road-dirt",
    grid,
    recovery: "last-accepted-safe-pose",
    itemBoxes: soloItemBoxes.length,
    features: features(soloCourse),
    raceLimitMs: importedTrackLimitMs,
    modes: [
      {
        id: "room-race",
        label: "Connected race",
        available: true,
        detail: "Kart-only lobby, one lap, three-minute limit and up to 80 racers.",
      },
      {
        id: "free-drive",
        label: "Free drive",
        available: true,
        detail: "Solo practice, with no room or party points.",
      },
      {
        id: "trial-1",
        label: "One-lap time trial",
        available: true,
        detail: "One timed lap; clean and assisted local records stay separate.",
      },
      {
        id: "trial-3",
        label: "Three-lap time trial",
        available: true,
        detail: "Three timed laps, with total-time and best-lap records.",
      },
    ],
  },
  "party-ring-v1": {
    id: "party-ring-v1",
    name: "Party ring",
    origin: "original",
    route: {
      kind: "ring",
      metres: Math.PI * 2 * 42,
      segments: ringBounds.segments,
      sectors: 8,
    },
    collision: {
      kind: "polygon-rings",
      segments: ringWalls.length,
      bodyRadius: ringDriving.radius,
    },
    surface: "annular-road",
    grid,
    recovery: "last-accepted-safe-pose",
    itemBoxes: ringItemBoxes.length,
    features: features(ringCourse),
    raceLimitMs: kartLimitMs,
    modes: [
      {
        id: "room-race",
        label: "Connected race",
        available: true,
        detail:
          "Available in the demo/rehearsal round. New kart-only lobbies currently use Mario circuit.",
      },
      {
        id: "free-drive",
        label: "Free drive",
        available: false,
        detail:
          "Course preview works here. Playable ring practice is still being added.",
      },
      {
        id: "trial-1",
        label: "One-lap time trial",
        available: false,
        detail: "Time trials currently use Mario circuit.",
      },
      {
        id: "trial-3",
        label: "Three-lap time trial",
        available: false,
        detail: "Three-lap ring practice is still being added.",
      },
    ],
  },
} satisfies Record<KartTrackId, z.input<typeof kartTrackDefinitionSchema>>;
export const kartTrackCatalogue = kartTrackCatalogueSchema.parse({
  version: "kart-tracks-v1",
  tracks: Object.values(definitions),
});
export const kartTracksSectionSchema = z
  .object({
    catalogue: kartTrackCatalogueSchema,
    selection: kartTrackSelectionSchema,
    label: z.string().min(1).max(300),
    phone: kartRaceSchema,
    stage: kartRaceSchema,
  })
  .strict();
export type KartTrackSelection = z.infer<typeof kartTrackSelectionSchema>;

/** Public, isolated stand-ins through the actual shared race/recovery implementation. */
export function kartTrackPreview(raw: unknown) {
  const selection = kartTrackSelectionSchema.parse(raw);
  let race = createKartRace(
    `track-preview-${selection.track}-${selection.slot}-${selection.beat}`,
    Array.from({ length: 80 }, (_, i) => ({
      playerId: `stand-in-${i + 1}`,
      name: `Stand-in ${i + 1}`,
    })),
    { seedGrid: true, trackId: selection.track },
  );
  const selected = race.drivers[selection.slot - 1]!;
  if (selection.beat === "recovery") {
    selected.x = 10000;
    selected.z = 10000;
    selected.speed = 10;
    race = reduceKart(race, { type: "recover", playerId: selected.playerId });
  }
  const stage = projectKartRace(race, null, 0),
    fullPhone = projectKartRace(race, selected.playerId, 0);
  const phone = {
    ...fullPhone,
    participantCount: 80,
    participants: fullPhone.participants.filter(
      (d) => d.playerId === selected.playerId,
    ),
    leaderboard: fullPhone.leaderboard.filter(
      (row) => row.playerId === selected.playerId,
    ),
  };
  return kartTracksSectionSchema.parse({
    catalogue: kartTrackCatalogue,
    selection,
    label: `80 labelled stand-ins · slot ${selection.slot} · ${selection.beat === "recovery" ? "actual shared recovery to its accepted starting-grid pose" : "actual shared starting grid"}. Isolated preview; no room, score or persistence.`,
    phone,
    stage,
  });
}
