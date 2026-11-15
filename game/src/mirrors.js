// Mirrors: straight silver segments the beam bounces off. A mirror is placed
// at the mouse with a 45-degree diagonal; its angle is the tangent of the line.
// '/' is tangent -45 degrees, '\' is tangent +45 degrees.
import { MIRROR } from './config.js';

let nextId = 1;

export function makeMirror(x, y, angle) {
  const half = MIRROR.length / 2;
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  return {
    id: nextId,
    x, y, angle,
    x1: x - cx * half, y1: y - cy * half,
    x2: x + cx * half, y2: y + cy * half,
  };
}

export function placeMirror(mirrors, x, y, angle) {
  if (mirrors.length >= MIRROR.max) return null;
  const mirror = makeMirror(x, y, angle);
  nextId += 1;
  mirrors.push(mirror);
  return mirror;
}

// Remove the mirror nearest (x, y) within radius, or null.
export function removeMirrorAt(mirrors, x, y, radius) {
  let best = -1;
  let bestD = radius;
  for (let i = 0; i < mirrors.length; i += 1) {
    const m = mirrors[i];
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best === -1) return null;
  return mirrors.splice(best, 1)[0];
}

// The two diagonals a mirror can take. The wisp's next mirror flips between
// them with F; a click near-horizontal uses the current one.
export const MIRROR_SLASH = -Math.PI / 4; // '/'
export const MIRROR_BACKSLASH = Math.PI / 4; // '\'

export function flipMirrorAngle(angle) {
  return angle === MIRROR_SLASH ? MIRROR_BACKSLASH : MIRROR_SLASH;
}
