// Deterministic screenshot scenes. Each one plays the real rules forward from
// a fresh world for a fixed number of steps, so the frame is what a short game
// really looks like and the same seed always gives the same frame. The
// autopilot steers the wisp: it walks to a crystal, shoots it, and goes around
// a pillar (or bends the beam off a mirror) when the straight shot is blocked.
import { STEP, ARENA, FIELD, EVENT_OVER, ENERGY } from './config.js';
import { startGame, resetWorld, step, PHASE_TITLE, PHASE_PLAY, PHASE_OVER } from './world.js';
import { segmentClear } from './beam.js';
import { MIRROR_SLASH, MIRROR_BACKSLASH, placeMirror } from './mirrors.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 22;
const TACTICS_SECONDS = 1.8;
const END_LIMIT_SECONDS = 150;

function blankInput() {
  return {
    moveX: 0, moveY: 0,
    aimX: FIELD.width / 2, aimY: FIELD.height / 2,
    firing: false, place: false, remove: false, toggleMirror: false,
  };
}

function nearestUnlitCrystal(world) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < world.crystals.length; i += 1) {
    const c = world.crystals[i];
    if (c.lit) continue;
    const d = Math.hypot(c.x - world.player.x, c.y - world.player.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// Find a point at `radius` around the crystal with a clear beam to it.
function findFlank(world, crystal, radius) {
  for (let a = 0; a < 8; a += 1) {
    const angle = (a / 8) * Math.PI * 2;
    const x = crystal.x + Math.cos(angle) * radius;
    const y = crystal.y + Math.sin(angle) * radius;
    if (x < ARENA.x + 30 || x > ARENA.x + ARENA.width - 30) continue;
    if (y < ARENA.y + 30 || y > ARENA.y + ARENA.height - 30) continue;
    if (segmentClear(x, y, crystal.x, crystal.y, world.pillars)) return { x, y };
  }
  return null;
}

// A mirror route around a pillar: stand at P, put a mirror at M, fire at M,
// and the beam turns 90 degrees onto the crystal. '/' turns a rightward beam
// up, '\' turns it down. Returns { px, py, mx, my, angle } or null.
function findMirrorRoute(world, crystal) {
  const routes = [
    { mx: crystal.x, my: crystal.y - 260, px: crystal.x - 320, py: crystal.y - 260, angle: MIRROR_BACKSLASH },
    { mx: crystal.x, my: crystal.y + 260, px: crystal.x - 320, py: crystal.y + 260, angle: MIRROR_SLASH },
  ];
  for (let i = 0; i < routes.length; i += 1) {
    const r = routes[i];
    if (r.px < ARENA.x + 20 || r.px > ARENA.x + ARENA.width - 20) continue;
    if (r.py < ARENA.y + 20 || r.py > ARENA.y + ARENA.height - 20) continue;
    if (r.mx < ARENA.x + 20 || r.mx > ARENA.x + ARENA.width - 20) continue;
    if (r.my < ARENA.y + 20 || r.my > ARENA.y + ARENA.height - 20) continue;
    if (!segmentClear(r.px, r.py, r.mx, r.my, world.pillars)) continue;
    if (!segmentClear(r.mx, r.my, crystal.x, crystal.y, world.pillars)) continue;
    return r;
  }
  return null;
}

function moveToward(input, fromX, fromY, toX, toY, stopDist) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const d = Math.hypot(dx, dy);
  if (d <= stopDist) return false;
  input.moveX = dx / d;
  input.moveY = dy / d;
  return true;
}

// The playing autopilot: chase the nearest unlit crystal, shoot it, and use
// a mirror when a pillar blocks the straight shot.
function autopilot(world) {
  const input = blankInput();
  const p = world.player;
  const target = nearestUnlitCrystal(world);
  if (!target) return input;
  const d = Math.hypot(target.x - p.x, target.y - p.y);
  const direct = segmentClear(p.x, p.y, target.x, target.y, world.pillars);

  if (direct) {
    if (d > 260) {
      moveToward(input, p.x, p.y, target.x, target.y, 260);
    } else {
      // Hold at range and strafe slowly so shadows cannot sit on the wisp.
      const a = world.time * 0.9;
      input.moveX = Math.cos(a) * 0.4;
      input.moveY = Math.sin(a) * 0.4;
    }
    input.aimX = target.x;
    input.aimY = target.y;
    input.firing = d < 560 && p.energy > 12;
    return input;
  }

  // Blocked: try a mirror route first (it shows the game's signature move),
  // then fall back to walking around the pillar to a clear angle.
  if (p.energy > 55 && world.mirrors.length < 2) {
    const route = findMirrorRoute(world, target);
    if (route) {
      const arrived = !moveToward(input, p.x, p.y, route.px, route.py, 30);
      if (arrived) {
        const hasMirror = world.mirrors.some((m) => Math.hypot(m.x - route.mx, m.y - route.my) < 20);
        if (!hasMirror) {
          if (world.mirrorAngle !== route.angle) input.toggleMirror = true;
          input.aimX = route.mx;
          input.aimY = route.my;
          input.place = true;
        } else {
          input.aimX = route.mx;
          input.aimY = route.my;
          input.firing = p.energy > 12;
        }
      }
      return input;
    }
  }
  const flank = findFlank(world, target, 300);
  if (flank) {
    const arrived = !moveToward(input, p.x, p.y, flank.x, flank.y, 30);
    if (arrived) {
      input.aimX = target.x;
      input.aimY = target.y;
      input.firing = p.energy > 12;
    }
    return input;
  }
  // No clear angle found: walk at the crystal anyway (the beam may clear
  // once the wisp moves past the pillar).
  moveToward(input, p.x, p.y, target.x, target.y, 240);
  input.aimX = target.x;
  input.aimY = target.y;
  input.firing = p.energy > 12;
  return input;
}

/**
 * Stage the named scene (start, play, tactics, end; any other name is start)
 * and return the screen the renderer should draw over the staged world.
 */
export function stageShot(name, world) {
  resetWorld(world, world.seed);
  if (name !== 'play' && name !== 'end' && name !== 'tactics') {
    // Title over a living backdrop: a few shadows drift toward the centre.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      step(world, blankInput());
    }
    world.phase = PHASE_TITLE;
    return { screen: PHASE_TITLE, best: 0 };
  }

  if (name === 'tactics') {
    // A scripted mirror shot: the wisp fires right, a '/' mirror turns the
    // beam up, and it wakes the crystal above. Pillars that would block the
    // two legs are moved out of the way for this staged layout.
    startGame(world);
    const mx = 640;
    const my = 440;
    const cx = 640;
    const cy = 180;
    const px = 320;
    const py = 440;
    world.pillars = world.pillars.filter((pillar) => {
      const d1 = pointSegmentDistance(pillar.x, pillar.y, px, py, mx, my);
      const d2 = pointSegmentDistance(pillar.x, pillar.y, mx, my, cx, cy);
      return d1 > pillar.radius + 70 && d2 > pillar.radius + 70;
    });
    const crystal = world.crystals[0];
    crystal.x = cx;
    crystal.y = cy;
    crystal.charge = 0;
    crystal.lit = false;
    world.player.x = px;
    world.player.y = py;
    world.player.vx = 0;
    world.player.vy = 0;
    world.player.energy = 100;
    world.mirrorAngle = MIRROR_SLASH;
    // Place the mirror directly (the spawn protection from startGame would
    // swallow an input-flag placement) and pay its energy cost, exactly as
    // a real player placing it would.
    world.ignorePlaceSteps = 0;
    const placed = placeMirror(world.mirrors, mx, my, MIRROR_SLASH);
    if (placed) world.player.energy -= ENERGY.mirrorCost;
    // Fire at the mirror, then step until the crystal is waking.
    for (let i = 0; i < TACTICS_SECONDS / STEP; i += 1) {
      const fire = blankInput();
      fire.aimX = mx;
      fire.aimY = my;
      fire.firing = true;
      step(world, fire);
      if (world.phase === PHASE_OVER) break;
    }
    return { screen: PHASE_PLAY, best: world.score };
  }

  if (name === 'end') {
    // A hurried wisp that stands still: the shadows close in and take it.
    startGame(world);
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      const events = step(world, blankInput());
      if (events & EVENT_OVER) break;
    }
    world.phase = PHASE_OVER;
    return { screen: PHASE_OVER, best: world.score };
  }

  // play: the autopilot plays a real round for 22 seconds.
  startGame(world);
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    const events = step(world, autopilot(world));
    if (events & EVENT_OVER) break;
  }
  if (world.phase === PHASE_OVER) return { screen: PHASE_OVER, best: world.score };
  return { screen: PHASE_PLAY, best: world.score };
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const ex = x2 - x1;
  const ey = y2 - y1;
  const len2 = ex * ex + ey * ey;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, ((px - x1) * ex + (py - y1) * ey) / len2));
  const cx = x1 + t * ex;
  const cy = y1 + t * ey;
  return Math.hypot(px - cx, py - cy);
}
