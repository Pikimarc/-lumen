// LUMEN world: all state in one place, one fixed-step function that moves it.
// The sim knows nothing about screens, sound, or the canvas — it returns an
// event bitmask and the main loop turns events into sound and screens.
import {
  STEP, FIELD, ARENA, PLAYER, LIGHT, ENERGY, BEAM, MIRROR, CRYSTAL, ORB,
  EVENT_NONE, EVENT_CRYSTAL_LIT, EVENT_ROUND_CLEAR, EVENT_OVER, EVENT_HURT,
  EVENT_KILL, EVENT_MIRROR, SCORE,
} from './config.js';
import { mulberry32, range } from './random.js';
import { castBeam, beamEnemies, segmentClear } from './beam.js';
import { placeMirror, removeMirrorAt, MIRROR_SLASH, flipMirrorAngle } from './mirrors.js';
import { spawnEnemy, updateEnemy } from './enemies.js';
import { placeCrystals } from './crystals.js';
import { roundConfig, roundClearBonus } from './rounds.js';
import { makeFloorTexture } from './textures.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_ROUND_CLEAR = 'roundclear';
export const PHASE_OVER = 'over';

function placePillars(rng, count, playerX, playerY) {
  const pillars = [];
  let guard = 0;
  while (pillars.length < count && guard < 300) {
    guard += 1;
    const x = range(rng, ARENA.x + 150, ARENA.x + ARENA.width - 150);
    const y = range(rng, ARENA.y + 130, ARENA.y + ARENA.height - 130);
    if (Math.hypot(x - playerX, y - playerY) < 220) continue;
    let ok = true;
    for (let i = 0; i < pillars.length; i += 1) {
      if (Math.hypot(x - pillars[i].x, y - pillars[i].y) < 240) { ok = false; break; }
    }
    if (!ok) continue;
    pillars.push({ x, y, radius: range(rng, 34, 46) });
  }
  return pillars;
}

export function createWorld(seed) {
  const world = {
    seed,
    rng: mulberry32(seed),
    time: 0,
    stepCount: 0,
    phase: PHASE_TITLE,
    phaseTimer: 0,
    round: 1,
    score: 0,
    best: 0,
    player: {
      x: FIELD.width / 2, y: FIELD.height / 2,
      vx: 0, vy: 0,
      light: LIGHT.max, energy: ENERGY.max,
      invuln: 0, aimX: FIELD.width / 2, aimY: FIELD.height / 2 - 120,
      firing: false,
    },
    mirrors: [],
    pillars: [],
    crystals: [],
    enemies: [],
    orbs: [],
    particles: [],
    spawnTimer: 0,
    beam: { points: [], crystalHits: [], enemyHits: [], active: false, bounced: false },
    shake: 0,
    flash: 0,
    stats: { crystalsLit: 0, kills: 0 },
    mirrorAngle: MIRROR_SLASH,
    ignorePlaceSteps: 0,
    floor: null,
  };
  resetWorld(world, seed);
  return world;
}

export function resetWorld(world, seed) {
  const s = seed === undefined ? world.seed : seed;
  world.seed = s;
  world.rng = mulberry32(s);
  world.time = 0;
  world.stepCount = 0;
  world.phase = PHASE_TITLE;
  world.phaseTimer = 0;
  world.round = 1;
  world.score = 0;
  world.player.x = FIELD.width / 2;
  world.player.y = FIELD.height / 2;
  world.player.vx = 0;
  world.player.vy = 0;
  world.player.light = LIGHT.max;
  world.player.energy = ENERGY.max;
  world.player.invuln = 0;
  world.player.aimX = FIELD.width / 2;
  world.player.aimY = FIELD.height / 2 - 120;
  world.player.firing = false;
  world.mirrors = [];
  world.enemies = [];
  world.orbs = [];
  world.particles = [];
  world.spawnTimer = 2.2;
  world.beam.points = [];
  world.beam.crystalHits = [];
  world.beam.enemyHits = [];
  world.beam.active = false;
  world.beam.bounced = false;
  world.shake = 0;
  world.flash = 0;
  world.stats.crystalsLit = 0;
  world.stats.kills = 0;
  world.mirrorAngle = MIRROR_SLASH;
  const cfg = roundConfig(1);
  world.pillars = placePillars(world.rng, cfg.pillars, world.player.x, world.player.y);
  world.crystals = placeCrystals(world.rng, cfg.crystals, world.pillars, world.player.x, world.player.y);
  world.floor = makeFloorTexture(s);
}

// Start (or restart) a run: fresh round 1, fresh light, same seed layout.
// The first steps ignore mirror placement, so the click that started the game
// never also drops a mirror; the wisp gets brief spawn protection.
export function startGame(world) {
  resetWorld(world, world.seed);
  world.phase = PHASE_PLAY;
  world.phaseTimer = 0;
  world.ignorePlaceSteps = 20;
  world.player.invuln = 1.5;
}

function nextRound(world) {
  world.round += 1;
  const cfg = roundConfig(world.round);
  world.crystals = placeCrystals(world.rng, cfg.crystals, world.pillars, world.player.x, world.player.y);
  world.enemies = [];
  world.orbs = [];
  world.spawnTimer = 2.0;
  world.phase = PHASE_PLAY;
  world.phaseTimer = 0;
  world.player.invuln = 1.0;
}

function collideCircleArena(x, y, radius) {
  return {
    x: Math.max(ARENA.x + radius, Math.min(ARENA.x + ARENA.width - radius, x)),
    y: Math.max(ARENA.y + radius, Math.min(ARENA.y + ARENA.height - radius, y)),
  };
}

function collidePillars(x, y, radius, pillars) {
  for (let i = 0; i < pillars.length; i += 1) {
    const p = pillars[i];
    const ox = x - p.x;
    const oy = y - p.y;
    const d = Math.hypot(ox, oy);
    const min = p.radius + radius;
    if (d < min && d > 0.01) {
      x = p.x + (ox / d) * min;
      y = p.y + (oy / d) * min;
    }
  }
  return { x, y };
}

function spawnParticles(world, x, y, count, color, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: range(world.rng, 0.3, 0.7), maxLife: 0.7,
      radius: range(world.rng, 1.5, 3.5),
      color,
    });
  }
  if (world.particles.length > 240) world.particles.splice(0, world.particles.length - 240);
}

function dropOrbs(world, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const a = world.rng() * Math.PI * 2;
    world.orbs.push({
      x: x + Math.cos(a) * 14,
      y: y + Math.sin(a) * 14,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
      life: 9,
    });
  }
}

// One fixed step. `input` is the reused frame object from input.js (or the
// autopilot): { moveX, moveY, aimX, aimY, firing, place, remove, toggleMirror }.
// Edge flags are consumed here, so a single press never places two mirrors.
export function step(world, input, dt) {
  let events = EVENT_NONE;
  dt = dt || STEP;
  world.time += dt;
  world.stepCount += 1;
  const p = world.player;

  if (input.toggleMirror) {
    world.mirrorAngle = flipMirrorAngle(world.mirrorAngle);
    input.toggleMirror = false;
  }

  // Edge flags are only meaningful while playing; clear them in every other
  // phase so a press on the title screen never leaks into the run.
  if (world.phase !== PHASE_PLAY) {
    input.place = false;
    input.remove = false;
  }

  if (world.phase === PHASE_TITLE) {
    // The title screen sits over a living backdrop: a few shadows drift.
    if (world.enemies.length < 3 && world.time > 1) {
      world.enemies.push(spawnEnemy(world.rng, 1, 0.7, p));
    }
    for (let i = 0; i < world.enemies.length; i += 1) {
      updateEnemy(world.enemies[i], dt, { x: FIELD.width / 2, y: FIELD.height / 2 }, world.pillars, world.enemies, world.time);
    }
    updateParticles(world, dt);
    return events;
  }

  if (world.phase === PHASE_ROUND_CLEAR) {
    world.phaseTimer -= dt;
    updateParticles(world, dt);
    if (world.phaseTimer <= 0) nextRound(world);
    return events;
  }

  if (world.phase === PHASE_OVER) {
    updateParticles(world, dt);
    return events;
  }

  // --- play phase ---
  // Movement: acceleration toward the wanted direction, friction when idle.
  const wantX = input.moveX || 0;
  const wantY = input.moveY || 0;
  p.vx += wantX * PLAYER.accel * dt;
  p.vy += wantY * PLAYER.accel * dt;
  const damp = Math.max(0, 1 - PLAYER.friction * dt);
  if (wantX === 0) p.vx *= damp;
  if (wantY === 0) p.vy *= damp;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > PLAYER.speed) {
    p.vx = (p.vx / speed) * PLAYER.speed;
    p.vy = (p.vy / speed) * PLAYER.speed;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  let pos = collideCircleArena(p.x, p.y, PLAYER.radius);
  pos = collidePillars(pos.x, pos.y, PLAYER.radius, world.pillars);
  p.x = pos.x;
  p.y = pos.y;
  if (p.invuln > 0) p.invuln -= dt;

  // Aim.
  p.aimX = input.aimX;
  p.aimY = input.aimY;

  // Mirrors: place at the mouse (45-degree diagonal), remove near the mouse.
  if (world.ignorePlaceSteps > 0) {
    world.ignorePlaceSteps -= 1;
    input.place = false;
  }
  if (input.place) {
    input.place = false;
    if (p.energy >= ENERGY.mirrorCost && world.mirrors.length < MIRROR.max) {
      const angle = pickMirrorAngle(world, p);
      const m = placeMirror(world.mirrors, input.aimX, input.aimY, angle);
      if (m) {
        p.energy -= ENERGY.mirrorCost;
        events |= EVENT_MIRROR;
        spawnParticles(world, m.x, m.y, 10, '#dfe9ff', 90);
      }
    }
  }
  if (input.remove) {
    input.remove = false;
    const removed = removeMirrorAt(world.mirrors, input.aimX, input.aimY, 60);
    if (removed) {
      p.energy = Math.min(ENERGY.max, p.energy + ENERGY.mirrorRefund);
      spawnParticles(world, removed.x, removed.y, 8, '#9fb8ff', 70);
    }
  }

  // Beam: hold to fire. It drains energy, hurts shadows on its path, and
  // charges every crystal it crosses. A bounced beam hits 50% harder.
  const wantFire = !!input.firing && p.energy > 0;
  p.firing = wantFire;
  world.beam.active = false;
  if (wantFire) {
    p.energy = Math.max(0, p.energy - ENERGY.beamDrainPerSec * dt);
    const angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    const cast = castBeam(p.x, p.y, angle, world.mirrors, world.pillars, world.crystals, 6, 1500, world.beam);
    world.beam.active = true;
    world.beam.bounced = cast.bounced;
    const hits = beamEnemies(world.beam.points, world.enemies, cast.bounced, world.beam.enemyHits);
    const dmg = 70 * dt * (cast.bounced ? 1.5 : 1);
    for (let i = 0; i < hits.length; i += 1) {
      const e = hits[i].enemy;
      e.hp -= dmg;
      e.flash = 0.08;
      if (world.rng() < 0.3) {
        spawnParticles(world, e.x, e.y, 1, '#ffe27a', 60);
      }
    }
    for (let i = 0; i < world.beam.crystalHits.length; i += 1) {
      const c = world.beam.crystalHits[i];
      if (c.lit) continue;
      c.charge += (dt / 1.3) * (cast.bounced ? 1.5 : 1);
      if (c.charge >= 1) {
        c.charge = 1;
        c.lit = true;
        c.pulse = 1;
        world.stats.crystalsLit += 1;
        world.score += SCORE.crystal;
        events |= EVENT_CRYSTAL_LIT;
        spawnParticles(world, c.x, c.y, 26, '#8affd8', 160);
      }
    }
  }

  // Enemies: spawn on a timer, chase, and steal light on touch.
  const cfg = roundConfig(world.round);
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.enemies.length < cfg.maxEnemies) {
    world.enemies.push(spawnEnemy(world.rng, world.round, cfg.speedMul, p));
    world.spawnTimer = cfg.spawnIntervalSec * range(world.rng, 0.8, 1.2);
  }
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const e = world.enemies[i];
    updateEnemy(e, dt, p, world.pillars, world.enemies, world.time);
    if (e.hp <= 0) {
      world.enemies.splice(i, 1);
      world.score += e.score;
      world.stats.kills += 1;
      events |= EVENT_KILL;
      spawnParticles(world, e.x, e.y, 18, '#c9a8ff', 150);
      dropOrbs(world, e.x, e.y, e.type === 'brute' ? 2 : 1);
      continue;
    }
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < e.radius + PLAYER.radius && p.invuln <= 0) {
      p.light -= e.touch;
      p.invuln = 1.0;
      world.shake = 7;
      world.flash = 0.25;
      events |= EVENT_HURT;
      spawnParticles(world, p.x, p.y, 14, '#ff5c7a', 130);
      if (p.light <= 0) {
        p.light = 0;
        world.phase = PHASE_OVER;
        world.phaseTimer = 0;
        world.beam.active = false;
        spawnParticles(world, p.x, p.y, 40, '#ffe27a', 220);
        return events | EVENT_OVER;
      }
    }
  }

  // Light orbs: drift, magnet toward the wisp, refill energy on pickup.
  for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
    const o = world.orbs[i];
    o.life -= dt;
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    if (d < ORB.magnetRadius) {
      const pull = 340 * dt;
      o.vx += ((p.x - o.x) / (d || 1)) * pull;
      o.vy += ((p.y - o.y) / (d || 1)) * pull;
    } else {
      o.vx *= Math.max(0, 1 - 2 * dt);
      o.vy *= Math.max(0, 1 - 2 * dt);
    }
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    if (d < ORB.collectRadius) {
      p.energy = Math.min(ENERGY.max, p.energy + ENERGY.orbGain);
      world.orbs.splice(i, 1);
      continue;
    }
    if (o.life <= 0) world.orbs.splice(i, 1);
  }

  // Lit crystals refill the wisp when it stands in their aura.
  for (let i = 0; i < world.crystals.length; i += 1) {
    const c = world.crystals[i];
    if (c.pulse > 0) c.pulse = Math.max(0, c.pulse - dt * 1.5);
    if (!c.lit) continue;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < CRYSTAL.auraRadius) {
      p.energy = Math.min(ENERGY.max, p.energy + ENERGY.crystalRegenPerSec * dt);
      p.light = Math.min(LIGHT.max, p.light + ENERGY.lightRegenPerSec * dt);
    }
  }

  // Round clear: every crystal lit.
  let lit = 0;
  for (let i = 0; i < world.crystals.length; i += 1) if (world.crystals[i].lit) lit += 1;
  if (lit === world.crystals.length && world.crystals.length > 0) {
    const bonus = roundClearBonus(world.round);
    world.score += bonus;
    world.phase = PHASE_ROUND_CLEAR;
    world.phaseTimer = 2.4;
    world.beam.active = false;
    events |= EVENT_ROUND_CLEAR;
  }

  updateParticles(world, dt);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 22);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt);
  return events;
}

function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.max(0, 1 - 2.4 * dt);
    pt.vy *= Math.max(0, 1 - 2.4 * dt);
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
}

// The mirror angle for a fresh placement: the mouse above the wisp makes a
// '/' mirror, below makes '\'; near-horizontal clicks use the toggled angle
// (F flips it), so a flat beam can still turn either way.
function pickMirrorAngle(world, player) {
  const dy = world.player.aimY - player.y;
  if (dy < -12) return -Math.PI / 4;
  if (dy > 12) return Math.PI / 4;
  return world.mirrorAngle;
}

export { segmentClear };
