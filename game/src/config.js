// LUMEN tuning: every number the game balances on lives in this one file,
// so a balance pass is a single edit here, never a hunt through the sim.
export const STEP = 1 / 60;

export const FIELD = { width: 1280, height: 720 };
// Playable area inside the wall. The wall is drawn, the wisp stays inside.
export const ARENA = { x: 56, y: 76, width: 1168, height: 588 };

export const PLAYER = {
  radius: 14,
  speed: 272,
  accel: 2600,
  friction: 6.5,
};

export const LIGHT = { max: 100 };
export const ENERGY = {
  max: 100,
  beamDrainPerSec: 13,
  mirrorCost: 25,
  mirrorRefund: 12,
  orbGain: 12,
  crystalRegenPerSec: 24,
  lightRegenPerSec: 3,
};

export const BEAM = {
  maxBounces: 6,
  maxLength: 1500,
  dps: 70,
  width: 5,
  // A beam that has bounced off a mirror hits harder: the reason to use mirrors.
  reflectBonus: 1.5,
};

export const MIRROR = { length: 96, max: 6 };

export const CRYSTAL = {
  radius: 22,
  chargeTimeSec: 1.3,
  auraRadius: 150,
};

export const ORB = { radius: 8, magnetRadius: 140, collectRadius: 26 };

export const ENEMY = {
  shambler: { speed: 72, hp: 30, radius: 16, touch: 10, score: 15, color: '#8a6cff', eye: '#e8ddff' },
  swift: { speed: 158, hp: 18, radius: 12, touch: 8, score: 20, color: '#ff5c8a', eye: '#ffe3ec' },
  brute: { speed: 46, hp: 95, radius: 25, touch: 18, score: 40, color: '#b44dff', eye: '#f2e3ff' },
};

export const SCORE = { crystal: 250, roundBonus: 500, roundPerLevel: 100 };

// Events the fixed-step sim returns as a bitmask, so the shot stager and the
// main loop can react without the sim knowing about screens or sound.
export const EVENT_NONE = 0;
export const EVENT_CRYSTAL_LIT = 1;
export const EVENT_ROUND_CLEAR = 2;
export const EVENT_OVER = 4;
export const EVENT_HURT = 8;
export const EVENT_KILL = 16;
export const EVENT_MIRROR = 32;
