// LUMEN boot: one canvas, one world, one fixed-step loop. The sim runs at a
// fixed 1/60s step and rendering is decoupled from it, so the game plays the
// same on any display. With ?shot=start|play|tactics|end&seed=N the game
// stages that scene deterministically, renders it twice, freezes, and sets
// window.__shotReady for the screenshot tool.
import { STEP, FIELD, EVENT_CRYSTAL_LIT, EVENT_ROUND_CLEAR, EVENT_OVER, EVENT_HURT, EVENT_KILL, EVENT_MIRROR } from './config.js';
import { createWorld, startGame, step, PHASE_TITLE, PHASE_PLAY, PHASE_ROUND_CLEAR, PHASE_OVER } from './world.js';
import { drawWorld } from './render.js';
import { drawHUD, drawScreen, statusText } from './hud.js';
import { createInput } from './input.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
canvas.width = FIELD.width;
canvas.height = FIELD.height;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7) >>> 0;

const world = createWorld(seed);
const sound = createSound();
const input = createInput(canvas, () => sound.ensure());

window.__errors = [];
window.__lumen = { world };
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error));
});

let lastStatus = '';
function announce() {
  const text = statusText(world);
  if (text !== lastStatus) {
    lastStatus = text;
    if (statusEl) statusEl.textContent = text;
  }
}

function render() {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  drawWorld(ctx, world);
  drawHUD(ctx, world);
  drawScreen(ctx, world, world.best);
  announce();
}

function handleEvents(events) {
  if (events & EVENT_CRYSTAL_LIT) sound.chime();
  if (events & EVENT_KILL) sound.pop();
  if (events & EVENT_HURT) sound.hurt();
  if (events & EVENT_MIRROR) sound.place();
  if (events & EVENT_ROUND_CLEAR) sound.fanfare();
  if (events & EVENT_OVER) {
    sound.beamStop();
    if (world.score > world.best) world.best = world.score;
  }
}

if (shotName) {
  // Screenshot mode: stage the scene, render it twice (the brief's rule),
  // freeze, and signal the capture tool. No loop, no audio, no input.
  const staged = stageShot(shotName, world);
  world.best = staged.best;
  render();
  requestAnimationFrame(() => {
    render();
    window.__shotReady = true;
  });
} else {
  // Live mode.
  let last = performance.now();
  let accumulator = 0;
  let beamWasOn = false;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    const frameInput = input.read();

    // Global keys, handled here (not in the sim).
    if (frameInput.mute) {
      frameInput.mute = false;
      const muted = sound.toggleMuted();
      if (statusEl) statusEl.textContent = muted ? 'Sound off.' : 'Sound on.';
    }
    if (frameInput.restart) {
      frameInput.restart = false;
      sound.beamStop();
      startGame(world);
    }
    if (frameInput.pause) {
      frameInput.pause = false;
      if (world.phase === PHASE_PLAY) world.paused = !world.paused;
    }
    if (frameInput.start) {
      frameInput.start = false;
      if (world.phase === PHASE_TITLE || world.phase === PHASE_OVER) {
        sound.click();
        startGame(world);
        // The click that starts the game must not also place a mirror.
        frameInput.place = false;
        frameInput.remove = false;
      } else if (world.phase === PHASE_ROUND_CLEAR) {
        // Skip the clear card early.
        world.phaseTimer = 0;
      }
    }

    if (!world.paused) {
      accumulator += elapsed;
      let guard = 0;
      while (accumulator >= STEP && guard < 5) {
        const events = step(world, frameInput, STEP);
        handleEvents(events);
        accumulator -= STEP;
        guard += 1;
      }
      if (guard >= 5) accumulator = 0;
    }

    // Beam hum follows the beam.
    if (world.player.firing && !beamWasOn) sound.beamStart();
    if (!world.player.firing && beamWasOn) sound.beamStop();
    beamWasOn = world.player.firing;

    render();
  }
  requestAnimationFrame(frame);
}
