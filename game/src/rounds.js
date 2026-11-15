// Round scaling: each cleared round adds a crystal (up to seven), faster
// spawns, faster shadows, and more of them at once. Round 1 is gentle;
// round 4 and beyond is a real fight.
export function roundConfig(round) {
  return {
    crystals: Math.min(5 + (round - 1), 7),
    spawnIntervalSec: Math.max(3.2 - 0.3 * (round - 1), 1.1),
    speedMul: 1 + 0.08 * (round - 1),
    maxEnemies: Math.min(6 + 3 * round, 26),
    pillars: 5,
  };
}

export function roundClearBonus(round) {
  return 500 + 100 * round;
}
