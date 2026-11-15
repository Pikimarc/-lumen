// Keyboard + mouse, reduced to one plain object the fixed-step sim reads.
// The object is reused every step (no per-frame allocation): the sim consumes
// the edge flags (place, remove, toggleMirror, start) by clearing them.
// Mouse coordinates are converted from page space into the 1280x720 field.
import { FIELD } from './config.js';

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas, onFirstGesture) {
  const keys = new Set();
  const mouse = { x: FIELD.width / 2, y: FIELD.height / 2, down: false };
  const frame = {
    moveX: 0, moveY: 0,
    aimX: FIELD.width / 2, aimY: FIELD.height / 2 - 120,
    firing: false,
    place: false, remove: false, toggleMirror: false, start: false,
    pause: false, mute: false, restart: false,
  };
  let gestureSeen = false;
  const gesture = () => {
    if (!gestureSeen) {
      gestureSeen = true;
      if (onFirstGesture) onFirstGesture();
    }
  };

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    gesture();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyQ') frame.place = true;
    if (event.code === 'KeyE') frame.remove = true;
    if (event.code === 'KeyF') frame.toggleMirror = true;
    if (event.code === 'Enter' || event.code === 'Space') frame.start = true;
    if (event.code === 'KeyP') frame.pause = true;
    if (event.code === 'KeyM') frame.mute = true;
    if (event.code === 'KeyR') frame.restart = true;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  // Left button: hold to fire the beam. A quick press-and-release (under
  // 250ms, barely moved) is a click and places a mirror instead — so starting
  // to fire never spends energy on a mirror you did not ask for.
  let pressStart = 0;
  let pressX = 0;
  let pressY = 0;
  canvas.addEventListener('mousedown', (event) => {
    gesture();
    const p = toField(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    if (event.button === 0) {
      mouse.down = true;
      pressStart = performance.now();
      pressX = p.x;
      pressY = p.y;
      frame.start = true; // a click also starts the game from the title / over screen
    } else if (event.button === 2) {
      frame.remove = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) {
      mouse.down = false;
      const dur = performance.now() - pressStart;
      const moved = Math.hypot(mouse.x - pressX, mouse.y - pressY);
      if (dur < 250 && moved < 12) frame.place = true;
    }
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function read() {
    let mx = 0;
    let my = 0;
    keys.forEach((code) => {
      const dir = MOVE_KEYS[code];
      if (dir) {
        mx += dir[0];
        my += dir[1];
      }
    });
    const len = Math.hypot(mx, my);
    frame.moveX = len > 0 ? mx / len : 0;
    frame.moveY = len > 0 ? my / len : 0;
    frame.aimX = mouse.x;
    frame.aimY = mouse.y;
    frame.firing = mouse.down || keys.has('Space');
    return frame;
  }

  return { read, frame, mouse };
}
