// The beam: a ray from the wisp that reflects off mirrors, stops at pillars,
// passes through crystals (charging them) and hurts every shadow it crosses.
// All geometry is plain 2D math, no allocations in the hot path beyond the
// small result object the sim reuses.

// Ray vs circle. Returns the distance along the ray to the first hit, or Infinity.
function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const lx = cx - ox;
  const ly = cy - oy;
  const tca = lx * dx + ly * dy;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return Infinity;
  const thc = Math.sqrt(r2 - d2);
  const t0 = tca - thc;
  if (t0 >= 0) return t0;
  return tca + thc;
}

// Ray vs segment. Returns { t, u } (distance along the ray, fraction along the
// segment) or null when the ray misses or runs parallel.
function raySegment(ox, oy, dx, dy, x1, y1, x2, y2) {
  const ex = x2 - x1;
  const ey = y2 - y1;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-9) return null;
  const rx = x1 - ox;
  const ry = y1 - oy;
  const t = (rx * ey - ry * ex) / denom;
  const u = (rx * dy - ry * dx) / denom;
  if (t < 0 || u < 0 || u > 1) return null;
  return { t, u };
}

// Distance from a point to a segment (for beam-vs-enemy hits).
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

// Cast the beam. `result` is reused by the caller: { points: [{x,y}...],
// crystalHits: [crystal...], bounced: bool }. Enemies are checked separately
// against the returned polyline, so one beam can hit many shadows at once.
export function castBeam(ox, oy, angle, mirrors, pillars, crystals, maxBounces, maxLength, result) {
  const points = result.points;
  points.length = 0;
  const crystalHits = result.crystalHits;
  crystalHits.length = 0;
  points.push({ x: ox, y: oy });
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  let px = ox;
  let py = oy;
  let remaining = maxLength;
  let bounced = false;
  const seenCrystals = new Set();

  for (let bounce = 0; bounce <= maxBounces; bounce += 1) {
    let bestT = remaining;
    let bestMirror = null;
    let bestPillar = null;
    for (let i = 0; i < mirrors.length; i += 1) {
      const m = mirrors[i];
      const hit = raySegment(px, py, dx, dy, m.x1, m.y1, m.x2, m.y2);
      if (hit && hit.t < bestT) {
        bestT = hit.t;
        bestMirror = m;
        bestPillar = null;
      }
    }
    for (let i = 0; i < pillars.length; i += 1) {
      const p = pillars[i];
      const t = rayCircle(px, py, dx, dy, p.x, p.y, p.radius);
      if (t < bestT) {
        bestT = t;
        bestMirror = null;
        bestPillar = p;
      }
    }
    // Crystals along this leg: the beam passes through them and charges them.
    for (let i = 0; i < crystals.length; i += 1) {
      const c = crystals[i];
      if (c.lit || seenCrystals.has(c)) continue;
      const t = rayCircle(px, py, dx, dy, c.x, c.y, c.radius + 6);
      if (t <= bestT) {
        seenCrystals.add(c);
        crystalHits.push(c);
      }
    }
    const nx = px + dx * bestT;
    const ny = py + dy * bestT;
    points.push({ x: nx, y: ny });
    remaining -= bestT;
    if (remaining <= 0 || !bestMirror) return { bounced, length: maxLength - remaining };
    // Reflect: d' = d - 2(d.n)n, n the mirror's unit normal.
    const m = bestMirror;
    const tx = m.x2 - m.x1;
    const ty = m.y2 - m.y1;
    const tl = Math.hypot(tx, ty) || 1;
    let nx2 = -ty / tl;
    let ny2 = tx / tl;
    const dot = dx * nx2 + dy * ny2;
    dx = dx - 2 * dot * nx2;
    dy = dy - 2 * dot * ny2;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    px = nx + dx * 0.6;
    py = ny + dy * 0.6;
    bounced = true;
  }
  return { bounced, length: maxLength - remaining };
}

// Which enemies does the beam polyline cross? Fills `out` (reused array) with
// { enemy, bounced } and returns it. A reflected beam hits harder (see config).
export function beamEnemies(points, enemies, bounced, out) {
  out.length = 0;
  for (let i = 0; i < enemies.length; i += 1) {
    const e = enemies[i];
    if (e.hp <= 0) continue;
    for (let s = 0; s < points.length - 1; s += 1) {
      const a = points[s];
      const b = points[s + 1];
      if (pointSegmentDistance(e.x, e.y, a.x, a.y, b.x, b.y) < e.radius + 4) {
        out.push({ enemy: e, bounced });
        break;
      }
    }
  }
  return out;
}

// Is the straight segment from (x1,y1) to (x2,y2) clear of every pillar?
// The autopilot uses this to decide whether to shoot straight or go around.
export function segmentClear(x1, y1, x2, y2, pillars) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return true;
  const ux = dx / len;
  const uy = dy / len;
  for (let i = 0; i < pillars.length; i += 1) {
    const p = pillars[i];
    if (rayCircle(x1, y1, ux, uy, p.x, p.y, p.radius + 4) < len) return false;
  }
  return true;
}
