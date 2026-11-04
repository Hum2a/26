/** Presentation only. Charge and boost come from the existing simulation. */
export const kartEffectVersion = 1;

/** Renderer-neutral bounded points; both adapters own their own mesh resources. */
export function driftEffectDescription(...args: Parameters<typeof driftSparks>) {
  return {
    version: kartEffectVersion,
    space: "kart-local" as const,
    points: driftSparks(...args),
  };
}

export function driftPose(
  heading: number,
  vx: number,
  vz: number,
  drifting: boolean,
  side: number,
) {
  const slip = Math.atan2(
    -Math.sin(heading) * vx + Math.cos(heading) * vz,
    Math.max(1, Math.hypot(vx, vz)),
  );
  return drifting ? Math.max(-0.45, Math.min(0.45, slip * 0.8 - side * 0.18)) : 0;
}

export function driftStrength(previous: number, active: boolean, seconds: number) {
  return (
    (active ? 1 : 0) +
    (previous - (active ? 1 : 0)) * Math.exp(-14 * Math.max(0, Math.min(0.1, seconds)))
  );
}

/** Eight recycled sparks: local x is wheel side, z trails behind the kart. */
export function driftSparks(
  time: number,
  strength: number,
  charge: number,
  boosting: boolean,
  reduced: boolean,
) {
  const power = Math.max(0, Math.min(1, charge));
  return Array.from({ length: reduced ? 2 : 8 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const age = reduced
      ? 0
      : (((time * (boosting ? 2.8 : 2) + Math.floor(i / 2) / 4) % 1) + 1) % 1;
    const ease = 1 - (1 - age) ** 2;
    return {
      x: side * (0.83 + (reduced ? 0 : ease * (0.35 + power * 0.35))),
      y: reduced ? 0 : Math.sin(age * Math.PI) * (0.16 + power * 0.22),
      z: 0.8 + ease * (boosting ? 2.3 : 1.3),
      scale:
        Math.max(0, strength) *
        (0.55 + power * 0.65) *
        (reduced ? 0.7 : (1 - age) ** 2),
    };
  });
}
