import { clamp } from './util.js';

export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this.noiseBuffer = null;
    this.ambience = null;
    this.sprint = null;
    this.stepTimer = 0;
    this.lastCheer = 0;
  }

  async unlock() {
    if (this.started) {
      if (this.context?.state === 'suspended') await this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.makeNoise(2.5);
      this.startAmbience();
      this.started = true;
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  makeNoise(seconds) {
    const ctx = this.context;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  startAmbience() {
    const ctx = this.context;
    if (!ctx || !this.noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    filter.Q.value = 0.4;

    const gain = ctx.createGain();
    gain.gain.value = 0.028;

    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.ambience = { source, gain };

    const crowd = ctx.createBufferSource();
    crowd.buffer = this.noiseBuffer;
    crowd.loop = true;
    const crowdFilter = ctx.createBiquadFilter();
    crowdFilter.type = 'bandpass';
    crowdFilter.frequency.value = 1250;
    crowdFilter.Q.value = 0.5;
    const crowdGain = ctx.createGain();
    crowdGain.gain.value = 0.008;
    crowd.connect(crowdFilter).connect(crowdGain).connect(this.master);
    crowd.start();
    this.crowd = { source: crowd, gain: crowdGain };
  }

  startSprintLoop() {
    const ctx = this.context;
    if (!ctx || !this.noiseBuffer || this.sprint) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.sprint = { source, gain, filter };
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, now, 0.04);
  }

  setSprint(active) {
    if (!this.started) return;
    this.startSprintLoop();
    if (!this.sprint) return;
    const now = this.context.currentTime;
    this.sprint.gain.gain.setTargetAtTime(active ? 0.055 : 0, now, active ? 0.05 : 0.12);
    this.sprint.filter.frequency.setTargetAtTime(active ? 1550 : 850, now, 0.2);
  }

  setCrowd(energy) {
    if (!this.started || !this.crowd) return;
    const now = this.context.currentTime;
    this.crowd.gain.gain.setTargetAtTime(0.007 + clamp(energy, 0, 1) * 0.02, now, 0.4);
  }

  tone({ frequency = 440, endFrequency = frequency, duration = 0.12, type = 'sine', gain = 0.12, delay = 0, attack = 0.005 }) {
    if (!this.started) return;
    const ctx = this.context;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency !== frequency) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    }
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  noiseBurst({ duration = 0.15, frequency = 900, q = 0.6, gain = 0.06, type = 'bandpass', delay = 0 }) {
    if (!this.started || !this.noiseBuffer) return;
    const ctx = this.context;
    const now = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(env).connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.05);
  }

  ui() {
    this.tone({ frequency: 520, endFrequency: 660, duration: 0.07, type: 'triangle', gain: 0.05 });
  }

  countdown(isGo) {
    if (isGo) {
      this.tone({ frequency: 660, endFrequency: 990, duration: 0.24, type: 'square', gain: 0.08 });
      this.noiseBurst({ duration: 0.28, frequency: 1900, gain: 0.06, type: 'highpass' });
    } else {
      this.tone({ frequency: 330, duration: 0.1, type: 'square', gain: 0.055 });
    }
  }

  jump() {
    this.noiseBurst({ duration: 0.18, frequency: 720, q: 1.4, gain: 0.05 });
    this.tone({ frequency: 260, endFrequency: 420, duration: 0.12, type: 'triangle', gain: 0.035 });
  }

  slide() {
    this.noiseBurst({ duration: 0.3, frequency: 480, q: 0.5, gain: 0.055, type: 'lowpass' });
  }

  lane() {
    this.noiseBurst({ duration: 0.09, frequency: 1200, q: 1.1, gain: 0.026 });
  }

  pickup(combo = 0) {
    const base = 720 + Math.min(combo, 4) * 50;
    this.tone({ frequency: base, endFrequency: base * 1.5, duration: 0.1, type: 'sine', gain: 0.075 });
    this.tone({ frequency: base * 1.5, endFrequency: base * 2, duration: 0.13, type: 'triangle', gain: 0.045, delay: 0.045 });
  }

  clear() {
    this.tone({ frequency: 620, endFrequency: 880, duration: 0.12, type: 'triangle', gain: 0.04 });
  }

  hit() {
    this.tone({ frequency: 120, endFrequency: 48, duration: 0.28, type: 'sine', gain: 0.18 });
    this.noiseBurst({ duration: 0.22, frequency: 380, q: 0.7, gain: 0.11, type: 'lowpass' });
  }

  stumble() {
    this.noiseBurst({ duration: 0.25, frequency: 250, q: 0.6, gain: 0.08, type: 'lowpass' });
  }

  step(strength = 1) {
    if (!this.started) return;
    const now = this.context.currentTime;
    if (now - this.stepTimer < 0.11) return;
    this.stepTimer = now;
    this.noiseBurst({ duration: 0.05, frequency: 260, q: 0.8, gain: 0.014 * strength, type: 'lowpass' });
  }

  cheer() {
    const now = this.context?.currentTime ?? 0;
    if (now - this.lastCheer < 1.6) return;
    this.lastCheer = now;
    if (this.crowd) {
      this.crowd.gain.gain.setTargetAtTime(0.06, now, 0.08);
      this.crowd.gain.gain.setTargetAtTime(0.012, now + 0.7, 0.5);
    }
    this.noiseBurst({ duration: 0.7, frequency: 1600, q: 0.3, gain: 0.03, type: 'bandpass' });
  }

  finish(place) {
    const win = place === 1;
    const notes = win ? [523, 659, 784, 1046] : [392, 494, 587, 784];
    notes.forEach((note, index) => {
      this.tone({
        frequency: note,
        endFrequency: note * 1.01,
        duration: 0.34,
        type: 'triangle',
        gain: 0.09,
        delay: index * 0.11,
      });
    });
    if (win) {
      this.noiseBurst({ duration: 1.1, frequency: 2100, q: 0.25, gain: 0.07, type: 'highpass', delay: 0.08 });
      this.cheer();
    }
  }
}
