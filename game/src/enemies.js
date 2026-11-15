// Shadow creatures: three kinds, all chasing the wisp. They spawn at the dark
// edges, slide around pillars, and touch the wisp to steal its light.
import { ENEMY, ARENA } from './config.js';
import { range, pick } from './random.js';

export const TYPE_SHAMBLER = 'shambler';
export const TYPE_SWIFT = 'swift';
export const TYPE_BRUTE = 'brute';

function weightsForRound(round) {
  if (round <= 1) return [[TYPE_SHAMBLER, 1]];
  if (round === 2) return [[TYPE_SHAMBLER, 0.7], [TYPE_SWIFT, 0.3]];
  if (round === 3) return [[TYPE_SHAMBLER, 0.5], [TYPE_SWIFT, 0.35], [TYPE_BRUTE, 0.15]];
  return [[TYPE_SHAMBLER, 0.4], [TYPE_SWIFT, 0.4], [TYPE_BRUTE, 0.2]];
}

export function pickType(rng, round) {
  const weights = weightsForRound(round);
  let total = 0;
  for (let i = 0; i < weights.length; i += 1) total += weights[i][1];
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i][1];
    if (roll <= 0) return weights[i][0];
  }
  return TYPE_SHAMBLER;
}

// Spawn one creature at a random edge point, far from the wisp.
export function spawnEnemy(rng, round, speedMul, player) {
  const type = pickType(rng, round);
  const def = ENEMY[type];
  const side = Math.floor(rng() * 4);
  let x;
  let y;
  if (side === 0) { x = range(rng, ARENA.x, ARENA.x + ARENA.width); y = ARENA.y + 8; } else if (side === 1) { x = range(rng, ARENA.x, ARENA.x + ARENA.width); y = ARENA.y + ARENA.height - 8; } else if (side === 2) { x = ARENA.x + 8; y = range(rng, ARENA.y, ARENA.y + ARENA.height); } else { x = ARENA.x + ARENA.width - 8; y = range(rng, ARENA.y, ARENA.y + ARENA.height); }
  // Keep the spawn away from the wisp so nothing appears on top of the player.
  if (Math.hypot(x - player.x, y - player.y) < 240) {
    x = ARENA.x + ARENA.width - (x - ARENA.x);
    y = ARENA.y + ARENA.height - (y - ARENA.y);
  }
  return {
    type,
    x, y,
    vx: 0, vy: 0,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed * speedMul * range(rng, 0.9, 1.1),
    touch: def.touch,
    score: def.score,
    wobble: rng() * Math.PI * 2,
    flash: 0,
  };
}

// Chase the wisp, slide around pillars, keep a little distance from each other.
export function updateEnemy(e, dt, player, pillars, enemies, time) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  // A slow wobble so the pack does not move in a perfect straight line.
  const wob = Math.sin(time * 2 + e.wobble) * 0.25;
  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy * wob;
  const py = ux * wob;
  e.vx = (ux + px) * e.speed;
  e.vy = (uy + py) * e.speed;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  // Pillars push the creature out (slide, not stop).
  for (let i = 0; i < pillars.length; i += 1) {
    const p = pillars[i];
    const ox = e.x - p.x;
    const oy = e.y - p.y;
    const d = Math.hypot(ox, oy);
    const min = p.radius + e.radius;
    if (d < min && d > 0.01) {
      e.x = p.x + (ox / d) * min;
      e.y = p.y + (oy / d) * min;
    }
  }
  // Gentle separation from the pack.
  for (let i = 0; i < enemies.length; i += 1) {
    const o = enemies[i];
    if (o === e) continue;
    const ox = e.x - o.x;
    const oy = e.y - o.y;
    const d = Math.hypot(ox, oy);
    const min = e.radius + o.radius;
    if (d < min && d > 0.01) {
      const push = (min - d) * 0.5;
      e.x += (ox / d) * push;
      e.y += (oy / d) * push;
    }
  }
  // Stay inside the arena.
  e.x = Math.max(ARENA.x + e.radius, Math.min(ARENA.x + ARENA.width - e.radius, e.x));
  e.y = Math.max(ARENA.y + e.radius, Math.min(ARENA.y + ARENA.height - e.radius, e.y));
  if (e.flash > 0) e.flash -= dt;
}
