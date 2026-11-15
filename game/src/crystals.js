// Crystals: the goal of every round. A crystal charges while the beam touches
// it; charged, it lights up, sings, and glows — standing in its aura refills
// the wisp's light and energy. Light them all to clear the round.
import { CRYSTAL, ARENA } from './config.js';
import { range } from './random.js';

export function makeCrystal(x, y) {
  return { x, y, radius: CRYSTAL.radius, charge: 0, lit: false, pulse: 0 };
}

// Scatter `count` crystals: away from the pillars, from each other, and from
// the wisp's spawn, so every crystal is reachable and no two overlap.
export function placeCrystals(rng, count, pillars, playerX, playerY) {
  const placed = [];
  let guard = 0;
  while (placed.length < count && guard < 400) {
    guard += 1;
    const x = range(rng, ARENA.x + 90, ARENA.x + ARENA.width - 90);
    const y = range(rng, ARENA.y + 90, ARENA.y + ARENA.height - 90);
    if (Math.hypot(x - playerX, y - playerY) < 170) continue;
    let ok = true;
    for (let i = 0; i < pillars.length; i += 1) {
      if (Math.hypot(x - pillars[i].x, y - pillars[i].y) < pillars[i].radius + 70) { ok = false; break; }
    }
    if (!ok) continue;
    for (let i = 0; i < placed.length; i += 1) {
      if (Math.hypot(x - placed[i].x, y - placed[i].y) < 170) { ok = false; break; }
    }
    if (!ok) continue;
    placed.push(makeCrystal(x, y));
  }
  return placed;
}
