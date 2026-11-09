import { z } from "zod";

/**
 * Drivers a guest can sit in their kart. Each is a low-poly body built in the
 * renderer; colours come from the screen's theme, so a style is a shape, not a
 * palette. A guest may also put their own photo on the driver's face.
 */
export const driverStyles = [
  { id: "racer", name: "Racer", note: "Full helmet and visor" },
  { id: "party", name: "Party animal", note: "Birthday hat" },
  { id: "royal", name: "Royalty", note: "A crown, obviously" },
  { id: "cap", name: "Weekend driver", note: "Backwards cap" },
  { id: "dj", name: "DJ", note: "Big headphones" },
  { id: "bandit", name: "Bandit", note: "Bandana and goggles" },
] as const;

export type DriverStyle = (typeof driverStyles)[number]["id"];

export const driverStyleSchema = z.enum(
  driverStyles.map((style) => style.id) as [DriverStyle, ...DriverStyle[]],
);

/** What a phone sends to choose its driver. A null face clears the photo. */
export const driverChoiceSchema = z
  .object({
    style: driverStyleSchema,
    faceMediaId: z.uuid().nullable(),
  })
  .strict();

export type DriverChoice = z.infer<typeof driverChoiceSchema>;

/** The driver every screen sees. A hidden or missing face is simply absent. */
export const lobbyDriverSchema = z
  .object({
    style: driverStyleSchema,
    faceMediaId: z.uuid().optional(),
  })
  .strict();

export type LobbyDriver = z.infer<typeof lobbyDriverSchema>;

/** A guest who has not chosen still gets a varied, stable driver. */
export function defaultDriverStyle(order: number): DriverStyle {
  const index =
    ((order % driverStyles.length) + driverStyles.length) % driverStyles.length;
  return driverStyles[index]!.id;
}
