// The arena floor: one seeded offscreen canvas, painted once at world creation
// and blitted every frame, so the floor costs a single drawImage per frame.
import { mulberry32, range } from './random.js';
import { FIELD, ARENA } from './config.js';

export function makeFloorTexture(seed) {
  const rng = mulberry32(seed);
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(
    FIELD.width / 2, FIELD.height / 2, 80,
    FIELD.width / 2, FIELD.height / 2, 820,
  );
  grad.addColorStop(0, '#10142f');
  grad.addColorStop(1, '#080a1e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Faint stone tiles inside the arena.
  ctx.strokeStyle = 'rgba(120, 140, 220, 0.05)';
  ctx.lineWidth = 1;
  const tile = 92;
  for (let x = ARENA.x; x <= ARENA.x + ARENA.width; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, ARENA.y);
    ctx.lineTo(x, ARENA.y + ARENA.height);
    ctx.stroke();
  }
  for (let y = ARENA.y; y <= ARENA.y + ARENA.height; y += tile) {
    ctx.beginPath();
    ctx.moveTo(ARENA.x, y);
    ctx.lineTo(ARENA.x + ARENA.width, y);
    ctx.stroke();
  }

  // Dust motes: tiny dim stars that make the dark readable.
  for (let i = 0; i < 260; i += 1) {
    const x = range(rng, 0, FIELD.width);
    const y = range(rng, 0, FIELD.height);
    const r = range(rng, 0.5, 1.8);
    const a = range(rng, 0.05, 0.22);
    ctx.fillStyle = `rgba(180, 200, 255, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few hairline cracks, so the floor is not a flat void.
  ctx.strokeStyle = 'rgba(90, 110, 200, 0.08)';
  for (let i = 0; i < 14; i += 1) {
    let x = range(rng, ARENA.x, ARENA.x + ARENA.width);
    let y = range(rng, ARENA.y, ARENA.y + ARENA.height);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s += 1) {
      x += range(rng, -46, 46);
      y += range(rng, -30, 30);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvas;
}
