// HUD and screens, all drawn on the canvas so a screenshot shows exactly
// what a player sees: bars, counts, score, and the title / clear / over cards.
import { FIELD, ARENA, LIGHT, ENERGY, MIRROR } from './config.js';
import { PALETTE } from './palette.js';
import { PHASE_TITLE, PHASE_ROUND_CLEAR, PHASE_OVER } from './world.js';

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 6, y + h / 2 + 0.5);
}

export function drawHUD(ctx, world) {
  const p = world.player;
  let lit = 0;
  for (let i = 0; i < world.crystals.length; i += 1) if (world.crystals[i].lit) lit += 1;

  // Top panel.
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(0, 0, FIELD.width, 56);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 56, FIELD.width, 1);

  bar(ctx, 20, 12, 220, 16, p.light / LIGHT.max, PALETTE.light, `LIGHT ${Math.ceil(p.light)}`);
  bar(ctx, 20, 32, 220, 12, p.energy / ENERGY.max, PALETTE.energy, `ENERGY ${Math.ceil(p.energy)}`);

  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`CRYSTALS  ${lit} / ${world.crystals.length}`, FIELD.width / 2, 20);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`ROUND ${world.round}   ·   SHADOWS DOWN ${world.stats.kills}`, FIELD.width / 2, 42);

  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${world.score}`, FIELD.width - 20, 20);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  const mirrorGlyph = world.mirrorAngle < 0 ? '/' : '\\';
  ctx.fillText(`MIRRORS ${world.mirrors.length}/${MIRROR.max}  ·  NEXT ${mirrorGlyph} (F flips)`, FIELD.width - 20, 42);
  ctx.textAlign = 'left';

  // Bottom hints, only while playing.
  if (world.phase === 'play') {
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(154, 163, 199, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('WASD move  ·  hold mouse / Space: beam  ·  click / Q: mirror (25 energy)  ·  right-click / E: remove  ·  P pause  ·  M mute  ·  R restart', FIELD.width / 2, FIELD.height - 14);
    ctx.textAlign = 'left';
  }

  // Paused stamp.
  if (world.paused) {
    ctx.fillStyle = 'rgba(5, 6, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.subtitle;
    ctx.fillText('Press P to keep playing', FIELD.width / 2, FIELD.height / 2 + 26);
    ctx.textAlign = 'left';
  }
}

function card(ctx, y, title, titleColor, lines, accent) {
  const w = 620;
  const h = 150 + lines.length * 26;
  const x = (FIELD.width - w) / 2;
  ctx.fillStyle = 'rgba(5, 6, 18, 0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, FIELD.width / 2, y + 52);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudText;
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD.width / 2, y + 104 + i * 26);
  });
  ctx.textAlign = 'left';
}

export function drawScreen(ctx, world, best) {
  if (world.phase === PHASE_TITLE) {
    // Darken the live backdrop, then the title card.
    ctx.fillStyle = 'rgba(4, 5, 16, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LUMEN', FIELD.width / 2, 168);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.subtitle;
    ctx.fillText('a game of light and mirrors', FIELD.width / 2, 216);
    const lines = [
      'You are the last wisp of light in a dark grove.',
      'Bend your beam off mirrors to wake the crystals —',
      'a reflected beam hits 50% harder. Shadows hunt you.',
      '',
      'WASD move  ·  hold mouse / Space: beam  ·  click / Q: place mirror',
      'right-click / E: remove mirror  ·  F: flip mirror  ·  R: restart',
    ];
    card(ctx, 268, 'KEEPER OF THE LAST LIGHT', PALETTE.title, lines, PALETTE.beamGlow);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.beamGlow;
    ctx.fillText('Click or press Enter to begin', FIELD.width / 2, 596);
    if (best > 0) {
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.hudDim;
      ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 626);
    }
    ctx.textAlign = 'left';
  } else if (world.phase === PHASE_ROUND_CLEAR) {
    ctx.fillStyle = 'rgba(4, 5, 16, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    card(ctx, 220, `ROUND ${world.round} CLEAR`, PALETTE.crystalLit, [
      `All ${world.crystals.length} crystals are lit. The grove glows again.`,
      `Score: ${world.score}`,
      'The dark comes back stronger…',
    ], PALETTE.crystalLit);
  } else if (world.phase === PHASE_OVER) {
    ctx.fillStyle = 'rgba(10, 4, 10, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    card(ctx, 220, 'THE LIGHT GOES OUT', PALETTE.danger, [
      `The shadows take the grove. Round ${world.round}, score ${world.score}.`,
      `Crystals lit: ${world.stats.crystalsLit}  ·  Shadows down: ${world.stats.kills}`,
      '',
      'Press R or click to play again',
    ], PALETTE.danger);
  }
}

// One-line status for the screen-reader live region (never shown).
export function statusText(world) {
  if (world.phase === PHASE_TITLE) return 'LUMEN. Click or press Enter to begin.';
  if (world.phase === PHASE_OVER) return `Game over. Score ${world.score}. Press R to play again.`;
  if (world.phase === PHASE_ROUND_CLEAR) return `Round ${world.round} clear. Score ${world.score}.`;
  let lit = 0;
  for (let i = 0; i < world.crystals.length; i += 1) if (world.crystals[i].lit) lit += 1;
  return `Round ${world.round}. Crystals ${lit} of ${world.crystals.length}. Score ${world.score}. Light ${Math.ceil(world.player.light)}.`;
}

export { ARENA };
