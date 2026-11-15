// Procedural sound only: every effect is an oscillator (or a short noise burst)
// through WebAudio, so the game ships no audio files and makes no requests.
// The AudioContext is created lazily on the first user gesture (autoplay policy);
// in headless shot mode there is no gesture and every call is a safe no-op.
export function createSound() {
  let ctx = null;
  let master = null;
  let beamNodes = null;
  let muted = false;

  function ensure() {
    if (ctx || typeof window === 'undefined') return ctx;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // Sound must never break the game.
    }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure()) return;
    try {
      const now = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
    } catch {
      // Sound must never break the game.
    }
  }

  return {
    ensure,
    get muted() { return muted; },
    setMuted(value) {
      muted = !!value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    toggleMuted() {
      this.setMuted(!muted);
      return muted;
    },
    beamStart() {
      if (!ensure() || beamNodes) return;
      try {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = 82;
        osc2.type = 'sine';
        osc2.frequency.value = 164;
        gain.gain.value = 0.045;
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(master);
        osc.start();
        osc2.start();
        beamNodes = { osc, osc2, gain };
      } catch {
        beamNodes = null;
      }
    },
    beamStop() {
      if (!beamNodes) return;
      try {
        beamNodes.osc.stop();
        beamNodes.osc2.stop();
      } catch {
        // Already stopped.
      }
      beamNodes = null;
    },
    chime() {
      tone(880, 0.5, 'sine', 0.22);
      tone(1318, 0.7, 'sine', 0.14);
    },
    pop() {
      tone(320, 0.16, 'triangle', 0.2, 90);
      noise(0.08, 0.1, 2400);
    },
    hurt() {
      tone(160, 0.25, 'sawtooth', 0.22, 55);
      noise(0.12, 0.12, 900);
    },
    place() {
      tone(520, 0.12, 'sine', 0.16, 780);
    },
    remove() {
      tone(420, 0.1, 'sine', 0.12, 240);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.35, 'triangle', 0.18), i * 90);
      });
    },
    click() {
      tone(700, 0.06, 'sine', 0.1);
    },
  };
}
