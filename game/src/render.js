// Rendering: everything is drawn on one canvas, additive glow for light,
// soft shadows for the dark. The floor is a pre-painted texture (one drawImage).
// `view` carries the shake offset so a hit rattles the whole scene.
import { FIELD, ARENA, PLAYER, CRYSTAL, BEAM, ENEMY } from './config.js';
import { PALETTE } from './palette.js';

function glowCircle(ctx, x, y, radius, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawWorld(ctx, world) {
  const shake = world.shake;
  const sx = shake > 0.2 ? (Math.sin(world.time * 91) * shake) : 0;
  const sy = shake > 0.2 ? (Math.cos(world.time * 83) * shake) : 0;
  ctx.save();
  ctx.translate(sx, sy);

  // Floor.
  if (world.floor) ctx.drawImage(world.floor, 0, 0);

  // Arena wall.
  ctx.strokeStyle = PALETTE.wall;
  ctx.lineWidth = 10;
  ctx.strokeRect(ARENA.x - 5, ARENA.y - 5, ARENA.width + 10, ARENA.height + 10);
  ctx.strokeStyle = PALETTE.wallEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(ARENA.x - 5, ARENA.y - 5, ARENA.width + 10, ARENA.height + 10);

  // Pillars: dark stone that swallows the beam.
  for (let i = 0; i < world.pillars.length; i += 1) {
    const p = world.pillars[i];
    ctx.fillStyle = PALETTE.pillarCore;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.pillarRim;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(190, 170, 255, 0.10)';
    ctx.beginPath();
    ctx.arc(p.x - p.radius * 0.3, p.y - p.radius * 0.3, p.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crystals: charge ring, then a glow that grows as they charge; lit ones
  // blaze and paint their aura on the floor.
  for (let i = 0; i < world.crystals.length; i += 1) {
    const c = world.crystals[i];
    if (c.lit) {
      glowCircle(ctx, c.x, c.y, CRYSTAL.auraRadius, 'rgba(110, 255, 210, 0.10)', 1);
      glowCircle(ctx, c.x, c.y, 70 + c.pulse * 30, '#5affc8', 0.5);
    } else if (c.charge > 0) {
      glowCircle(ctx, c.x, c.y, 52, '#7ef0e0', 0.25 + c.charge * 0.4);
    }
    drawCrystal(ctx, c);
  }

  // Mirrors: silver lines with a cold glow.
  for (let i = 0; i < world.mirrors.length; i += 1) {
    const m = world.mirrors[i];
    ctx.strokeStyle = PALETTE.mirrorGlow;
    ctx.lineWidth = 7;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(m.x2, m.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = PALETTE.mirror;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(m.x2, m.y2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.mirror;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Light orbs.
  for (let i = 0; i < world.orbs.length; i += 1) {
    const o = world.orbs[i];
    glowCircle(ctx, o.x, o.y, 18, PALETTE.orbGlow, 1);
    ctx.fillStyle = PALETTE.orb;
    ctx.beginPath();
    ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shadows: dark blobs with glowing eyes, flashing white when the beam bites.
  for (let i = 0; i < world.enemies.length; i += 1) {
    const e = world.enemies[i];
    const def = ENEMY[e.type];
    const wob = Math.sin(world.time * 3 + e.wobble) * 2;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#160b2e';
    ctx.beginPath();
    ctx.arc(e.x, e.y + wob * 0.3, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Eyes track the wisp.
    const dx = world.player.x - e.x;
    const dy = world.player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ex = (dx / d) * 4;
    const ey = (dy / d) * 4;
    ctx.fillStyle = def.eye;
    ctx.beginPath();
    ctx.arc(e.x - e.radius * 0.36 + ex, e.y - e.radius * 0.2 + ey, 3, 0, Math.PI * 2);
    ctx.arc(e.x + e.radius * 0.36 + ex, e.y - e.radius * 0.2 + ey, 3, 0, Math.PI * 2);
    ctx.fill();
    // Health pips for hurt brutes and swifts.
    if (e.hp < e.maxHp) {
      const w = e.radius * 2;
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
      ctx.fillStyle = def.color;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * frac, 4);
    }
  }

  // The beam: a wide soft glow, then a bright core. It is drawn under the
  // wisp so the wisp reads as the source of the light.
  if (world.beam.active && world.beam.points.length > 1) {
    drawBeam(ctx, world.beam.points);
  }

  // Particles (additive sparks).
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < world.particles.length; i += 1) {
    const pt = world.particles[i];
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // The wisp: a bright core with a breathing halo and a tiny orbiting spark.
  const p = world.player;
  const breathe = 1 + Math.sin(world.time * 4) * 0.08;
  glowCircle(ctx, p.x, p.y, 52 * breathe, 'rgba(255, 220, 110, 0.35)', 1);
  if (p.invuln > 0 && Math.floor(world.time * 14) % 2 === 0) {
    // Blink while invulnerable after a hit.
    ctx.globalAlpha = 0.45;
  }
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.playerRing;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const sparkA = world.time * 2.4;
  ctx.fillStyle = PALETTE.playerGlow;
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(sparkA) * 22, p.y + Math.sin(sparkA) * 22, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Damage flash.
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 90, ${(world.flash * 0.5).toFixed(3)})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  // Vignette: the dark closes in at the edges of the frame.
  const vig = ctx.createRadialGradient(
    FIELD.width / 2, FIELD.height / 2, 320,
    FIELD.width / 2, FIELD.height / 2, 780,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(2,3,12,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  ctx.restore();
}

function drawBeam(ctx, points) {
  ctx.globalCompositeOperation = 'lighter';
  // Wide soft glow.
  ctx.strokeStyle = PALETTE.beamOuter;
  ctx.lineWidth = 16;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  // Mid glow.
  ctx.strokeStyle = 'rgba(255, 215, 94, 0.55)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  // Bright core.
  ctx.strokeStyle = PALETTE.beamCore;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

function drawCrystal(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  const glow = c.lit ? PALETTE.crystalLit : PALETTE.crystal;
  const core = c.lit ? '#eafff6' : PALETTE.crystalCore;
  ctx.rotate(Math.PI / 4);
  const s = c.radius * (0.9 + c.charge * 0.15 + (c.lit ? c.pulse * 0.2 : 0));
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-s * 0.55, -s * 0.55, s * 1.1, s * 1.1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = core;
  ctx.fillRect(-s * 0.28, -s * 0.28, s * 0.56, s * 0.56);
  ctx.restore();
  if (!c.lit && c.charge > 0) {
    // Charge ring.
    ctx.strokeStyle = PALETTE.crystal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.charge);
    ctx.stroke();
  }
}
