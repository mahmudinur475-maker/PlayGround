/* =========================================================
   LOMBA LARI — a 200 m sprint for phones, tablets and desktop
   Vanilla canvas. No external assets.
   ========================================================= */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (n, m) => ((n % m) + m) % m;
  const $ = (sel) => document.querySelector(sel);

  const ui = {
    canvas: $('#game'),
    startScreen: $('#startScreen'),
    hud: $('#hud'),
    controls: $('#controls'),
    meters: $('#meters'),
    resultScreen: $('#resultScreen'),
    pauseScreen: $('#pauseScreen'),
    howScreen: $('#howScreen'),
    toast: $('#toast'),
    startBtn: $('#startBtn'),
    howBtn: $('#howBtn'),
    howStart: $('#howStart'),
    closeHow: $('#closeHow'),
    soundBtn: $('#soundBtn'),
    tiltToggle: $('#tiltToggle'),
    tiltHint: $('#tiltHint'),
    tiltStatus: $('#tiltStatus'),
    tiltStatusText: $('#tiltStatusText'),
    tiltCalibrate: $('#tiltCalibrate'),
    bestTime: $('#bestTime'),
    posNum: $('#posNum'),
    timeNum: $('#timeNum'),
    speedNum: $('#speedNum'),
    distNum: $('#distNum'),
    progressFill: $('#progressFill'),
    progressDots: $('#progressDots'),
    combo: $('#combo'),
    comboNum: $('#comboNum'),
    comboBar: $('#comboBar'),
    leanMeter: $('#leanMeter'),
    leanPct: $('#leanPct'),
    leanFill: $('#leanFill'),
    jumpBtn: $('#jumpBtn'),
    pauseBtn: $('#pauseBtn'),
    resumeBtn: $('#resumeBtn'),
    restartBtn: $('#restartBtn'),
    quitBtn: $('#quitBtn'),
    againBtn: $('#againBtn'),
    menuBtn: $('#menuBtn'),
    resultKicker: $('#resultKicker'),
    medal: $('#medal'),
    placeNum: $('#placeNum'),
    resultTitle: $('#resultTitle'),
    resultSub: $('#resultSub'),
    finalTime: $('#finalTime'),
    finalBest: $('#finalBest'),
    newBest: $('#newBest'),
    standings: $('#standings'),
    footPads: Array.from(document.querySelectorAll('.foot-pad')),
    leftPad: document.querySelector('.foot-pad[data-foot="left"]'),
    rightPad: document.querySelector('.foot-pad[data-foot="right"]')
  };

  let ctx = ui.canvas.getContext('2d', { alpha: false });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BODY_FONT = getComputedStyle(document.body).fontFamily;

  /* ---------------------------------------------------------
     Small helpers
     --------------------------------------------------------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const num = parseInt(n, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function formatTime(t) {
    if (!Number.isFinite(t) || t <= 0) return '00.00';
    return t.toFixed(2).padStart(5, '0');
  }

  function safeStorageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  /* ---------------------------------------------------------
     Audio — tiny WebAudio synth
     --------------------------------------------------------- */
  const Sound = {
    ctx: null,
    master: null,
    noise: null,
    crowdSource: null,
    crowdGain: null,
    muted: safeStorageGet('lombaLari.sound') === 'off',
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buf;
      } catch (e) { this.ctx = null; }
    },
    resume() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    setMuted(muted) {
      this.muted = muted;
      safeStorageSet('lombaLari.sound', muted ? 'off' : 'on');
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, now, 0.03);
    },
    tone(freq, dur, type, vol, endFreq, delay) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    burst(dur, vol, freq, q, delay) {
      if (!this.ctx || this.muted || !this.noise) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq || 1400;
      filter.Q.value = q || 0.8;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.1, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },
    ui() { this.tone(660, 0.06, 'sine', 0.05); },
    step(combo) {
      const f = 130 + Math.min(combo || 1, 14) * 7;
      this.burst(0.075, 0.075, 2100, 1.1);
      this.tone(f, 0.06, 'triangle', 0.035, f * 0.55);
    },
    jump() {
      this.tone(210, 0.18, 'sine', 0.07, 520);
      this.burst(0.09, 0.05, 900, 0.7);
    },
    stumble() {
      this.burst(0.22, 0.16, 360, 0.7);
      this.tone(95, 0.18, 'sawtooth', 0.06, 48);
    },
    go() {
      this.tone(620, 0.13, 'square', 0.045, 660);
      this.tone(920, 0.22, 'square', 0.04, 980, 0.1);
      this.burst(0.25, 0.05, 1200, 0.6);
    },
    finish(place) {
      const notes = place === 1 ? [523, 659, 784, 1046] : place === 2 ? [440, 554, 659] : [392, 494, 587];
      notes.forEach((n, i) => this.tone(n, 0.24, 'triangle', 0.075, n, i * 0.11));
      this.cheer();
    },
    startCrowd() {
      this.init();
      if (!this.ctx || this.crowdSource) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 780;
      filter.Q.value = 0.45;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
      this.crowdSource = src;
      this.crowdGain = gain;
      gain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.4);
    },
    setCrowd(level) {
      if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.35);
    },
    cheer() {
      if (this.crowdGain) {
        const now = this.ctx.currentTime;
        this.crowdGain.gain.cancelScheduledValues(now);
        this.crowdGain.gain.setTargetAtTime(0.11, now, 0.08);
        this.crowdGain.gain.setTargetAtTime(0.045, now + 1.2, 0.7);
      }
      this.burst(0.8, 0.045, 1500, 0.4);
    },
    stopCrowd() {
      if (this.crowdSource) {
        try { this.crowdSource.stop(); } catch (e) { /* noop */ }
        this.crowdSource = null;
        this.crowdGain = null;
      }
    }
  };

  /* ---------------------------------------------------------
     Layout
     --------------------------------------------------------- */
  const L = {
    W: 0, H: 0, dpr: 1,
    standTop: 0, trackTop: 0, laneGap: 0, ppm: 20, charH: 120,
    crowdLayer: null, crowdW: 640, crowdH: 120,
    cityLayer: null, cityW: 1100, cityH: 120,
    stars: [], clouds: [], flashes: [], bokeh: [], scuffs: []
  };

  const CFG = {
    distance: 200,
    hurdles: [34, 72, 110, 148, 182],
    lanes: 4,
    playerLane: 2,
    playerMaxSpeed: 13
  };

  const game = {
    mode: 'menu',
    paused: false,
    time: 0,
    menuTime: 0,
    raceTime: 0,
    camera: 0,
    anchor: 0,
    anchorTarget: 0,
    goFlash: 0,
    finishFlash: 0,
    slowmo: 1,
    resultTimer: 0,
    resultShown: false,
    shake: 0,
    combo: 1,
    nextFoot: 'left',
    lastFoot: null,
    lastTap: -10,
    playerPlace: 4,
    playerTime: 0,
    finishOrder: 0,
    best: null,
    runners: [],
    player: null,
    particles: [],
    confetti: [],
    dots: new Map(),
    standings: [],
    wakeLock: null,
    tilt: {
      enabled: false,
      supported: typeof window.DeviceOrientationEvent !== 'undefined',
      gotData: false,
      samples: [],
      baseline: null,
      target: 0,
      lean: 0,
      listener: null
    }
  };

  const savedBest = parseFloat(safeStorageGet('lombaLari.best'));
  if (Number.isFinite(savedBest) && savedBest > 0) game.best = savedBest;

  function laneY(lane) {
    return L.trackTop + L.laneGap * (lane + 1.4);
  }

  function laneScale(lane) {
    return 0.84 + lane * 0.055;
  }

  function screenX(worldX) {
    return game.anchor + (worldX - game.camera) * L.ppm;
  }

  function resize() {
    L.W = window.innerWidth;
    L.H = window.innerHeight;
    L.dpr = Math.min(window.devicePixelRatio || 1, 2.25);
    ui.canvas.width = Math.round(L.W * L.dpr);
    ui.canvas.height = Math.round(L.H * L.dpr);
    ui.canvas.style.width = L.W + 'px';
    ui.canvas.style.height = L.H + 'px';
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);

    const compact = L.H < 620;
    L.standTop = Math.round(L.H * (compact ? 0.24 : 0.27));
    L.trackTop = Math.round(L.H * 0.42);
    L.laneGap = clamp(L.H * 0.095, compact ? 38 : 60, 86);
    L.ppm = clamp(L.W / 38, 10.5, 36);
    L.charH = clamp(L.H * 0.098, compact ? 54 : 70, 92);

    game.anchorTarget = game.mode === 'menu' ? L.W * 0.64 : L.W * 0.35;
    if (!game.anchor) game.anchor = game.anchorTarget;

    buildStars();
    buildClouds();
    buildCrowdLayer();
    buildCityLayer();
    buildScuffs();
    buildBokeh();
    buildFlashes();
    buildLayers();
  }

  function buildStars() {
    const rng = mulberry32(31);
    L.stars = [];
    for (let i = 0; i < 34; i++) {
      L.stars.push({
        x: rng() * L.W,
        y: rng() * L.standTop * 0.55,
        r: 0.6 + rng() * 1.4,
        p: rng() * TAU
      });
    }
  }

  function buildClouds() {
    const rng = mulberry32(77);
    L.clouds = [];
    for (let i = 0; i < 6; i++) {
      L.clouds.push({
        x: rng(),
        y: 0.08 + rng() * 0.5,
        s: 0.55 + rng() * 1.2,
        a: 0.08 + rng() * 0.1,
        d: 0.6 + rng() * 1.4
      });
    }
  }

  function buildCrowdLayer() {
    const h = Math.max(74, Math.round(L.trackTop - L.standTop - 44));
    const w = 640;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const rng = mulberry32(2026);
    const palette = ['#ffd9a0', '#ffb27a', '#e8e2d2', '#8fb7ff', '#ff7b62', '#7fe0c3', '#f2c14e', '#c9a0ff', '#f6eee0'];
    const rows = Math.max(7, Math.round(h / 15));
    for (let r = 0; r < rows; r++) {
      const y = 5 + (r * (h - 10)) / rows;
      g.fillStyle = 'rgba(3, 8, 18, 0.3)';
      g.fillRect(0, y + 8, w, 2);
      let x = 2;
      while (x < w) {
        const step = 5.4 + rng() * 4.6;
        if (mod(x, 104) > 8) {
          const jy = (rng() - 0.5) * 4;
          const size = 1.5 + rng() * 2.4;
          g.globalAlpha = 0.38 + rng() * 0.5;
          g.fillStyle = palette[(rng() * palette.length) | 0];
          g.fillRect(x, y + jy, size, size + 1.6);
          g.globalAlpha = 0.35 + rng() * 0.3;
          g.fillStyle = '#d9a27a';
          g.fillRect(x, y + jy - 2.1, 1.9, 1.9);
        }
        x += step;
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(3, 8, 18, 0.52)';
    for (let x = 0; x < w; x += 104) g.fillRect(x, 0, 7, h);
    g.fillStyle = 'rgba(255, 244, 223, 0.05)';
    for (let x = 0; x < w; x += 104) g.fillRect(x + 7, 0, 1, h);
    L.crowdLayer = c;
    L.crowdW = w;
    L.crowdH = h;
  }

  function buildCityLayer() {
    const w = 1100;
    const h = 120;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const rng = mulberry32(91);
    let x = -20;
    while (x < w + 20) {
      const bw = 26 + rng() * 74;
      const bh = 16 + rng() * 92;
      g.fillStyle = '#0b1428';
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = 'rgba(255, 197, 120, 0.34)';
      const cols = Math.max(1, Math.floor(bw / 11));
      const rows = Math.max(1, Math.floor(bh / 13));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (rng() > 0.66) g.fillRect(x + 4 + i * 11, h - bh + 5 + j * 13, 2, 3);
        }
      }
      if (rng() > 0.55) {
        g.fillStyle = '#0b1428';
        g.fillRect(x + bw * 0.35, h - bh - 10, 2, 10);
        g.fillStyle = '#ff6a4b';
        g.fillRect(x + bw * 0.35, h - bh - 11, 2, 2);
      }
      x += bw + 4 + rng() * 10;
    }
    const grad = g.createLinearGradient(0, h * 0.35, 0, h);
    grad.addColorStop(0, 'rgba(240, 150, 100, 0)');
    grad.addColorStop(1, 'rgba(240, 150, 100, 0.14)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    L.cityLayer = c;
    L.cityW = w;
    L.cityH = h;
  }

  function buildScuffs() {
    const rng = mulberry32(551);
    L.scuffs = [];
    for (let i = 0; i < 190; i++) {
      L.scuffs.push({
        x: rng() * 260,
        lane: (rng() * 4) | 0,
        o: (rng() - 0.5) * L.laneGap * 0.7,
        len: 2 + rng() * 12,
        a: 0.03 + rng() * 0.07
      });
    }
  }

  function buildBokeh() {
    const rng = mulberry32(808);
    L.bokeh = [];
    for (let i = 0; i < 14; i++) {
      L.bokeh.push({
        x: rng() * L.W,
        y: L.H * (0.8 + rng() * 0.22),
        r: 8 + rng() * 34,
        a: 0.02 + rng() * 0.06
      });
    }
  }

  function buildFlashes() {
    const rng = mulberry32(414);
    L.flashes = [];
    for (let i = 0; i < 20; i++) {
      L.flashes.push({
        x: rng() * L.W,
        y: L.standTop + 20 + rng() * Math.max(30, L.trackTop - L.standTop - 60),
        p: rng() * TAU,
        s: 0.6 + rng() * 2.2
      });
    }
  }

  /* ---------------------------------------------------------
     Runners
     --------------------------------------------------------- */
  const PLAYER_DEF = {
    id: 'you', name: 'Kamu', lane: 2, number: '07', isPlayer: true,
    jersey: '#ef4a2f', jerseyDark: '#b52c1a', shorts: '#fff4df', shortsDark: '#d8c7ab',
    skin: '#b97850', skinDark: '#8f5736', hair: '#17100d', accent: '#d8ff57',
    shoe: '#fff4df', headband: '#fff4df', hairStyle: 'short', base: 0, ramp: 0
  };

  const AI_DEFS = [
    {
      id: 'bima', name: 'Bima', lane: 0, number: '04',
      jersey: '#3d7bf7', jerseyDark: '#2450a8', shorts: '#0b1730', shortsDark: '#081120',
      skin: '#c98a5e', skinDark: '#9a6642', hair: '#1a120e', accent: '#d8ff57',
      shoe: '#f7f2e8', headband: '#3d7bf7', hairStyle: 'short',
      base: 7.9, ramp: 0.75, seed: 1.7, wave: 0.63
    },
    {
      id: 'sari', name: 'Sari', lane: 1, number: '11',
      jersey: '#ffc247', jerseyDark: '#c58a1c', shorts: '#101a2e', shortsDark: '#0a1322',
      skin: '#d9a172', skinDark: '#a9764d', hair: '#24140e', accent: '#ff5a3c',
      shoe: '#fff4df', headband: '#ff5a3c', hairStyle: 'pony',
      base: 8.17, ramp: 0.79, seed: 4.2, wave: 0.71
    },
    {
      id: 'raka', name: 'Raka', lane: 3, number: '09',
      jersey: '#2ec4a6', jerseyDark: '#18806d', shorts: '#0b1730', shortsDark: '#081120',
      skin: '#8d5a3b', skinDark: '#69412a', hair: '#0f0c0a', accent: '#ffc247',
      shoe: '#d8ff57', headband: '#2ec4a6', hairStyle: 'short',
      base: 8.43, ramp: 0.83, seed: 6.6, wave: 0.58
    }
  ];

  function makeRunner(def) {
    return {
      ...def,
      x: 0,
      speed: 0,
      phase: Math.random() * TAU,
      lastStep: 0,
      jumpT: 0,
      jumpDur: 0.78,
      jumpMax: 1.22,
      jumpH: 0,
      stumble: 0,
      finished: false,
      place: 0,
      finishTime: 0,
      resultTime: 0,
      cleared: new Set(),
      missMap: CFG.hurdles.map(() => Math.random() < 0.055),
      scale: laneScale(def.lane)
    };
  }

  function buildRunners() {
    game.runners = [makeRunner(PLAYER_DEF), ...AI_DEFS.map((def) => makeRunner(def))];
    game.player = game.runners[0];
  }

  function setupDots() {
    ui.progressDots.innerHTML = '';
    game.dots.clear();
    for (const r of game.runners) {
      const dot = document.createElement('span');
      dot.className = 'race-dot' + (r.isPlayer ? ' you' : '');
      dot.style.setProperty('--dot', r.jersey);
      dot.style.left = '0%';
      ui.progressDots.appendChild(dot);
      game.dots.set(r.id, dot);
    }
  }

  function resetMenuScene() {
    buildRunners();
    game.mode = 'menu';
    game.paused = false;
    game.raceTime = 0;
    game.camera = 0;
    game.combo = 1;
    game.lastFoot = null;
    game.lastTap = -10;
    game.goFlash = 0;
    game.finishFlash = 0;
    game.hitFlash = 0;
    game.slowmo = 1;
    game.resultShown = false;
    game.resultTimer = 0;
    game.standings = [];
    game.particles.length = 0;
    game.confetti.length = 0;
    game.shake = 0;
    const menuX = { you: 0.6, bima: -3.8, sari: -2, raka: 3 };
    for (const r of game.runners) {
      r.x = menuX[r.id] || 0;
      r.speed = 0;
      r.phase = Math.random() * TAU;
      r.jumpH = 0;
      r.stumble = 0;
      r.finished = false;
    }
    setupDots();
    updateNextFootUI(true);
    updateHud();
  }

  function resetRace() {
    buildRunners();
    game.lastStumbleToast = -10;
    game.mode = 'race';
    game.paused = false;
    game.raceTime = 0;
    game.camera = 0;
    game.combo = 1;
    game.lastFoot = null;
    game.lastTap = -10;
    game.nextFoot = 'left';
    game.playerPlace = 4;
    game.playerTime = 0;
    game.finishOrder = 0;
    game.resultTimer = 0;
    game.resultShown = false;
    game.slowmo = 1;
    game.shake = 0;
    game.hitFlash = 0;
    game.standings = [];
    game.particles.length = 0;
    game.confetti.length = 0;
    for (const r of game.runners) {
      r.x = 0;
      r.speed = 0;
      r.phase = Math.random() * TAU;
      r.lastStep = 0;
      r.jumpT = 0;
      r.jumpH = 0;
      r.stumble = 0;
      r.finished = false;
      r.place = 0;
      r.finishTime = 0;
      r.resultTime = 0;
      r.cleared = new Set();
    }
    game.tilt.lean = 0;
    game.tilt.target = 0;
    setupDots();
    updateNextFootUI(true);
    updateHud();
  }

  function startRace() {
    Sound.resume();
    Sound.startCrowd();
    Sound.go();
    resetRace();
    game.goFlash = 1.15;
    game.finishFlash = 0;
    game.anchorTarget = L.W * 0.35;
    ui.startScreen.hidden = true;
    ui.resultScreen.hidden = true;
    ui.pauseScreen.hidden = true;
    ui.howScreen.hidden = true;
    ui.hud.hidden = false;
    ui.controls.hidden = false;
    ui.leanMeter.hidden = !game.tilt.enabled;
    ui.combo.hidden = true;
    updateHud();
    showToast('Ketuk KIRI–KANAN bergantian!', 2400);
    requestWakeLock();
  }

  function goMenu() {
    releaseWakeLock();
    Sound.stopCrowd();
    resetMenuScene();
    game.anchorTarget = L.W * 0.64;
    ui.resultScreen.hidden = true;
    ui.pauseScreen.hidden = true;
    ui.howScreen.hidden = true;
    ui.hud.hidden = true;
    ui.controls.hidden = true;
    ui.meters.hidden = true;
    ui.startScreen.hidden = false;
    ui.toast.classList.remove('is-visible');
    updateBestUI();
  }

  function updateBestUI() {
    ui.bestTime.textContent = game.best ? formatTime(game.best) : '--.--';
  }

  /* ---------------------------------------------------------
     Input
     --------------------------------------------------------- */
  function updateNextFootUI(force) {
    if (game.mode !== 'race' && !force) {
      ui.leftPad.classList.remove('is-next');
      ui.rightPad.classList.remove('is-next');
      return;
    }
    ui.leftPad.classList.toggle('is-next', game.nextFoot === 'left');
    ui.rightPad.classList.toggle('is-next', game.nextFoot === 'right');
  }

  function flashElement(el, className, duration) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(() => el.classList.remove(className), duration || 160);
  }

  function triggerFoot(side) {
    if (game.mode !== 'race' || game.paused || !game.player || game.player.finished) return;
    const p = game.player;
    const now = game.raceTime;
    const alternating = side !== game.lastFoot || (now - game.lastTap) > 0.62;
    const pad = side === 'left' ? ui.leftPad : ui.rightPad;

    if (alternating) {
      game.combo = Math.min(20, game.combo + 1);
      p.speed = Math.min(CFG.playerMaxSpeed, p.speed + 0.28 + Math.min(game.combo, 10) * 0.018);
      game.lastFoot = side;
      game.lastTap = now;
      game.nextFoot = side === 'left' ? 'right' : 'left';
      Sound.step(game.combo);
      spawnDust(p.x - 0.15, laneY(p.lane), 4, 0.55);
      flashElement(pad, 'is-hit', 120);
      pulseCombo();
    } else {
      game.combo = Math.max(1, game.combo - 2);
      p.speed = Math.min(CFG.playerMaxSpeed, p.speed + 0.045);
      game.lastTap = now;
      Sound.step(1);
      flashElement(pad, 'is-wrong', 260);
      flashElement(ui.combo, 'is-wrong', 260);
    }

    updateNextFootUI();
    updateHud();
  }

  function pulseCombo() {
    if (game.combo < 2) return;
    ui.comboNum.classList.remove('pop');
    void ui.comboNum.offsetWidth;
    ui.comboNum.classList.add('pop');
    window.setTimeout(() => ui.comboNum.classList.remove('pop'), 190);
  }

  function doJump() {
    if (game.mode !== 'race' || game.paused || !game.player || game.player.finished) return;
    const p = game.player;
    if (p.jumpT > 0 || p.stumble > 0.1) return;
    p.jumpT = 0.0001;
    p.jumpDur = 0.78;
    p.jumpMax = 1.24;
    Sound.jump();
    spawnDust(p.x - 0.1, laneY(p.lane), 6, 0.7);
    flashElement(ui.jumpBtn, 'is-hit', 150);
  }

  function bindPress(el, handler) {
    if (!el) return;
    el.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      if (el.setPointerCapture) {
        try { el.setPointerCapture(event.pointerId); } catch (e) { /* noop */ }
      }
      handler(event);
    });
    el.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /* ---------------------------------------------------------
     Tilt (optional, permission on iOS)
     --------------------------------------------------------- */
  function setTiltStatus(text, tone) {
    ui.tiltStatusText.textContent = text;
    ui.tiltStatus.classList.remove('is-good', 'is-bad');
    if (tone) ui.tiltStatus.classList.add(tone === 'good' ? 'is-good' : 'is-bad');
  }

  function handleOrientation(event) {
    const t = game.tilt;
    if (event.beta == null && event.gamma == null) return;
    t.gotData = true;
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;

    if (!t.baseline) {
      t.samples.push([beta, gamma]);
      if (t.samples.length >= 14) {
        let sb = 0;
        let sg = 0;
        for (const s of t.samples) { sb += s[0]; sg += s[1]; }
        t.baseline = [sb / t.samples.length, sg / t.samples.length];
        t.samples = [];
      }
      return;
    }

    const dx = beta - t.baseline[0];
    const dy = gamma - t.baseline[1];
    const magnitude = Math.hypot(dx, dy);
    t.target = clamp((magnitude - 4) / 26, 0, 1);
  }

  function disableTilt(resetStatus) {
    const t = game.tilt;
    if (t.listener) {
      window.removeEventListener('deviceorientation', t.listener, true);
      t.listener = null;
    }
    t.enabled = false;
    t.gotData = false;
    t.samples = [];
    t.baseline = null;
    t.target = 0;
    t.lean = 0;
    ui.tiltToggle.setAttribute('aria-checked', 'false');
    ui.tiltHint.textContent = 'Opsional · sensor gerak';
    ui.tiltCalibrate.hidden = true;
    ui.leanMeter.hidden = true;
    if (resetStatus !== false) setTiltStatus('Aktifkan mode miring untuk lean otomatis.', '');
  }

  async function enableTilt() {
    if (game.tilt.enabled) return;
    ui.tiltToggle.disabled = true;
    setTiltStatus('Meminta izin sensor gerak…', '');
    Sound.resume();
    try {
      if (typeof window.DeviceOrientationEvent === 'undefined') {
        throw new Error('Perangkat ini tidak mendukung sensor gerak.');
      }
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') {
          throw new Error('Izin sensor ditolak. Kamu tetap bisa bermain dengan ketukan.');
        }
      }

      const t = game.tilt;
      t.enabled = true;
      t.gotData = false;
      t.samples = [];
      t.baseline = null;
      t.target = 0;
      t.lean = 0;
      t.listener = (event) => handleOrientation(event);
      window.addEventListener('deviceorientation', t.listener, true);

      ui.tiltToggle.setAttribute('aria-checked', 'true');
      ui.tiltHint.textContent = 'Aktif · condongkan HP';
      ui.tiltCalibrate.hidden = false;
      setTiltStatus('Tahan HP stabil sebentar untuk kalibrasi…', '');
      Sound.ui();

      window.setTimeout(() => {
        if (!t.enabled) return;
        if (!t.gotData) {
          disableTilt(false);
          setTiltStatus('Sensor tidak merespons. Mode miring dimatikan.', 'bad');
        } else {
          setTiltStatus('Mode miring aktif. Condongkan HP ke depan untuk lean.', 'good');
          showToast('Mode miring aktif — condongkan HP untuk lean.', 2200);
        }
      }, 1400);
    } catch (error) {
      disableTilt(false);
      setTiltStatus(error && error.message ? error.message : 'Mode miring tidak bisa diaktifkan.', 'bad');
    } finally {
      ui.tiltToggle.disabled = false;
    }
  }

  function calibrateTilt() {
    const t = game.tilt;
    if (!t.enabled) return;
    t.samples = [];
    t.baseline = null;
    t.target = 0;
    t.lean = 0;
    setTiltStatus('Kalibrasi ulang… tahan HP stabil.', '');
    Sound.ui();
    window.setTimeout(() => {
      if (t.enabled && t.baseline) {
        setTiltStatus('Mode miring siap. Condongkan HP untuk lean.', 'good');
      }
    }, 1000);
  }

  function updateTilt(dt) {
    const t = game.tilt;
    const target = t.enabled ? t.target : 0;
    t.lean += (target - t.lean) * (1 - Math.exp(-dt * 6));
  }

  /* ---------------------------------------------------------
     Toast + wake lock
     --------------------------------------------------------- */
  let toastTimer = 0;
  function showToast(text, duration) {
    ui.toast.textContent = text;
    ui.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.remove('is-visible'), duration || 2000);
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !game.wakeLock) {
        game.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* not supported or denied */ }
  }

  function releaseWakeLock() {
    if (game.wakeLock) {
      game.wakeLock.release().catch(() => {});
      game.wakeLock = null;
    }
  }

  /* ---------------------------------------------------------
     Race simulation
     --------------------------------------------------------- */
  function spawnDust(x, y, count, strength) {
    const n = count || 4;
    for (let i = 0; i < n; i++) {
      const s = strength || 0.6;
      game.particles.push({
        x: x + (Math.random() - 0.5) * 0.35,
        y: y - Math.random() * 5,
        vx: -(0.35 + Math.random() * 1.8) * s,
        vy: -(8 + Math.random() * 34) * s,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        r: 1.4 + Math.random() * 3.2,
        color: Math.random() > 0.5 ? '232, 197, 162' : '255, 235, 208'
      });
    }
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 92 * dt;
      p.life -= dt;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
  }

  function spawnConfetti(count) {
    const colors = ['#ff5a3c', '#d8ff57', '#ffc857', '#fff4df', '#3d7bf7', '#2ec4a6'];
    const n = count || 80;
    for (let i = 0; i < n; i++) {
      game.confetti.push({
        x: L.W * (0.18 + Math.random() * 0.64),
        y: L.H * (0.12 + Math.random() * 0.34),
        vx: (Math.random() - 0.5) * 260,
        vy: -40 - Math.random() * 180,
        w: 4 + Math.random() * 6,
        h: 3 + Math.random() * 8,
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 9,
        life: 2.4 + Math.random() * 1.8,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }

  function updateConfetti(dt) {
    for (let i = game.confetti.length - 1; i >= 0; i--) {
      const c = game.confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 210 * dt;
      c.vx *= (1 - 0.55 * dt);
      c.rot += c.vr * dt;
      c.life -= dt;
      if (c.life <= 0 || c.y > L.H + 40) game.confetti.splice(i, 1);
    }
  }

  function getPlayerPlace() {
    const sorted = [...game.runners].sort((a, b) => {
      if (a.finished && b.finished) return a.place - b.place;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.x - a.x;
    });
    return sorted.indexOf(game.player) + 1;
  }

  function getStandings() {
    return [...game.runners].sort((a, b) => {
      if (a.finished && b.finished) return a.place - b.place;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.x - a.x;
    });
  }

  function updatePlayer(dt) {
    const p = game.player;
    const lean = game.tilt.enabled ? game.tilt.lean : 0;
    const progress = clamp(p.x / CFG.distance, 0, 1);
    const target = 5.15 + 2.0 * progress + lean * 1.25;
    if (p.speed < target) p.speed += (target - p.speed) * 1.45 * dt;
    else p.speed -= (p.speed - target) * 0.6 * dt;
    p.speed += lean * 0.35 * dt;
    p.speed = clamp(p.speed, 0, CFG.playerMaxSpeed);
  }

  function updateAI(r, dt) {
    const progress = clamp(r.x / CFG.distance, 0, 1);
    let target = r.base + r.ramp * progress + Math.sin(game.raceTime * r.wave + r.seed) * 0.16;
    const gap = game.player.x - r.x;
    target += clamp(gap * 0.013, -0.4, 0.52);
    r.speed += (target - r.speed) * 1.2 * dt;
    r.speed = clamp(r.speed, 2, 12);

    if (r.stumble > 0.1) return;

    let nextIndex = -1;
    let nextDistance = Infinity;
    for (let i = 0; i < CFG.hurdles.length; i++) {
      const h = CFG.hurdles[i];
      if (!r.cleared.has(h) && h > r.x + 0.2) {
        const d = h - r.x;
        if (d < nextDistance) { nextDistance = d; nextIndex = i; }
      }
    }
    if (nextIndex >= 0 && r.jumpT <= 0 && !r.missMap[nextIndex]) {
      if (nextDistance < r.speed * 0.3 + 0.55) {
        r.jumpT = 0.0001;
        r.jumpDur = 0.76;
        r.jumpMax = 1.18;
      }
    }
  }

  function stumble(r) {
    r.speed *= 0.5;
    r.stumble = 0.62;
    r.jumpT = 0;
    r.jumpH = 0;
    spawnDust(r.x, laneY(r.lane), r.isPlayer ? 11 : 5, 0.85);
    if (r.isPlayer) {
      game.shake = Math.max(game.shake, 13);
      game.hitFlash = 0.7;
      game.combo = 1;
      game.lastTap = game.raceTime;
      Sound.stumble();
      if (game.raceTime - (game.lastStumbleToast || -10) > 2.5) {
        game.lastStumbleToast = game.raceTime;
        showToast('Aduh! Lompati gawang berikutnya.', 1700);
      }
    }
  }

  function finishRunner(r) {
    if (r.finished) return;
    r.finished = true;
    r.place = ++game.finishOrder;
    r.finishTime = game.raceTime;
    r.resultTime = r.finishTime;
    if (r.isPlayer) {
      game.playerPlace = r.place;
      game.playerTime = r.finishTime;
      game.mode = 'finished';
      game.resultTimer = 1.65;
      game.slowmo = 0.32;
      game.finishFlash = 1;
      game.shake = Math.max(game.shake, 16);
      game.combo = 1;
      Sound.finish(r.place);
      spawnConfetti(130);
      showToast(r.place === 1 ? 'Garis finis! Kamu juara.' : 'Garis finis! Cek hasilmu.', 1800);
      releaseWakeLock();
    }
  }

  function updateRunners(dt) {
    for (const r of game.runners) {
      if (r.finished) {
        r.speed = Math.max(0, r.speed - 4.5 * dt);
        r.x = Math.min(204, r.x + r.speed * dt * 0.25);
        r.phase += dt * 2.2;
        continue;
      }

      const prevX = r.x;
      if (r.isPlayer) updatePlayer(dt);
      else updateAI(r, dt);

      if (r.stumble > 0) {
        r.stumble -= dt;
        r.speed *= Math.max(0, 1 - 1.4 * dt);
      }

      if (r.jumpT > 0) {
        r.jumpT += dt;
        const q = Math.min(1, r.jumpT / r.jumpDur);
        r.jumpH = Math.sin(q * Math.PI) * r.jumpMax;
        if (q >= 1) {
          r.jumpT = 0;
          r.jumpH = 0;
        }
      }

      r.x += Math.max(0, r.speed) * dt;
      r.phase += (2.4 + r.speed * 1.35) * dt;

      const step = Math.floor(r.phase / Math.PI);
      if (step !== r.lastStep) {
        r.lastStep = step;
        if (r.speed > 2.2) {
          spawnDust(r.x - 0.15, laneY(r.lane), r.isPlayer ? 3 : 2, r.isPlayer ? 0.5 : 0.34);
        }
      }

      for (const hx of CFG.hurdles) {
        if (prevX < hx && r.x >= hx && !r.cleared.has(hx)) {
          r.cleared.add(hx);
          if (r.jumpH < 0.52) stumble(r);
        }
      }

      if (r.x >= CFG.distance) finishRunner(r);
    }

    if (game.raceTime - game.lastTap > 0.9) {
      game.combo = Math.max(1, game.combo - dt * 5.5);
    }
    updateHud();
  }

  function updateCamera(dt) {
    const target = game.mode === 'menu' ? 0 : Math.min(game.player.x, CFG.distance);
    game.camera += (target - game.camera) * (1 - Math.exp(-dt * 7));
  }

  function updateAnchor(dt) {
    const target = game.mode === 'menu' ? L.W * 0.64 : L.W * 0.35;
    game.anchorTarget = target;
    game.anchor += (target - game.anchor) * (1 - Math.exp(-dt * 4.6));
  }

  function update(dt) {
    game.time += dt;
    if (game.paused) return;

    updateAnchor(dt);
    updateTilt(dt);
    game.goFlash = Math.max(0, game.goFlash - dt * 1.2);
    game.finishFlash = Math.max(0, game.finishFlash - dt * 2.4);
    game.hitFlash = Math.max(0, (game.hitFlash || 0) - dt * 2.3);
    game.shake = Math.max(0, game.shake - dt * 26);

    if (game.mode === 'menu') {
      game.menuTime += dt;
      for (const r of game.runners) {
        r.phase += (3.15 + r.lane * 0.25) * dt;
        r.bob = Math.sin(game.menuTime * 2.1 + r.lane) * 1.2;
      }
      game.camera = Math.sin(game.menuTime * 0.22) * 0.45;
      updateParticles(dt);
      updateConfetti(dt);
      return;
    }

    if (game.mode === 'race' || game.mode === 'finished') {
      const worldDt = dt * (game.mode === 'finished' ? game.slowmo : 1);
      if (!game.resultShown) {
        game.raceTime += worldDt;
        updateRunners(worldDt);
        updateCamera(worldDt);
        updateParticles(worldDt);
        updateConfetti(worldDt);
      } else {
        updateParticles(dt);
        updateConfetti(dt);
      }
      if (game.mode === 'finished' && !game.resultShown) {
        game.resultTimer -= dt;
        if (game.resultTimer <= 0) showResults();
      }
    }
  }

  /* ---------------------------------------------------------
     HUD sync
     --------------------------------------------------------- */
  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function updateHud() {
    if (!game.player || game.mode === 'menu') return;
    const place = getPlayerPlace();
    setText(ui.posNum, String(place));
    const posStat = ui.posNum.closest('.pos-stat');
    if (posStat) posStat.classList.toggle('is-first', place === 1);
    setText(ui.timeNum, formatTime(game.raceTime));
    setText(ui.speedNum, game.player.speed.toFixed(1));
    setText(ui.distNum, Math.min(CFG.distance, Math.floor(game.player.x)) + ' M');
    ui.progressFill.style.width = (clamp(game.player.x / CFG.distance, 0, 1) * 100).toFixed(2) + '%';

    for (const r of game.runners) {
      const dot = game.dots.get(r.id);
      if (dot) dot.style.left = (clamp(r.x / CFG.distance, 0, 1) * 100).toFixed(2) + '%';
    }

    const showCombo = game.combo >= 2;
    ui.combo.hidden = !showCombo;
    if (showCombo) {
      setText(ui.comboNum, '×' + Math.floor(game.combo));
      ui.comboBar.style.width = (clamp(game.combo / 20, 0, 1) * 100).toFixed(1) + '%';
      ui.combo.classList.toggle('is-hot', game.combo >= 8);
    }

    ui.leanMeter.hidden = !game.tilt.enabled;
    if (game.tilt.enabled) {
      setText(ui.leanPct, Math.round(game.tilt.lean * 100) + '%');
      ui.leanFill.style.width = (game.tilt.lean * 100).toFixed(1) + '%';
    }

    ui.meters.hidden = !(showCombo || game.tilt.enabled);
  }

  /* ---------------------------------------------------------
     World painting
     --------------------------------------------------------- */
  function drawSky(t) {
    const skyH = L.standTop + 50;
    const g = ctx.createLinearGradient(0, 0, 0, skyH);
    g.addColorStop(0, '#050a16');
    g.addColorStop(0.32, '#111d40');
    g.addColorStop(0.58, '#493a6d');
    g.addColorStop(0.8, '#ad564c');
    g.addColorStop(1, '#eda06c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L.W, skyH);

    for (const s of L.stars) {
      const a = 0.25 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff4df';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const sunX = L.W * 0.76 - game.camera * L.ppm * 0.018;
    const sunY = L.standTop * 0.58;
    const sunR = clamp(L.W * 0.16, 100, 260);
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    glow.addColorStop(0, 'rgba(255, 238, 190, 0.95)');
    glow.addColorStop(0.14, 'rgba(255, 198, 118, 0.6)');
    glow.addColorStop(0.42, 'rgba(255, 132, 76, 0.2)');
    glow.addColorStop(1, 'rgba(255, 110, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);

    ctx.fillStyle = '#ffe4aa';
    ctx.beginPath();
    ctx.arc(sunX, sunY, clamp(L.W * 0.026, 18, 46), 0, TAU);
    ctx.fill();

    for (const c of L.clouds) {
      const x = mod(c.x * L.W - game.camera * L.ppm * 0.012 + t * c.d * 5, L.W + 320) - 160;
      const y = L.standTop * c.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(c.s, c.s);
      ctx.globalAlpha = c.a;
      ctx.fillStyle = '#ffd1a4';
      ctx.beginPath();
      ctx.ellipse(0, 0, 54, 10, 0, 0, TAU);
      ctx.ellipse(32, -5, 38, 8, 0, 0, TAU);
      ctx.ellipse(-36, 2, 34, 7, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (L.cityLayer) {
      const off = mod(-game.camera * L.ppm * 0.035, L.cityW);
      const y = L.standTop - L.cityH + 10;
      for (let x = -off; x < L.W; x += L.cityW) {
        ctx.drawImage(L.cityLayer, x, y);
      }
    }

    const haze = ctx.createLinearGradient(0, L.standTop - 60, 0, L.standTop + 12);
    haze.addColorStop(0, 'rgba(255, 154, 99, 0)');
    haze.addColorStop(0.7, 'rgba(255, 154, 99, 0.18)');
    haze.addColorStop(1, 'rgba(255, 154, 99, 0.05)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, L.standTop - 60, L.W, 72);
  }

  function drawStadium(t) {
    const top = L.standTop;
    const bottom = L.trackTop;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, '#0a1326');
    g.addColorStop(0.55, '#101f38');
    g.addColorStop(1, '#07101e');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, L.W, bottom - top);

    ctx.fillStyle = '#050b16';
    ctx.beginPath();
    ctx.moveTo(-12, top - 54);
    ctx.lineTo(L.W + 12, top - 66);
    ctx.lineTo(L.W + 12, top - 18);
    ctx.lineTo(-12, top - 3);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 205, 150, 0.09)';
    ctx.lineWidth = 1;
    for (let x = -40; x < L.W + 60; x += 74) {
      line(x, top - 50, x + 24, top - 8);
    }
    ctx.strokeStyle = 'rgba(255, 244, 223, 0.13)';
    line(-12, top - 3, L.W + 12, top - 18);

    if (L.crowdLayer) {
      const y = top + 19;
      const off = mod(-game.camera * L.ppm * 0.12, L.crowdW);
      for (let x = -off; x < L.W; x += L.crowdW) {
        ctx.drawImage(L.crowdLayer, x, y);
      }
    }

    const fade = ctx.createLinearGradient(0, top + 8, 0, bottom);
    fade.addColorStop(0, 'rgba(4, 9, 18, 0.5)');
    fade.addColorStop(0.28, 'rgba(4, 9, 18, 0)');
    fade.addColorStop(0.82, 'rgba(4, 9, 18, 0)');
    fade.addColorStop(1, 'rgba(4, 9, 18, 0.62)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, top, L.W, bottom - top);

    // Stadium banners are decoration for wide screens only; on phones they
    // would sit directly behind the poster title and action buttons.
    const wallY = bottom - 66;
    if (L.W >= 1000 && L.H >= 620) {
      const bannerW = clamp(L.W * 0.22, 128, 250);
      const bannerH = clamp(L.H * 0.032, 24, 34);
      const bx = L.W * 0.6 - bannerW / 2;
      const by = Math.max(top + 16, wallY - bannerH - 6);
      ctx.fillStyle = '#cf3d2b';
      roundRect(bx, by, bannerW, bannerH, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 244, 223, 0.16)';
      ctx.fillRect(bx + 6, by + 4, bannerW - 12, 1);
      ctx.fillStyle = '#fff4df';
      ctx.font = `italic 900 ${Math.max(12, bannerH * 0.48)}px ${BODY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SEMANGAT', bx + bannerW / 2, by + bannerH / 2 + 1);

      const b2w = clamp(L.W * 0.15, 92, 170);
      const b2x = L.W * 0.84 - b2w / 2;
      const b2y = by + bannerH - 22;
      ctx.fillStyle = 'rgba(7, 13, 28, 0.8)';
      roundRect(b2x, b2y, b2w, 22, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(216, 255, 87, 0.38)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#d8ff57';
      ctx.font = `800 ${Math.max(8, L.W * 0.009)}px ${BODY_FONT}`;
      ctx.fillText('SPRINT 200M', b2x + b2w / 2, b2y + 12);
    }

    ctx.fillStyle = '#07101e';
    ctx.fillRect(0, wallY, L.W, 40);
    ctx.fillStyle = 'rgba(255, 244, 223, 0.13)';
    ctx.fillRect(0, wallY, L.W, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fillRect(0, wallY + 30, L.W, 10);
  }

  function drawFloodlights(t) {
    const positions = L.W < 620 ? [0.16, 0.78] : [0.11, 0.49, 0.87];
    const topY = L.H * 0.055;
    const baseY = L.standTop + 64;
    for (let i = 0; i < positions.length; i++) {
      const x = L.W * positions[i];
      const flicker = 0.86 + 0.14 * Math.sin(t * 2.6 + i * 2.1);
      const cone = ctx.createLinearGradient(x, topY, x, baseY + 80);
      cone.addColorStop(0, `rgba(255, 226, 170, ${0.13 * flicker})`);
      cone.addColorStop(1, 'rgba(255, 190, 120, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(x - 20, topY + 10);
      ctx.lineTo(x - 110, baseY + 90);
      ctx.lineTo(x + 110, baseY + 90);
      ctx.lineTo(x + 20, topY + 10);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(6, 12, 24, 0.9)';
      ctx.lineWidth = 4;
      line(x, topY + 16, x, baseY);
      ctx.lineWidth = 3;
      line(x - 24, topY + 18, x + 24, topY + 18);

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const lx = x - 16 + col * 16;
          const ly = topY + 8 + row * 10;
          ctx.fillStyle = `rgba(255, 240, 196, ${0.9 * flicker})`;
          ctx.fillRect(lx - 3, ly - 2.5, 6, 5);
        }
      }

      const glow = ctx.createRadialGradient(x, topY + 12, 0, x, topY + 12, 74);
      glow.addColorStop(0, `rgba(255, 238, 190, ${0.3 * flicker})`);
      glow.addColorStop(0.45, `rgba(255, 190, 110, ${0.09 * flicker})`);
      glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 78, topY - 62, 156, 156);
    }
  }

  function drawTrackBase() {
    const top = L.trackTop;
    for (let i = 0; i <= CFG.lanes; i++) {
      const y = i === 0
        ? top + 1
        : i === CFG.lanes
          ? laneY(CFG.lanes - 1) + L.laneGap * 0.62
          : (laneY(i - 1) + laneY(i)) / 2;
      ctx.strokeStyle = i === 0 ? 'rgba(255, 244, 223, 0.6)' : 'rgba(255, 240, 216, 0.34)';
      ctx.lineWidth = i === 0 ? 3 : 1.4;
      line(0, y, L.W, y);
    }

    ctx.fillStyle = '#f8ead1';
    ctx.fillRect(0, top - 2, L.W, 3);
    ctx.fillStyle = 'rgba(30, 8, 8, 0.35)';
    ctx.fillRect(0, top + 1, L.W, 5);
  }

  function drawTrack() {
    const top = L.trackTop;
    const g = ctx.createLinearGradient(0, top, 0, L.H);
    g.addColorStop(0, '#7c2823');
    g.addColorStop(0.22, '#b04333');
    g.addColorStop(0.62, '#c04b37');
    g.addColorStop(1, '#8b2d28');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, L.W, L.H - top);

    const light = ctx.createRadialGradient(L.W * 0.28, top + 20, 0, L.W * 0.28, top + 20, L.W * 0.85);
    light.addColorStop(0, 'rgba(255, 193, 140, 0.12)');
    light.addColorStop(1, 'rgba(255, 150, 100, 0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, top, L.W, L.H - top);

    for (let lane = 0; lane < CFG.lanes; lane++) {
      const yTop = lane === 0 ? top : (laneY(lane - 1) + laneY(lane)) / 2;
      const yBot = lane === CFG.lanes - 1 ? L.H : (laneY(lane) + laneY(lane + 1)) / 2;
      ctx.fillStyle = lane % 2 === 0 ? 'rgba(255, 244, 223, 0.026)' : 'rgba(50, 10, 10, 0.045)';
      ctx.fillRect(0, yTop, L.W, yBot - yTop);
    }

    const viewStart = game.camera - 8;
    const viewEnd = game.camera + L.W / L.ppm + 8;
    const startM = Math.floor(viewStart / 2) * 2;
    ctx.fillStyle = 'rgba(48, 10, 9, 0.14)';
    for (let m = startM; m < viewEnd; m += 2) {
      const x = screenX(m);
      if (x < -4 || x > L.W + 4) continue;
      for (let lane = 0; lane < CFG.lanes; lane++) {
        const y = laneY(lane) + L.laneGap * 0.28;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.strokeStyle = 'rgba(40, 8, 8, 0.12)';
    ctx.lineWidth = 1;
    for (const s of L.scuffs) {
      if (s.x < viewStart - 4 || s.x > viewEnd + 4) continue;
      const x = screenX(s.x);
      const y = laneY(s.lane) + s.o;
      ctx.globalAlpha = s.a;
      line(x, y, x + s.len, y + 1);
    }
    ctx.globalAlpha = 1;

    const markers = [50, 100, 150];
    ctx.font = `900 ${clamp(L.W * 0.009, 8, 12)}px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of markers) {
      const x = screenX(m);
      if (x < -40 || x > L.W + 40) continue;
      ctx.fillStyle = 'rgba(255, 244, 223, 0.28)';
      ctx.fillText(String(m), x, top + 18);
    }

    const startX = screenX(0);
    if (startX > -30 && startX < L.W + 30) {
      const sw = Math.max(6, L.ppm * 0.36);
      ctx.fillStyle = '#fff4df';
      ctx.fillRect(startX - sw / 2, top + 3, sw, laneY(3) + L.laneGap * 0.55 - top);
      ctx.fillStyle = 'rgba(60, 15, 12, 0.3)';
      ctx.fillRect(startX + sw / 2 - 2, top + 3, 2, laneY(3) + L.laneGap * 0.55 - top);
    }

    const finishX = screenX(CFG.distance);
    if (finishX > -90 && finishX < L.W + 90) {
      const fw = Math.max(10, L.ppm * 0.55);
      const fy = top + 3;
      const fh = laneY(3) + L.laneGap * 0.55 - top;
      const cell = Math.max(5, fw / 3);
      ctx.save();
      ctx.beginPath();
      ctx.rect(finishX - fw / 2, fy, fw, fh);
      ctx.clip();
      for (let row = 0; row * cell < fh; row++) {
        for (let col = 0; col < 3; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#fff4df' : '#1a1110';
          ctx.fillRect(finishX - fw / 2 + col * cell, fy + row * cell, cell, cell);
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255, 244, 223, 0.35)';
      ctx.lineWidth = 2;
      line(finishX, top, finishX, fy + fh);
    }
  }

  function drawCrowdFlashes(t) {
    for (const f of L.flashes) {
      const a = Math.pow(Math.max(0, Math.sin(t * f.s + f.p)), 22);
      if (a < 0.05) continue;
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = '#fff8e8';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.7, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function buildLayers() {
    const dpr = L.dpr;
    const oldCtx = ctx;
    const oldCamera = game.camera;
    game.camera = 0;

    const bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.round(L.W * dpr));
    bg.height = Math.max(1, Math.round((L.trackTop + 2) * dpr));
    const bgc = bg.getContext('2d');
    bgc.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx = bgc;
    drawSky(0);
    drawStadium(0);
    drawFloodlights(0);
    L.bgLayer = bg;

    const tr = document.createElement('canvas');
    tr.width = Math.max(1, Math.round(L.W * dpr));
    tr.height = Math.max(1, Math.round((L.H - L.trackTop) * dpr));
    const trc = tr.getContext('2d');
    trc.setTransform(dpr, 0, 0, dpr, 0, -L.trackTop * dpr);
    ctx = trc;
    drawTrackBase();
    L.trackLayer = tr;

    const fgTop = L.H * 0.78;
    const fg = document.createElement('canvas');
    fg.width = Math.max(1, Math.round(L.W * dpr));
    fg.height = Math.max(1, Math.round((L.H - fgTop) * dpr));
    const fgc = fg.getContext('2d');
    fgc.setTransform(dpr, 0, 0, dpr, 0, -fgTop * dpr);
    ctx = fgc;
    drawForegroundBase();
    L.fgLayer = fg;

    ctx = oldCtx;
    game.camera = oldCamera;
  }

  function drawStartBlocks() {
    if (game.mode !== 'menu' && game.player.x > 8) return;
    const x = screenX(-1.35);
    if (x < -40 || x > L.W + 40) return;
    for (let lane = 0; lane < CFG.lanes; lane++) {
      const y = laneY(lane);
      ctx.fillStyle = 'rgba(20, 10, 9, 0.55)';
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 2);
      ctx.lineTo(x + 9, y - 2);
      ctx.lineTo(x + 9, y - 9);
      ctx.lineTo(x - 10, y - 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = lane === CFG.playerLane ? '#d8ff57' : 'rgba(255, 244, 223, 0.34)';
      ctx.fillRect(x - 8, y - 6, 14, 1.6);
    }
  }

  function drawHurdles() {
    for (const hx of CFG.hurdles) {
      const x = screenX(hx);
      if (x < -80 || x > L.W + 80) continue;
      for (let lane = 0; lane < CFG.lanes; lane++) {
        const y = laneY(lane);
        const sc = laneScale(lane);
        const hh = L.charH * (0.84 / 1.8) * sc;
        const w = clamp(L.ppm * 0.9, 15, 34) * sc;
        ctx.fillStyle = 'rgba(35, 8, 7, 0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y + 3, w * 0.8, 3, 0, 0, TAU);
        ctx.fill();

        ctx.strokeStyle = '#1b1110';
        ctx.lineWidth = 2.6;
        line(x - w * 0.42, y, x - w * 0.42, y - hh);
        line(x + w * 0.42, y, x + w * 0.42, y - hh);
        ctx.strokeStyle = 'rgba(255, 244, 223, 0.62)';
        ctx.lineWidth = 1.2;
        line(x - w * 0.42 - 0.7, y, x - w * 0.42 - 0.7, y - hh);
        line(x + w * 0.42 - 0.7, y, x + w * 0.42 - 0.7, y - hh);

        const barH = Math.max(6, hh * 0.16);
        const barY = y - hh;
        ctx.fillStyle = '#fff4df';
        ctx.fillRect(x - w / 2, barY, w, barH);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - w / 2, barY, w, barH);
        ctx.clip();
        ctx.fillStyle = '#d84230';
        for (let s = -w; s < w; s += 12) {
          ctx.beginPath();
          ctx.moveTo(x + s, barY);
          ctx.lineTo(x + s + 5, barY);
          ctx.lineTo(x + s + 1, barY + barH);
          ctx.lineTo(x + s - 4, barY + barH);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(20, 10, 9, 0.4)';
        ctx.fillRect(x - w / 2, barY + barH - 1.5, w, 1.5);
      }
    }
  }

  function drawFinishGate(t) {
    const x = screenX(CFG.distance);
    if (x < -180 || x > L.W + 180) return;
    const topY = L.trackTop - 126;
    const baseY = laneY(3) + L.laneGap * 0.72;
    const glow = ctx.createLinearGradient(x, topY, x, baseY);
    glow.addColorStop(0, 'rgba(255, 244, 223, 0.2)');
    glow.addColorStop(1, 'rgba(255, 244, 223, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 2, topY, 4, baseY - topY);

    ctx.strokeStyle = 'rgba(7, 13, 28, 0.9)';
    ctx.lineWidth = 5;
    line(x, topY, x, baseY);

    // A pale post keeps the gate connected to its sign above the dark stands.
    ctx.strokeStyle = 'rgba(255, 244, 223, 0.62)';
    ctx.lineWidth = 2;
    line(x, topY, x, L.trackTop + 2);

    const bw = clamp(L.W * 0.12, 82, 160);
    const bh = 30;
    ctx.fillStyle = '#0b1730';
    roundRect(x - bw / 2, topY - 30, bw, bh, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 244, 223, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - bw / 2 + 4, topY - 26, 8, bh - 8);
    ctx.rect(x + bw / 2 - 12, topY - 26, 8, bh - 8);
    ctx.clip();
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#fff4df' : '#1a1110';
        ctx.fillRect(x - bw / 2 + 4 + col * 4, topY - 26 + row * 6, 4, 6);
        ctx.fillRect(x + bw / 2 - 12 + col * 4, topY - 26 + row * 6, 4, 6);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#fff4df';
    ctx.font = `italic 900 ${clamp(L.W * 0.018, 15, 26)}px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FINISH', x, topY - 14);

    const pulse = 0.35 + 0.2 * Math.sin(t * 3);
    ctx.strokeStyle = `rgba(255, 244, 223, ${pulse})`;
    ctx.lineWidth = 2;
    line(x, topY + bh, x, topY + bh + 18);
  }

  /* ---------------------------------------------------------
     Runner illustration
     --------------------------------------------------------- */
  function drawLeg(r, h, swing, near, airT) {
    const hipX = near ? h * 0.018 : -h * 0.005;
    const hipY = -h * 0.46;
    const thigh = h * 0.245;
    const shin = h * 0.25;
    let thighAng;
    let bend;

    if (airT > 0.02) {
      thighAng = Math.PI / 2 - (near ? 0.95 : -0.4) * airT;
      bend = 0.35 + airT * 1.05;
    } else {
      thighAng = Math.PI / 2 - swing * 0.78;
      bend = 0.26 + Math.max(0, -swing) * 0.98;
    }

    const kneeX = hipX + Math.cos(thighAng) * thigh;
    const kneeY = hipY + Math.sin(thighAng) * thigh;
    const shinAng = thighAng + bend;
    const footX = kneeX + Math.cos(shinAng) * shin;
    const footY = kneeY + Math.sin(shinAng) * shin;

    ctx.lineCap = 'round';
    ctx.strokeStyle = near ? r.skin : r.skinDark;
    ctx.lineWidth = h * 0.088;
    line(hipX, hipY, kneeX, kneeY);
    ctx.lineWidth = h * 0.074;
    line(kneeX, kneeY, footX, footY);

    ctx.strokeStyle = near ? r.shoe : hexToRgba(r.shoe, 0.72);
    ctx.lineWidth = h * 0.074;
    const sockX = kneeX + Math.cos(shinAng) * shin * 0.7;
    const sockY = kneeY + Math.sin(shinAng) * shin * 0.7;
    line(sockX, sockY, footX, footY);

    ctx.save();
    ctx.translate(footX, footY);
    ctx.rotate(shinAng - Math.PI / 2);
    ctx.fillStyle = near ? r.shoe : hexToRgba(r.shoe, 0.78);
    ctx.beginPath();
    ctx.ellipse(h * 0.018, 0, h * 0.105, h * 0.043, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8, 12, 20, 0.35)';
    ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.beginPath();
    ctx.moveTo(-h * 0.06, h * 0.027);
    ctx.lineTo(h * 0.115, h * 0.027);
    ctx.stroke();
    ctx.restore();
  }

  function drawArm(r, h, swing, near, airT) {
    const shoulderX = h * 0.035;
    const shoulderY = -h * 0.775;
    let upperAng;
    let foreAng;

    if (airT > 0.02) {
      upperAng = -1.05 + (near ? 0.15 : -0.15);
      foreAng = -0.45;
    } else {
      upperAng = Math.PI / 2 - swing * 0.95;
      foreAng = upperAng - 1.15;
    }

    const ua = h * 0.16;
    const fa = h * 0.15;
    const elbowX = shoulderX + Math.cos(upperAng) * ua;
    const elbowY = shoulderY + Math.sin(upperAng) * ua;
    const handX = elbowX + Math.cos(foreAng) * fa;
    const handY = elbowY + Math.sin(foreAng) * fa;

    ctx.lineCap = 'round';
    ctx.strokeStyle = near ? r.skin : r.skinDark;
    ctx.lineWidth = h * 0.052;
    line(shoulderX, shoulderY, elbowX, elbowY);
    ctx.lineWidth = h * 0.047;
    line(elbowX, elbowY, handX, handY);

    ctx.strokeStyle = r.jersey;
    ctx.lineWidth = h * 0.068;
    line(shoulderX, shoulderY, shoulderX + Math.cos(upperAng) * ua * 0.38, shoulderY + Math.sin(upperAng) * ua * 0.38);

    ctx.fillStyle = near ? r.skin : r.skinDark;
    ctx.beginPath();
    ctx.arc(handX, handY, h * 0.034, 0, TAU);
    ctx.fill();
  }

  function drawTorso(r, h) {
    ctx.fillStyle = r.jersey;
    ctx.beginPath();
    ctx.moveTo(-h * 0.075, -h * 0.47);
    ctx.quadraticCurveTo(-h * 0.115, -h * 0.66, -h * 0.075, -h * 0.77);
    ctx.quadraticCurveTo(h * 0.03, -h * 0.82, h * 0.105, -h * 0.76);
    ctx.quadraticCurveTo(h * 0.11, -h * 0.64, h * 0.075, -h * 0.47);
    ctx.quadraticCurveTo(0, -h * 0.43, -h * 0.075, -h * 0.47);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hexToRgba(r.jerseyDark, 0.55);
    ctx.beginPath();
    ctx.moveTo(-h * 0.075, -h * 0.47);
    ctx.quadraticCurveTo(-h * 0.115, -h * 0.66, -h * 0.075, -h * 0.77);
    ctx.quadraticCurveTo(-h * 0.03, -h * 0.79, -h * 0.01, -h * 0.77);
    ctx.lineTo(-h * 0.018, -h * 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = r.accent;
    ctx.lineWidth = h * 0.022;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(h * 0.088, -h * 0.75);
    ctx.quadraticCurveTo(h * 0.098, -h * 0.62, h * 0.062, -h * 0.49);
    ctx.stroke();

    ctx.fillStyle = r.shorts;
    roundRect(-h * 0.085, -h * 0.535, h * 0.17, h * 0.135, h * 0.032);
    ctx.fill();
    ctx.fillStyle = hexToRgba(r.shortsDark, 0.6);
    ctx.fillRect(-h * 0.085, -h * 0.417, h * 0.17, h * 0.018);
    ctx.fillStyle = r.accent;
    ctx.fillRect(h * 0.055, -h * 0.525, h * 0.018, h * 0.105);

    ctx.save();
    ctx.translate(h * 0.018, -h * 0.635);
    ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.font = `900 ${Math.max(7, h * 0.095)}px "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.number, 0, 0);
    ctx.restore();
  }

  function drawHead(r, h) {
    const hx = h * 0.055;
    const hy = -h * 0.885;
    const hr = h * 0.084;

    ctx.lineCap = 'round';
    ctx.strokeStyle = r.skinDark;
    ctx.lineWidth = h * 0.05;
    line(h * 0.03, -h * 0.78, hx, -h * 0.845);

    if (r.hairStyle === 'pony') {
      ctx.save();
      ctx.translate(hx - h * 0.075, hy + h * 0.03);
      ctx.rotate(0.55);
      ctx.fillStyle = r.hair;
      ctx.beginPath();
      ctx.ellipse(0, 0, h * 0.034, h * 0.078, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = r.hair;
    ctx.beginPath();
    ctx.arc(hx - h * 0.008, hy - h * 0.006, hr * 1.02, 0, TAU);
    ctx.fill();

    ctx.fillStyle = r.skin;
    ctx.beginPath();
    ctx.arc(hx + h * 0.014, hy + h * 0.008, hr * 0.9, 0, TAU);
    ctx.fill();

    ctx.fillStyle = r.skinDark;
    ctx.beginPath();
    ctx.arc(hx - h * 0.024, hy + h * 0.016, hr * 0.26, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(hx, hy - h * 0.018);
    ctx.rotate(-0.08);
    ctx.fillStyle = r.headband;
    roundRect(-hr * 0.96, -h * 0.012, hr * 1.92, h * 0.026, h * 0.008);
    ctx.fill();
    ctx.fillStyle = r.accent;
    ctx.fillRect(-hr * 0.96, -h * 0.001, hr * 1.92, h * 0.005);
    ctx.restore();

    ctx.fillStyle = '#1a1110';
    ctx.beginPath();
    ctx.arc(hx + hr * 0.48, hy + hr * 0.02, Math.max(1, h * 0.009), 0, TAU);
    ctx.fill();

    ctx.fillStyle = r.skin;
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.88, hy + hr * 0.08);
    ctx.lineTo(hx + hr * 1.18, hy + hr * 0.2);
    ctx.lineTo(hx + hr * 0.84, hy + hr * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(70, 30, 22, 0.6)';
    ctx.lineWidth = Math.max(1, h * 0.008);
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.45, hy + hr * 0.48);
    ctx.lineTo(hx + hr * 0.7, hy + hr * 0.46);
    ctx.stroke();
  }

  function drawPlayerTag(sx, headY) {
    const w = clamp(L.W * 0.055, 42, 56);
    const h = clamp(L.H * 0.019, 15, 19);
    const gap = Math.max(8, L.charH * 0.22);
    const x = sx + gap + w / 2;
    const top = headY - h * 0.55;
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.fillStyle = '#ef4a2f';
    roundRect(x - w / 2, top, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 244, 223, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 1, top + h / 2 - 4);
    ctx.lineTo(x - w / 2 - 7, top + h / 2);
    ctx.lineTo(x - w / 2 - 1, top + h / 2 + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff4df';
    ctx.font = `900 ${Math.max(6.5, h * 0.44)}px "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KAMU', x, top + h / 2 + 0.5);
    ctx.restore();
  }

  function drawRunner(r) {
    const sx = screenX(r.x);
    if (sx < -190 || sx > L.W + 190) return;
    const sy = laneY(r.lane);
    const sc = laneScale(r.lane);
    const h = L.charH * sc;
    const air = r.jumpH || 0;
    const jumpPx = air * (h / 1.8);
    const airT = air > 0.02 ? Math.min(1, air / 1.0) : 0;
    const speed = r.speed || 0;
    const lean = 0.05 + (r.isPlayer ? game.tilt.lean * 0.14 : 0) + (r.stumble > 0 ? Math.sin(r.stumble * 48) * 0.1 : 0);
    const bob = Math.sin(r.phase * 2) * (speed > 1 ? h * 0.008 : h * 0.005);

    ctx.save();
    ctx.globalAlpha = 0.87 + r.lane * 0.04;

    if (r.isPlayer) {
      const glow = ctx.createRadialGradient(sx, sy - h * 0.15, 0, sx, sy - h * 0.15, h * 0.9);
      glow.addColorStop(0, 'rgba(255, 200, 120, 0.14)');
      glow.addColorStop(1, 'rgba(255, 200, 120, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sx - h, sy - h * 1.15, h * 2, h * 1.4);
    }

    ctx.fillStyle = 'rgba(38, 10, 8, 0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 3, h * 0.3 * (1 - airT * 0.3), h * 0.055, 0, 0, TAU);
    ctx.fill();

    if (speed > 8.5 && !airT) {
      const a = clamp((speed - 8.5) / 4, 0, 0.42);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(255, 244, 223, 0.8)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const yy = sy - h * (0.18 + i * 0.17);
        line(sx - h * (0.42 + i * 0.07), yy, sx - h * (0.92 + i * 0.16), yy + 2);
      }
      ctx.restore();
    }

    ctx.translate(sx, sy - jumpPx - bob);
    ctx.rotate(lean);

    drawArm(r, h, Math.sin(r.phase + Math.PI), false, airT);
    drawLeg(r, h, Math.sin(r.phase), false, airT);
    drawTorso(r, h);
    drawLeg(r, h, Math.sin(r.phase + Math.PI), true, airT);
    drawArm(r, h, Math.sin(r.phase), true, airT);
    drawHead(r, h);

    ctx.restore();

    if (r.isPlayer) {
      drawPlayerTag(sx, sy - jumpPx - h * 0.82);
    }
  }

  function drawRunners() {
    const sorted = [...game.runners].sort((a, b) => {
      if (a.isPlayer !== b.isPlayer) return a.isPlayer ? 1 : -1;
      return a.lane - b.lane;
    });
    for (const r of sorted) drawRunner(r);
  }

  function drawParticles() {
    for (const p of game.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = `rgba(${p.color}, ${a * 0.6})`;
      ctx.beginPath();
      ctx.arc(screenX(p.x), p.y, Math.max(0.6, p.r * a), 0, TAU);
      ctx.fill();
    }
  }

  function drawConfetti() {
    for (const c of game.confetti) {
      ctx.save();
      ctx.globalAlpha = clamp(c.life, 0, 1);
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  function drawForegroundBase() {
    const top = L.H * 0.78;
    const g = ctx.createLinearGradient(0, top, 0, L.H);
    g.addColorStop(0, 'rgba(3, 7, 14, 0)');
    g.addColorStop(0.55, 'rgba(3, 7, 14, 0.26)');
    g.addColorStop(1, 'rgba(3, 7, 14, 0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, L.W, L.H - top);

    const ry = L.H * 0.862;
    ctx.fillStyle = 'rgba(4, 8, 17, 0.62)';
    ctx.fillRect(0, ry, L.W, 2.5);
    ctx.fillStyle = 'rgba(255, 244, 223, 0.1)';
    ctx.fillRect(0, ry - 1, L.W, 1);
    for (let x = 0; x < L.W + 100; x += 118) {
      ctx.fillStyle = 'rgba(4, 8, 17, 0.45)';
      ctx.fillRect(x, ry, 2, L.H - ry);
    }

    for (const b of L.bokeh) {
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      glow.addColorStop(0, `rgba(255, 190, 120, ${b.a})`);
      glow.addColorStop(1, 'rgba(255, 190, 120, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
  }

  function drawForeground() {
    if (L.fgLayer) {
      const top = L.H * 0.78;
      ctx.drawImage(L.fgLayer, 0, top, L.W, L.H - top);
    } else {
      drawForegroundBase();
    }
  }

  function drawSpeedOverlay() {
    if (game.mode !== 'race' && game.mode !== 'finished') return;
    const speed = game.player ? game.player.speed : 0;
    const a = clamp((speed - 8.5) / 4.5, 0, 0.3);
    if (a <= 0.005) return;
    const edge = L.W * 0.075;
    const g = ctx.createLinearGradient(0, 0, edge, 0);
    g.addColorStop(0, `rgba(255, 244, 223, ${a * 0.7})`);
    g.addColorStop(1, 'rgba(255, 244, 223, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, edge, L.H);
    const g2 = ctx.createLinearGradient(L.W, 0, L.W - edge, 0);
    g2.addColorStop(0, `rgba(255, 244, 223, ${a * 0.7})`);
    g2.addColorStop(1, 'rgba(255, 244, 223, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(L.W - edge, 0, edge, L.H);

    ctx.strokeStyle = `rgba(255, 244, 223, ${a})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      const y = L.H * (0.2 + i * 0.09);
      line(0, y, L.W * 0.07, y - 2);
      line(L.W, y + 3, L.W * 0.93, y + 1);
    }
  }

  function drawGo() {
    if (game.goFlash <= 0) return;
    const p = 1 - game.goFlash / 1.15;
    ctx.save();
    ctx.globalAlpha = clamp(game.goFlash * 2.4, 0, 1);
    ctx.translate(L.W / 2, L.H * 0.31);
    ctx.scale(0.72 + p * 0.58, 0.72 + p * 0.58);
    const size = clamp(L.W * 0.18, 66, 150);
    ctx.font = `italic 900 ${size}px "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.075;
    ctx.strokeStyle = '#07101f';
    ctx.strokeText('GO!', 0, 0);
    ctx.fillStyle = '#d8ff57';
    ctx.fillText('GO!', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = clamp(game.goFlash * 1.4, 0, 0.6);
    ctx.strokeStyle = '#fff4df';
    ctx.lineWidth = 2;
    const cy = L.H * 0.31;
    for (let i = 0; i < 5; i++) {
      const off = 20 + i * 17;
      line(L.W / 2 - off - 50, cy - 8 + i * 4, L.W / 2 - off - 18, cy - 10 + i * 4);
      line(L.W / 2 + off + 18, cy - 10 + i * 4, L.W / 2 + off + 50, cy - 8 + i * 4);
    }
    ctx.restore();
  }

  function drawScreenEffects() {
    if (game.finishFlash > 0) {
      ctx.fillStyle = `rgba(255, 244, 223, ${game.finishFlash * 0.45})`;
      ctx.fillRect(0, 0, L.W, L.H);
    }
    if (game.hitFlash > 0) {
      const g = ctx.createRadialGradient(L.W / 2, L.H / 2, Math.min(L.W, L.H) * 0.2, L.W / 2, L.H / 2, Math.max(L.W, L.H) * 0.7);
      g.addColorStop(0, 'rgba(255, 50, 30, 0)');
      g.addColorStop(1, `rgba(255, 50, 30, ${game.hitFlash * 0.34})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, L.W, L.H);
    }
  }

  function render(t) {
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);

    const shake = game.shake;
    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    if (L.bgLayer) ctx.drawImage(L.bgLayer, 0, 0, L.W, L.trackTop + 2);
    else { drawSky(t); drawStadium(t); drawFloodlights(t); }
    drawCrowdFlashes(t);
    if (L.trackLayer) ctx.drawImage(L.trackLayer, 0, L.trackTop, L.W, L.H - L.trackTop);
    else drawTrackBase();
    drawTrack();
    drawStartBlocks();
    drawHurdles();
    drawFinishGate(t);
    drawRunners();
    drawParticles();
    drawForeground();
    drawSpeedOverlay();

    ctx.restore();

    drawGo();
    drawScreenEffects();
    drawConfetti();
  }

  /* ---------------------------------------------------------
     Results, pause and screens
     --------------------------------------------------------- */
  function resultCopy(place) {
    if (place === 1) return { title: 'JUARA 1', sub: 'Lari yang luar biasa. Garis finis milikmu.' };
    if (place === 2) return { title: 'JUARA 2', sub: 'Sangat dekat. Sedikit lagi menuju puncak.' };
    if (place === 3) return { title: 'JUARA 3', sub: 'Podium! Ritme dan gawang makin rapi.' };
    return { title: 'FINISH KE-4', sub: 'Jangan berhenti. Gawang berikutnya milikmu.' };
  }

  function showResults() {
    if (game.resultShown || !game.player) return;
    game.resultShown = true;
    game.slowmo = 0;
    const p = game.player;
    const time = p.finishTime || game.raceTime;
    game.playerTime = time;
    const isNewBest = !game.best || time < game.best - 0.001;
    if (isNewBest) {
      game.best = time;
      safeStorageSet('lombaLari.best', time.toFixed(2));
      updateBestUI();
    }

    const sorted = getStandings();
    for (const r of sorted) {
      if (!r.finished) {
        r.resultTime = time + Math.max(0.4, (CFG.distance - r.x) / Math.max(3, r.speed));
      }
    }
    game.standings = sorted;
    const place = p.place || (sorted.indexOf(p) + 1);
    game.playerPlace = place;
    const copy = resultCopy(place);

    ui.placeNum.textContent = String(place);
    ui.resultTitle.textContent = copy.title;
    ui.resultSub.textContent = copy.sub;
    ui.resultKicker.textContent = place === 1 ? 'GARIS FINIS · JUARA' : 'GARIS FINIS';
    ui.finalTime.textContent = formatTime(time);
    ui.finalBest.textContent = formatTime(game.best);
    ui.newBest.hidden = !isNewBest;
    ui.medal.className = 'medal' + (place === 1 ? ' is-gold' : place === 2 ? ' is-silver' : place === 3 ? ' is-bronze' : ' is-last');

    ui.standings.innerHTML = '';
    sorted.forEach((r, index) => {
      const li = document.createElement('li');
      if (r.isPlayer) li.className = 'you';

      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(index + 1).padStart(2, '0');

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.setProperty('--c', r.jersey);

      const who = document.createElement('span');
      who.className = 'who';
      who.textContent = r.name;
      if (r.isPlayer) {
        const tag = document.createElement('small');
        tag.textContent = 'KAMU';
        who.appendChild(tag);
      }

      const mark = document.createElement('span');
      mark.className = 'mark';
      const t = r.finished ? r.finishTime : r.resultTime;
      mark.textContent = (r.finished ? '' : '≈ ') + formatTime(t);

      li.append(rank, swatch, who, mark);
      ui.standings.appendChild(li);
    });

    ui.hud.hidden = true;
    ui.controls.hidden = true;
    ui.meters.hidden = true;
    ui.resultScreen.hidden = false;
    Sound.cheer();
    spawnConfetti(90);
  }

  function pauseGame() {
    if (game.mode !== 'race' || game.paused || game.resultShown) return;
    game.paused = true;
    ui.pauseScreen.hidden = false;
    ui.controls.hidden = true;
    ui.meters.hidden = true;
    ui.toast.classList.remove('is-visible');
    Sound.setCrowd(0.012);
  }

  function resumeGame() {
    if (!game.paused) return;
    game.paused = false;
    ui.pauseScreen.hidden = true;
    ui.controls.hidden = false;
    ui.meters.hidden = !(game.combo >= 2 || game.tilt.enabled);
    Sound.setCrowd(0.035);
  }

  function restartRace() {
    ui.pauseScreen.hidden = true;
    ui.resultScreen.hidden = true;
    startRace();
  }

  function updateSoundButton() {
    ui.soundBtn.classList.toggle('is-muted', Sound.muted);
    ui.soundBtn.setAttribute('aria-pressed', String(!Sound.muted));
    ui.soundBtn.setAttribute('aria-label', Sound.muted ? 'Nyalakan suara' : 'Matikan suara');
  }

  function toggleSound() {
    Sound.resume();
    Sound.setMuted(!Sound.muted);
    updateSoundButton();
    if (!Sound.muted) Sound.ui();
  }

  function toggleTilt() {
    Sound.resume();
    if (game.tilt.enabled) {
      disableTilt();
      setTiltStatus('Mode miring dimatikan. Kontrol ketukan tetap aktif.', '');
      Sound.ui();
    } else {
      enableTilt();
    }
  }

  function hideHow() {
    ui.howScreen.hidden = true;
  }

  function showHow() {
    Sound.resume();
    Sound.ui();
    ui.howScreen.hidden = false;
  }

  /* ---------------------------------------------------------
     Events
     --------------------------------------------------------- */
  function bindEvents() {
    ui.startBtn.addEventListener('click', () => {
      Sound.resume();
      Sound.ui();
      startRace();
    });
    ui.howBtn.addEventListener('click', showHow);
    ui.howStart.addEventListener('click', () => {
      hideHow();
      Sound.ui();
      startRace();
    });
    ui.closeHow.addEventListener('click', hideHow);
    ui.soundBtn.addEventListener('click', toggleSound);
    ui.tiltToggle.addEventListener('click', toggleTilt);
    ui.tiltCalibrate.addEventListener('click', calibrateTilt);
    ui.pauseBtn.addEventListener('click', pauseGame);
    ui.resumeBtn.addEventListener('click', resumeGame);
    ui.restartBtn.addEventListener('click', restartRace);
    ui.quitBtn.addEventListener('click', goMenu);
    ui.againBtn.addEventListener('click', restartRace);
    ui.menuBtn.addEventListener('click', goMenu);

    for (const pad of ui.footPads) {
      bindPress(pad, () => triggerFoot(pad.dataset.foot));
    }
    bindPress(ui.jumpBtn, doJump);

    let swipe = null;
    ui.canvas.addEventListener('pointerdown', (event) => {
      if (game.mode !== 'race' || game.paused) return;
      swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    ui.canvas.addEventListener('pointerup', (event) => {
      if (!swipe || event.pointerId !== swipe.id) return;
      if (swipe.y - event.clientY > 26) doJump();
      swipe = null;
    });
    ui.canvas.addEventListener('pointercancel', () => { swipe = null; });

    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();

      if (!ui.howScreen.hidden) {
        if (key === 'escape') hideHow();
        return;
      }

      if (!ui.resultScreen.hidden) {
        if (key === 'enter' || key === ' ') {
          event.preventDefault();
          restartRace();
        } else if (key === 'escape') {
          goMenu();
        }
        return;
      }

      if (game.paused) {
        if (key === 'escape' || key === 'p') {
          event.preventDefault();
          resumeGame();
        }
        return;
      }

      if (game.mode === 'menu') {
        if (key === 'enter' || key === ' ') {
          event.preventDefault();
          startRace();
        }
        return;
      }

      if (event.repeat) return;
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        triggerFoot('left');
      } else if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        triggerFoot('right');
      } else if (key === ' ' || key === 'arrowup' || key === 'w') {
        event.preventDefault();
        doJump();
      } else if (key === 'escape' || key === 'p') {
        event.preventDefault();
        pauseGame();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (game.mode === 'race' && !game.paused) pauseGame();
      } else if (game.mode === 'race' && !game.paused && !game.wakeLock) {
        requestWakeLock();
      }
    });

    window.addEventListener('resize', () => {
      resize();
      if (game.mode === 'race' && game.tilt.enabled) {
        game.tilt.samples = [];
        game.tilt.baseline = null;
        game.tilt.target = 0;
        setTiltStatus('Layar berubah. Kalibrasi ulang sebentar…', '');
      }
    });

    const recalibrateOnRotate = () => {
      if (!game.tilt.enabled) return;
      game.tilt.samples = [];
      game.tilt.baseline = null;
      game.tilt.target = 0;
      setTiltStatus('Kalibrasi ulang… tahan HP stabil.', '');
      window.setTimeout(() => {
        if (game.tilt.enabled && game.tilt.baseline) {
          setTiltStatus('Mode miring siap. Condongkan HP untuk lean.', 'good');
        }
      }, 1000);
    };
    window.addEventListener('orientationchange', recalibrateOnRotate);
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', recalibrateOnRotate);
    }

    document.addEventListener('gesturestart', (event) => event.preventDefault());
    document.addEventListener('dblclick', (event) => event.preventDefault());
  }

  /* ---------------------------------------------------------
     Boot + loop
     --------------------------------------------------------- */
  function init() {
    resize();
    buildFlashes();
    resetMenuScene();
    updateBestUI();
    updateSoundButton();

    if (!game.tilt.supported) {
      ui.tiltHint.textContent = 'Tidak tersedia di perangkat ini';
      setTiltStatus('Sensor gerak tidak tersedia. Kontrol ketukan tetap aktif.', '');
    } else {
      setTiltStatus('Aktifkan mode miring untuk lean otomatis.', '');
    }

    if (Sound.muted) {
      ui.soundBtn.classList.add('is-muted');
    }

    bindEvents();
    window.setTimeout(() => {
      if (game.mode === 'menu') updateHud();
    }, 50);
  }

  let lastFrame = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    render(now / 1000);
    window.requestAnimationFrame(loop);
  }

  init();
  window.requestAnimationFrame(loop);
})();
