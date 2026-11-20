import type { DriverStyle } from "@26/shared";

export type SoloBotRenderPose = {
  playerId: string;
  name: string;
  number: number;
  style: DriverStyle;
  x: number;
  z: number;
  heading: number;
  height: number;
  speed: number;
  turnRate: number;
  travel: number;
  drifting: boolean;
  finished: boolean;
};

/** Mutable per-frame buffer so 60 fps bot updates never trigger React renders. */
export const soloBotFrame = {
  poses: [] as SoloBotRenderPose[],
};
