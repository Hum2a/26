// Adapted from mario-kart-js 0f7a430. See UPSTREAM.md and THIRD_PARTY_NOTICES.md.
export const kartSettings = {
  speed: {
    min: -10,
    max: 30,
    default: 0,
    timeTrialSpeedFactor: 1.5, // Increase speed in time trial mode
  },
};

export const drifts = {
  level3: {
    name: "purple",
    threshold: 6,
    color: "#b100ff",
    nbParticles: 25,
    level: 3,
  },
  level2: {
    name: "yellow",
    threshold: 3,
    color: "#FFA22B",
    nbParticles: 5,
    level: 2,
  },
  level1: {
    name: "blue",
    threshold: 0.7,
    color: "#00ffff",
    nbParticles: 15,
    level: 1,
  },
};

const driftLevels = Object.values(drifts).sort((a, b) => b.threshold - a.threshold);

export const getDriftLevel = (power) => {
  for (const level of driftLevels) {
    if (power >= level.threshold) {
      return level;
    }
  }

  return {
    name: "none",
    color: "#ffffff",
    nbParticles: 5,
    level: 0,
  };
};
