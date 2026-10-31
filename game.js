/* =========================================================
   LOMBA LARI — Sprint Kampung
   Vanilla canvas game · touch + optional tilt
   ========================================================= */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;
  const STORE_KEY = 'lombaLari.v1';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };

  function fmtTime(t) {
    if (!Number.isFinite(t)) return '—';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const cs = Math.floor((t * 100) % 100);
    return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function shade(hex, amt) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const r = clamp(((n >> 16) & 255) + amt, 0, 255);
    const g = clamp(((n >> 8) & 255) + amt, 0, 255);
    const b = clamp((n & 255) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  /* ---------------- DOM ---------------- */

  const canvas = $('scene');
  const ctx = canvas.getContext('2d', { alpha: false });

  const els = {
    app: $('app'),
    hud: $('hud'),
    pauseBtn: $('pauseBtn'),
    timer: $('timer'),
    distanceLabel: $('distanceLabel'),
    rankLabel: $('rankLabel'),
    combo: $('combo'),
    comboNum: $('comboNum'),
    progressTrack: $('progressTrack'),
    progressFill: $('progressFill'),
    progressDistance: $('progressDistance'),
    countdown: $('countdown'),
    countdownNum: $('countdownNum'),
    feedbackLayer: $('feedbackLayer'),
    toast: $('toast'),
    bottomUi: $('bottomUi'),
    staminaWrap: document.querySelector('.stamina-wrap'),
    staminaFill: $('staminaFill'),
    staminaPct: $('staminaPct'),
    tiltGauge: $('tiltGauge'),
    tiltBubble: $('tiltBubble'),
    controlHint: $('controlHint'),
    menuScreen: $('menuScreen'),
    bestTime: $('bestTime'),
    bestDistance: $('bestDistance'),
    distanceGroup: $('distanceGroup'),
    difficultyGroup: $('difficultyGroup'),
    controlGroup: $('controlGroup'),
    motionNote: $('motionNote'),
    startBtn: $('startBtn'),
    howBtn: $('howBtn'),
    soundBtn: $('soundBtn'),
    soundOnIcon: $('soundOnIcon'),
    soundOffIcon: $('soundOffIcon'),
    soundLabel: $('soundLabel'),
    pauseScreen: $('pauseScreen'),
    resumeBtn: $('resumeBtn'),
    restartBtn: $('restartBtn'),
    quitBtn: $('quitBtn'),
    resultScreen: $('resultScreen'),
    confettiLayer: $('confettiLayer'),
    resultMedal: $('resultMedal'),
    resultKicker: $('resultKicker'),
    resultTitle: $('resultTitle'),
    resultTime: $('resultTime'),
    newRecord: $('newRecord'),
    resultList: $('resultList'),
    againBtn: $('againBtn'),
    menuBtn: $('menuBtn'),
    resultTip: $('resultTip'),
    howModal: $('howModal'),
    closeHowBtn: $('closeHowBtn'),
    howPlayBtn: $('howPlayBtn'),
  };

  const padEls = Array.from(document.querySelectorAll('.pad'));

  /* ---------------- Racer data ---------------- */

  const PROFILES = {
    joko: {
      name: 'Joko', player: false, shirt: '#8352d6', shorts: '#4b2a8f', skin: '#8d5a3b',
      hair: '#191a21', shoes: '#ff9a3c', bib: '23', hairStyle: 'cap', cap: '#f1c84c',
    },
    budi: {
      name: 'Budi', player: false, shirt: '#2f6fed', shorts: '#1b357f', skin: '#a96b45',
      hair: '#1e2029', shoes: '#fff8e8', bib: '07', hairStyle: 'short',
    },
    player: {
      name: 'Kamu', player: true, shirt: '#e8402f', shorts: '#fff5dd', skin: '#c6865a',
      hair: '#24212a', shoes: '#ffd23f', bib: '01', hairStyle: 'band',
    },
    sari: {
      name: 'Sari', player: false, shirt: '#2f9e5b', shorts: '#1f643c', skin: '#e2a87a',
      hair: '#3a241d', shoes: '#ff7fa2', bib: '12', hairStyle: 'pony',
    },
  };

  const DIFFICULTY = {
    santai: { label: 'Santai', speed: [6.15, 6.6], delay: [0.16, 0.34], surge: 0.05, rubber: 0.55 },
    seru: { label: 'Seru', speed: [7.45, 7.95], delay: [0.1, 0.24], surge: 0.07, rubber: 1 },
    juara: { label: 'Juara', speed: [8.85, 9.25], delay: [0.05, 0.18], surge: 0.08, rubber: 1.15 },
  };

  /* ---------------- Persistence ---------------- */

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  const stored = loadStore();

  const S = {
    mode: 'menu', // menu | countdown | racing | paused | result
    distance: [60, 100, 200].includes(Number(stored.distance)) ? Number(stored.distance) : 100,
    difficulty: DIFFICULTY[stored.difficulty] ? stored.difficulty : 'seru',
    control: 'tap',
    sound: stored.sound !== false,
    best: stored.best && typeof stored.best === 'object' ? stored.best : {},
    raceLength: 100,
    raceTime: 0,
    countdown: 0,
    goTimer: 0,
    finishTimer: 0,
    lastCountLabel: '',
    earlyWarn: 0,
    runners: [],
    player: null,
    camera: -5.5,
    dust: [],
    shake: 0,
    menuPhase: 0,
    lastFrame: performance.now(),
    resulted: false,
  };

  const L = {
    w: 0, h: 0, dpr: 1,
    safeTop: 0, trackTop: 0, trackBottom: 0, laneH: 0,
    pxPerM: 18, skyGrad: null, trackGrad: null, compact: false,
  };

  /* ---------------- Audio ---------------- */

  const Sound = {
    ctx: null,
    master: null,
    noise: null,
    muted: !S.sound,

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 1.1);
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buffer;
      } catch (e) {
        this.ctx = null;
      }
    },

    setMuted(muted) {
      this.muted = muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
      }
    },

    ready() {
      return this.ctx && this.master && !this.muted && this.ctx.state === 'running';
    },

    tone(freq, dur, type = 'sine', vol = 0.15, when = 0, slideTo = null) {
      if (!this.ready()) return;
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },

    noiseBurst(dur, vol, freq, q = 0.9, when = 0) {
      if (!this.ready() || !this.noise) return;
      const t0 = this.ctx.currentTime + when;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    },

    beep(go = false) {
      if (!this.ready()) return;
      if (go) {
        this.tone(660, 0.1, 'square', 0.08);
        this.tone(990, 0.34, 'square', 0.11, 0.09);
      } else {
        this.tone(540, 0.12, 'triangle', 0.13);
      }
    },

    step(foot, perfect) {
      if (!this.ready()) return;
      const f = foot === 'left' ? 142 : 124;
      this.tone(f, 0.1, 'sine', 0.13, 0, 54);
      this.noiseBurst(0.055, 0.045, perfect ? 1250 : 880, 0.7);
      if (perfect) this.tone(1120, 0.07, 'triangle', 0.035, 0.015);
    },

    bad() {
      if (!this.ready()) return;
      this.tone(170, 0.16, 'sawtooth', 0.055, 0, 74);
    },

    perfect() {
      if (!this.ready()) return;
      this.tone(880, 0.07, 'triangle', 0.05);
      this.tone(1320, 0.1, 'triangle', 0.045, 0.06);
    },

    go() {
      if (!this.ready()) return;
      this.tone(523, 0.12, 'square', 0.08);
      this.tone(784, 0.22, 'square', 0.09, 0.1);
      this.noiseBurst(0.8, 0.05, 1100, 0.45, 0.06);
    },

    finish() {
      if (!this.ready()) return;
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => this.tone(n, 0.24, 'triangle', 0.1, i * 0.09));
      this.tone(1319, 0.5, 'triangle', 0.07, 0.36);
      this.noiseBurst(1.35, 0.075, 950, 0.35, 0.05);
    },
  };

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* no-op */ }
    }
  }

  /* ---------------- UI helpers ---------------- */

  let toastTimer = 0;
  function toast(message, ms = 2400) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), ms);
  }

  function feedback(text, kind = '') {
    const el = document.createElement('div');
    el.className = `feedback ${kind}`.trim();
    el.textContent = text;
    els.feedbackLayer.appendChild(el);
    while (els.feedbackLayer.childElementCount > 3) {
      els.feedbackLayer.firstElementChild.remove();
    }
    setTimeout(() => el.remove(), 900);
  }

  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        best: S.best,
        sound: S.sound,
        distance: S.distance,
        difficulty: S.difficulty,
      }));
    } catch (e) { /* storage might be blocked */ }
  }

  function updateBestBadge() {
    els.bestDistance.textContent = `${S.distance} m`;
    const best = Number(S.best[S.distance]);
    els.bestTime.textContent = Number.isFinite(best) && best > 0 ? fmtTime(best) : '—';
  }

  function syncMenuUI() {
    Array.from(els.distanceGroup.children).forEach((btn) => {
      const on = Number(btn.dataset.distance) === S.distance;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    Array.from(els.difficultyGroup.children).forEach((btn) => {
      const on = btn.dataset.difficulty === S.difficulty;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    Array.from(els.controlGroup.children).forEach((btn) => {
      const on = btn.dataset.control === S.control;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    updateBestBadge();
    updateSoundUI();
    updateMotionNote();
  }

  function updateSoundUI() {
    els.soundOnIcon.classList.toggle('is-hidden', !S.sound);
    els.soundOffIcon.classList.toggle('is-hidden', S.sound);
    els.soundBtn.setAttribute('aria-pressed', String(S.sound));
    els.soundLabel.textContent = S.sound ? 'Suara' : 'Bisu';
  }

  function updateMotionNote() {
    if (S.control !== 'tilt') {
      els.motionNote.classList.add('is-hidden');
      return;
    }
    els.motionNote.classList.remove('is-hidden');
    if (motion.listening) {
      els.motionNote.textContent = 'Sensor gerak aktif. Miringkan layar kiri–kanan bergantian saat lari.';
    } else if (!motion.supported) {
      els.motionNote.textContent = 'Sensor gerak tidak tersedia di perangkat ini. Kontrol ketuk tetap bisa dipakai.';
    } else {
      els.motionNote.textContent = 'Butuh izin sensor gerak. Tekan Miring untuk mengaktifkan.';
    }
  }

  function setControlUI(mode) {
    S.control = mode;
    Array.from(els.controlGroup.children).forEach((btn) => {
      const on = btn.dataset.control === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    els.tiltGauge.classList.toggle('is-hidden', mode !== 'tilt');
    els.controlHint.innerHTML = mode === 'tilt'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M17 4v16M7 9h10M7 15h10"/></svg>Miringkan kiri–kanan, ketuk tetap bisa'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M17 4v16M7 9h10M7 15h10"/></svg>Ketuk bergantian mengikuti irama';
    updateMotionNote();
    computeLayout();
  }

  /* ---------------- Canvas sizing ---------------- */

  function safeInset(side) {
    const probe = document.createElement('div');
    probe.style.cssText = `position:fixed;left:0;top:0;width:0;height:env(safe-area-inset-${side},0px);visibility:hidden;pointer-events:none;`;
    document.body.appendChild(probe);
    const v = probe.getBoundingClientRect().height;
    probe.remove();
    return v || 0;
  }

  function computeLayout() {
    L.w = window.innerWidth;
    L.h = window.innerHeight;
    L.compact = L.w > L.h;
    L.safeTop = safeInset('top');

    const bottomRect = els.bottomUi.getBoundingClientRect();
    const bottomLimit = bottomRect.height > 10 ? bottomRect.top : L.h - (L.compact ? 118 : 190);

    const topFloor = L.safeTop + (L.compact ? 66 : 122);
    L.trackTop = Math.max(topFloor, L.h * (L.compact ? 0.19 : 0.235));
    L.trackBottom = Math.min(L.h - 8, Math.max(L.trackTop + (L.compact ? 150 : 215), bottomLimit - 7));
    L.laneH = Math.max(34, (L.trackBottom - L.trackTop) / 4);
    L.pxPerM = clamp(L.w / (L.compact ? 27 : 21.5), 13, 40);

    L.skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(L.h * 0.6, 260));
    L.skyGrad.addColorStop(0, '#ffdd8d');
    L.skyGrad.addColorStop(0.4, '#ffbd76');
    L.skyGrad.addColorStop(0.75, '#f79572');
    L.skyGrad.addColorStop(1, '#e9806e');

    L.trackGrad = ctx.createLinearGradient(0, L.trackTop, 0, L.trackBottom);
    L.trackGrad.addColorStop(0, '#d47553');
    L.trackGrad.addColorStop(0.45, '#ca6247');
    L.trackGrad.addColorStop(1, '#b94e39');
  }

  function resizeCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    L.dpr = dpr;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeLayout();
  }

  /* ---------------- Runners ---------------- */

  function makeRunner(profile, lane, cfg, preview) {
    return {
      name: profile.name,
      isPlayer: !!profile.player,
      lane,
      shirt: profile.shirt,
      shorts: profile.shorts,
      skin: profile.skin,
      hair: profile.hair,
      shoes: profile.shoes,
      bib: profile.bib,
      hairStyle: profile.hairStyle,
      cap: profile.cap,
      dot: null,
      dist: 0,
      v: 0,
      phase: rand(0, TAU),
      stamina: 100,
      lastFoot: null,
      lastTapAt: -99,
      lastTapAny: -99,
      lastMsgAt: -99,
      combo: 0,
      comboTimer: 0,
      finished: false,
      finishTime: 0,
      place: 0,
      lowWarned: false,
      dustTimer: rand(0.04, 0.18),
      preview: !!preview,
      aiBase: preview ? 0 : rand(cfg.speed[0], cfg.speed[1]),
      aiDelay: preview ? 0 : rand(cfg.delay[0], cfg.delay[1]),
      aiPhase: rand(0, TAU),
    };
  }

  function setupRunners(preview = false) {
    const cfg = DIFFICULTY[S.difficulty];
    const list = [
      makeRunner(PROFILES.joko, 0, cfg, preview),
      makeRunner(PROFILES.budi, 1, cfg, preview),
      makeRunner(PROFILES.player, 2, cfg, preview),
      makeRunner(PROFILES.sari, 3, cfg, preview),
    ];
    if (preview) {
      list.forEach((r) => { r.phase = rand(0, TAU); });
    }
    S.runners = list;
    S.player = list.find((r) => r.isPlayer);
    buildProgressDots();
  }

  function buildProgressDots() {
    els.progressTrack.querySelectorAll('.progress-dot').forEach((n) => n.remove());
    S.runners.forEach((r) => {
      const dot = document.createElement('span');
      dot.className = `progress-dot${r.isPlayer ? ' is-player' : ''}`;
      dot.style.setProperty('--dot', r.shirt);
      dot.style.setProperty('--dot-y', `${[-8, -3, 3, 8][r.lane] || 0}px`);
      dot.title = r.isPlayer ? 'Kamu' : r.name;
      els.progressTrack.appendChild(dot);
      r.dot = dot;
    });
  }

  function resetPreview() {
    setupRunners(true);
    S.camera = -5.5;
  }

  /* ---------------- Flow ---------------- */

  let starting = false;

  async function startGuarded() {
    if (starting) return;
    starting = true;
    Sound.init();
    if (S.control === 'tilt' && !motion.listening) {
      const ok = await enableTilt();
      if (!ok) {
        setControlUI('tap');
        toast('Sensor gerak tidak aktif. Kontrol ketuk diaktifkan.');
      }
    }
    startRace();
    starting = false;
  }

  function startRace() {
    Sound.init();
    els.feedbackLayer.replaceChildren();
    els.toast.classList.remove('is-visible');
    closeHow();
    setupRunners(false);

    S.raceLength = S.distance;
    S.raceTime = 0;
    S.countdown = 3.8;
    S.goTimer = 0;
    S.finishTimer = 0;
    S.lastCountLabel = '3';
    S.earlyWarn = 0;
    S.shake = 0;
    S.dust = [];
    S.resulted = false;
    S.camera = Math.max(-7, S.camera);
    S.mode = 'countdown';

    els.menuScreen.classList.remove('is-open');
    els.menuScreen.setAttribute('aria-hidden', 'true');
    els.resultScreen.classList.remove('is-open');
    els.resultScreen.setAttribute('aria-hidden', 'true');
    els.pauseScreen.classList.remove('is-open');
    els.pauseScreen.setAttribute('aria-hidden', 'true');
    els.confettiLayer.replaceChildren();
    els.hud.classList.remove('is-hidden');
    els.bottomUi.classList.remove('is-hidden');
    els.countdown.classList.remove('is-hidden');
    els.combo.classList.add('is-hidden');
    els.progressDistance.textContent = `${S.distance} M`;
    els.pauseBtn.disabled = true;
    els.timer.textContent = fmtTime(0);
    els.distanceLabel.textContent = `0 / ${S.distance} M`;
    els.rankLabel.textContent = 'POS —';
    els.staminaFill.style.width = '100%';
    els.staminaPct.textContent = '100%';
    els.staminaWrap.classList.remove('is-low');
    els.pauseScreen.classList.remove('is-open');

    if (S.control === 'tilt') {
      motion.neutral = motion.seen ? motion.raw : null;
      motion.smooth = motion.seen ? motion.raw : 0;
      motion.samples = [];
      motion.armed = true;
    }

    computeLayout();
    setCountdownLabel('3');
    updateHud();
    updateProgressUI();
    Sound.beep(false);
  }

  function setCountdownLabel(label) {
    els.countdownNum.textContent = label;
    els.countdownNum.classList.toggle('is-go', label === 'GO!');
    els.countdownNum.classList.remove('is-pop');
    void els.countdownNum.offsetWidth;
    els.countdownNum.classList.add('is-pop');
    const kicker = els.countdown.querySelector('.countdown-kicker');
    const hint = els.countdown.querySelector('.countdown-hint');
    if (kicker) kicker.textContent = label === 'GO!' ? 'MULAI!' : 'SIAP DI GARIS';
    if (hint) {
      hint.textContent = label === 'GO!'
        ? (S.control === 'tilt' ? 'Miringkan kiri–kanan!' : 'Ketuk kiri & kanan!')
        : (S.control === 'tilt' ? 'Miringkan kiri–kanan bergantian' : 'Ketuk kiri & kanan bergantian');
    }
  }

  function startRunning() {
    if (S.mode !== 'countdown') return;
    S.mode = 'racing';
    S.raceTime = 0;
    S.goTimer = 0.85;
    els.pauseBtn.disabled = false;
    setCountdownLabel('GO!');
    Sound.beep(true);
    Sound.go();
    vibrate(24);
    feedback('AYO LARI!', 'big perfect');
  }

  function onPlayerFinished() {
    const p = S.player;
    if (!p || p.finished) return;
    p.finished = true;
    p.finishTime = S.raceTime;
    p.v = 0;
    S.finishTimer = 1.45;
    S.shake = 0.5;
    els.pauseBtn.disabled = true;
    feedback('FINISH!', 'big perfect');
    Sound.finish();
    vibrate([28, 35, 90]);
    spawnDust(p, 14);
  }

  function showResults() {
    if (S.mode === 'result') return;
    S.mode = 'result';
    S.resulted = true;

    const now = S.raceTime;
    S.runners.forEach((r) => {
      if (!r.finished) {
        r.finished = true;
        r.finishTime = now + Math.max(0, S.raceLength - r.dist) / Math.max(2.4, r.v || 2.4);
      }
    });

    const ordered = [...S.runners].sort((a, b) => a.finishTime - b.finishTime);
    ordered.forEach((r, i) => { r.place = i + 1; });

    const p = S.player;
    const place = p.place;
    const previous = Number(S.best[S.distance]);
    const isRecord = !Number.isFinite(previous) || previous <= 0 || p.finishTime < previous - 0.004;
    if (isRecord) {
      S.best[S.distance] = p.finishTime;
      saveStore();
    }
    updateBestBadge();

    els.resultMedal.textContent = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '🏁';
    els.resultKicker.textContent = `FINISH · ${S.distance} M · ${DIFFICULTY[S.difficulty].label.toUpperCase()}`;
    els.resultTitle.textContent = place === 1
      ? 'KAMU JUARA!'
      : place === 2
        ? 'MANTAP, JUARA 2!'
        : place === 3
          ? 'JUARA 3!'
          : 'COBA LAGI!';
    els.resultTime.textContent = fmtTime(p.finishTime);

    els.newRecord.classList.toggle('is-hidden', !isRecord);
    if (isRecord) {
      els.newRecord.textContent = previous > 0 ? `★ REKOR BARU · ${fmtTime(p.finishTime)} ★` : '★ REKOR PERTAMA ★';
    }

    els.resultList.replaceChildren();
    ordered.forEach((r) => {
      const li = document.createElement('li');
      if (r.isPlayer) li.classList.add('is-player');
      const rank = document.createElement('span');
      rank.className = 'result-rank';
      rank.textContent = String(r.place);
      const dot = document.createElement('span');
      dot.className = 'result-dot';
      dot.style.setProperty('--dot', r.shirt);
      const name = document.createElement('span');
      name.className = 'result-name';
      name.textContent = r.isPlayer ? 'KAMU' : r.name.toUpperCase();
      const time = document.createElement('time');
      time.textContent = fmtTime(r.finishTime);
      li.append(rank, dot, name, time);
      els.resultList.appendChild(li);
    });

    if (place === 1) {
      els.resultTip.textContent = 'Keren! Coba jarak lebih jauh atau tantang level Juara.';
    } else if (place <= 3) {
      els.resultTip.textContent = 'Sedikit lagi! Jaga irama dan sisakan stamina untuk sprint akhir.';
    } else {
      els.resultTip.textContent = 'Jangan menyerah. Ketuk bergantian dengan tempo stabil, lalu kejar di akhir.';
    }

    els.hud.classList.add('is-hidden');
    els.bottomUi.classList.add('is-hidden');
    els.countdown.classList.add('is-hidden');
    els.resultScreen.classList.add('is-open');
    els.resultScreen.setAttribute('aria-hidden', 'false');

    if (isRecord || place === 1) launchConfetti();
    else els.confettiLayer.replaceChildren();
  }

  function showMenu() {
    S.mode = 'menu';
    S.finishTimer = 0;
    S.goTimer = 0;
    S.shake = 0;
    S.dust = [];
    S.resulted = false;
    resetPreview();
    els.menuScreen.classList.add('is-open');
    els.menuScreen.setAttribute('aria-hidden', 'false');
    els.resultScreen.classList.remove('is-open');
    els.resultScreen.setAttribute('aria-hidden', 'true');
    els.pauseScreen.classList.remove('is-open');
    els.pauseScreen.setAttribute('aria-hidden', 'true');
    els.confettiLayer.replaceChildren();
    els.feedbackLayer.replaceChildren();
    els.hud.classList.add('is-hidden');
    els.bottomUi.classList.add('is-hidden');
    els.countdown.classList.add('is-hidden');
    els.combo.classList.add('is-hidden');
    els.pauseBtn.disabled = true;
    els.staminaWrap.classList.remove('is-low');
    updateBestBadge();
    computeLayout();
  }

  function togglePause(force) {
    if (S.mode === 'racing' && force !== false) {
      S.mode = 'paused';
      els.pauseScreen.classList.add('is-open');
      els.pauseScreen.setAttribute('aria-hidden', 'false');
      padEls.forEach((p) => p.classList.remove('pressed'));
      Sound.setMuted(true);
    } else if (S.mode === 'paused') {
      S.mode = 'racing';
      els.pauseScreen.classList.remove('is-open');
      els.pauseScreen.setAttribute('aria-hidden', 'true');
      Sound.setMuted(!S.sound);
    }
  }

  function resumeRace() {
    if (S.mode === 'paused') {
      S.mode = 'racing';
      els.pauseScreen.classList.remove('is-open');
      els.pauseScreen.setAttribute('aria-hidden', 'true');
      Sound.setMuted(!S.sound);
      if (S.player) {
        S.player.lastTapAt = performance.now() / 1000 - 0.18;
        S.player.lastTapAny = -99;
      }
    }
  }

  function restartRace() {
    els.pauseScreen.classList.remove('is-open');
    els.pauseScreen.setAttribute('aria-hidden', 'true');
    Sound.setMuted(!S.sound);
    startRace();
  }

  function quitToMenu() {
    Sound.setMuted(!S.sound);
    showMenu();
  }

  function openHow() {
    els.howModal.classList.add('is-open');
    els.howModal.setAttribute('aria-hidden', 'false');
  }

  function closeHow() {
    els.howModal.classList.remove('is-open');
    els.howModal.setAttribute('aria-hidden', 'true');
  }

  /* ---------------- Stride input ---------------- */

  function stride(foot, source = 'tap') {
    if (S.mode === 'countdown') {
      if (S.earlyWarn <= 0) {
        feedback('TUNGGU GO!', 'bad');
        S.earlyWarn = 1.2;
      }
      return;
    }
    if (S.mode !== 'racing') return;
    const p = S.player;
    if (!p || p.finished) return;

    const now = performance.now() / 1000;
    if (now - p.lastTapAny < 0.05) return;
    p.lastTapAny = now;

    const interval = p.lastTapAt < 0 ? Infinity : now - p.lastTapAt;
    let eff = 1;
    let perfect = false;
    let msg = '';
    let kind = '';

    if (!p.lastFoot) {
      eff = 0.96;
    } else if (foot === p.lastFoot) {
      eff = 0.26;
      msg = 'KAKI SAMA';
      kind = 'bad';
      p.combo = 0;
      p.comboTimer = 0;
      p.v = Math.max(0, p.v * 0.97);
      Sound.bad();
      S.shake = Math.max(S.shake, 0.2);
    } else if (interval < 0.105) {
      eff = 0.5;
      msg = 'TERLALU CEPAT';
      kind = 'bad';
      p.combo = 0;
      p.comboTimer = 0;
      p.v = Math.max(0, p.v * 0.985);
    } else if (interval >= 0.13 && interval <= 0.28) {
      eff = 1.14;
      perfect = true;
      p.combo += 1;
      p.comboTimer = 2.15;
    } else if (interval < 0.43) {
      eff = 1;
    } else if (interval < 0.64) {
      eff = 0.86;
      p.combo = 0;
      p.comboTimer = 0;
    } else {
      eff = 0.72;
      p.combo = 0;
      p.comboTimer = 0;
    }

    p.stamina = Math.max(0, p.stamina - 2.8);
    const staminaMult = p.stamina < 25 ? 0.6 + 0.4 * (p.stamina / 25) : 1;
    let impulse = 0.86 * eff * staminaMult;
    if (perfect) impulse *= 1.08;

    if (perfect && p.combo > 0 && p.combo % 8 === 0) {
      impulse += 0.85;
      msg = 'LUAR BIASA!';
      kind = 'big perfect';
      S.shake = Math.max(S.shake, 0.35);
      vibrate([18, 20, 35]);
    } else if (perfect && p.combo % 5 === 0) {
      msg = p.combo >= 10 ? 'MANTAP!' : 'IRAMA!';
      kind = 'perfect';
    }

    p.v = Math.min(15, p.v + impulse);
    p.lastTapAt = now;
    p.lastFoot = foot;
    p.phase += 0.78;
    spawnDust(p, 2);
    Sound.step(foot, perfect);
    if (perfect && (p.combo % 4 === 0 || p.combo === 1)) Sound.perfect();
    if (source === 'touch') vibrate(perfect ? 9 : 6);

    const realNow = performance.now() / 1000;
    if (msg && (kind.includes('big') || realNow - p.lastMsgAt > 0.5)) {
      feedback(msg, kind);
      p.lastMsgAt = realNow;
    }
    if (p.stamina <= 8 && !p.lowWarned) {
      p.lowWarned = true;
      feedback('NAPAS HABIS!', 'bad');
    } else if (p.stamina > 30) {
      p.lowWarned = false;
    }

    updateComboUI();
    updateHud();
  }

  function updateComboUI() {
    const p = S.player;
    if (!p) return;
    if (p.combo >= 2) {
      els.combo.classList.remove('is-hidden');
      els.comboNum.textContent = String(Math.min(99, p.combo));
      els.combo.style.animation = 'none';
      void els.combo.offsetWidth;
      els.combo.style.animation = 'comboPop 0.25s cubic-bezier(0.2, 1.7, 0.5, 1)';
    } else {
      els.combo.classList.add('is-hidden');
    }
  }

  function spawnDust(r, count = 2) {
    if (!r || !L.laneH) return;
    for (let i = 0; i < count; i++) {
      const life = rand(0.4, 0.8);
      S.dust.push({
        dist: r.dist + rand(-0.45, 0.1),
        lane: r.lane,
        ox: rand(-5, 5),
        oy: rand(-2, 1),
        vx: -rand(14, 45),
        vy: -rand(6, 26),
        life,
        max: life,
        size: rand(1.4, 3.4),
      });
    }
    if (S.dust.length > 130) S.dust.splice(0, S.dust.length - 130);
  }

  function launchConfetti() {
    els.confettiLayer.replaceChildren();
    const colors = ['#e8402f', '#ffd23f', '#fff5dd', '#189b86', '#2f6fed', '#ff8a5c'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 54; i++) {
      const s = document.createElement('span');
      s.className = 'confetti';
      s.style.left = `${rand(2, 98)}%`;
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = `${rand(2.1, 4.2)}s`;
      s.style.animationDelay = `${rand(0, 0.65)}s`;
      s.style.width = `${rand(5, 11)}px`;
      s.style.height = `${rand(8, 16)}px`;
      s.style.setProperty('--drift', `${rand(-130, 130)}px`);
      s.style.setProperty('--spin', `${rand(-720, 1080)}deg`);
      frag.appendChild(s);
    }
    els.confettiLayer.appendChild(frag);
  }

  /* ---------------- Tilt motion ---------------- */

  const motion = {
    supported: typeof window.DeviceOrientationEvent !== 'undefined',
    listening: false,
    seen: false,
    raw: 0,
    smooth: 0,
    neutral: null,
    samples: [],
    armed: true,
    lastTrigger: -99,
  };

  function orientationAngle() {
    if (window.screen && window.screen.orientation && Number.isFinite(window.screen.orientation.angle)) {
      return window.screen.orientation.angle;
    }
    return Number.isFinite(window.orientation) ? window.orientation : 0;
  }

  function handleOrientation(e) {
    const angle = orientationAngle();
    const gamma = Number.isFinite(e.gamma) ? e.gamma : 0;
    const beta = Number.isFinite(e.beta) ? e.beta : 0;
    let raw;
    if (Math.abs(angle) === 90) {
      raw = angle === 90 ? beta : -beta;
    } else {
      raw = angle === 180 ? -gamma : gamma;
    }

    if (!motion.seen) {
      motion.seen = true;
      motion.smooth = raw;
    }
    motion.raw = raw;
    motion.smooth += (raw - motion.smooth) * 0.28;

    if (motion.neutral === null) {
      motion.samples.push(raw);
      if (motion.samples.length >= 10) {
        motion.neutral = motion.samples.reduce((a, b) => a + b, 0) / motion.samples.length;
        motion.samples = [];
      }
    }

    updateTiltGauge();
    if (S.control === 'tilt' && S.mode === 'racing') checkTilt();
  }

  function checkTilt() {
    if (motion.neutral === null) return;
    const d = motion.smooth - motion.neutral;
    if (Math.abs(d) < 3.5) motion.armed = true;
    const now = performance.now() / 1000;
    if (motion.armed && Math.abs(d) > 9 && now - motion.lastTrigger > 0.09) {
      motion.armed = false;
      motion.lastTrigger = now;
      stride(d < 0 ? 'left' : 'right', 'tilt');
    }
  }

  function updateTiltGauge() {
    if (!els.tiltBubble) return;
    const d = motion.neutral === null ? 0 : motion.smooth - motion.neutral;
    const max = Math.min(64, L.w * 0.19);
    const px = clamp(d / 22, -1, 1) * max;
    els.tiltBubble.style.transform = `translateX(${px.toFixed(1)}px)`;
  }

  function calibrateTilt() {
    if (!motion.seen) {
      toast('Gerakkan perangkat dulu untuk membaca sensor.');
      return;
    }
    motion.neutral = motion.raw;
    motion.smooth = motion.raw;
    motion.samples = [];
    motion.armed = true;
    updateTiltGauge();
    toast('Sensor dikalibrasi ulang.');
    vibrate(12);
  }

  async function enableTilt() {
    if (motion.listening) return true;
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) {
      motion.supported = false;
      updateMotionNote();
      return false;
    }
    motion.supported = true;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission !== 'granted') {
          updateMotionNote();
          return false;
        }
      } catch (e) {
        updateMotionNote();
        return false;
      }
    }
    window.addEventListener('deviceorientation', handleOrientation, true);
    motion.listening = true;
    motion.samples = [];
    motion.neutral = null;
    motion.armed = true;
    updateMotionNote();
    setTimeout(() => {
      if (motion.listening && motion.neutral === null && motion.seen) {
        motion.neutral = motion.raw;
      }
    }, 800);
    return true;
  }

  async function chooseControl(mode) {
    if (mode === 'tilt') {
      const ok = await enableTilt();
      if (!ok) {
        setControlUI('tap');
        toast('Izin sensor gerak tidak diberikan. Kontrol ketuk tetap aktif.');
        return;
      }
      setControlUI('tilt');
      toast('Miringkan layar kiri–kanan bergantian.', 2800);
    } else {
      setControlUI('tap');
    }
  }

  /* ---------------- Update ---------------- */

  function updateMenu(dt) {
    S.menuPhase += dt;
    S.runners.forEach((r) => { r.phase += 3.4 * dt; });
    updateCamera(dt);
  }

  function updateCountdown(dt) {
    S.countdown -= dt;
    S.earlyWarn = Math.max(0, S.earlyWarn - dt);
    S.runners.forEach((r) => { r.phase += 2.6 * dt; });
    updateCamera(dt);

    if (S.countdown <= 0.8) {
      startRunning();
      return;
    }
    const label = S.countdown > 2.8 ? '3' : S.countdown > 1.8 ? '2' : '1';
    if (label !== S.lastCountLabel) {
      S.lastCountLabel = label;
      setCountdownLabel(label);
      Sound.beep(false);
    }
  }

  function updateRace(dt) {
    S.raceTime += dt;
    S.earlyWarn = Math.max(0, S.earlyWarn - dt);

    if (S.goTimer > 0) {
      S.goTimer -= dt;
      if (S.goTimer <= 0) els.countdown.classList.add('is-hidden');
    }

    updateAI(dt);
    updatePlayer(dt);
    updateDust(dt);

    if (S.player.comboTimer > 0) {
      S.player.comboTimer -= dt;
      if (S.player.comboTimer <= 0 && S.player.combo > 0) {
        S.player.combo = 0;
        updateComboUI();
      }
    }

    updateCamera(dt);
    updateHud();

    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 2.6);

    if (S.finishTimer > 0) {
      S.finishTimer -= dt;
      if (S.finishTimer <= 0) showResults();
    }
  }

  function updateAI(dt) {
    const cfg = DIFFICULTY[S.difficulty];
    for (const r of S.runners) {
      if (r.isPlayer) continue;

      if (r.finished) {
        r.phase += 2.3 * dt;
        r.v *= Math.pow(0.25, dt);
        r.dist = Math.min(S.raceLength + 2.6, r.dist + r.v * dt);
        continue;
      }

      const elapsed = S.raceTime - r.aiDelay;
      if (elapsed < 0) continue;

      const ramp = clamp(elapsed / 1.5, 0, 1);
      let target = r.aiBase * (0.44 + 0.56 * ramp);
      target *= 1 + Math.sin(S.raceTime * 1.05 + r.aiPhase) * cfg.surge;

      const gap = S.player.dist - r.dist;
      target *= 1 + clamp(gap, -20, 20) * 0.0036 * cfg.rubber;

      r.v += (target - r.v) * Math.min(1, dt * 2.35);
      r.dist += r.v * dt;
      r.phase += (3.4 + r.v * 1.24) * dt;

      r.dustTimer -= dt;
      if (r.dustTimer <= 0 && r.v > 2) {
        r.dustTimer = rand(0.1, 0.22);
        spawnDust(r, 1);
      }

      if (r.dist >= S.raceLength) {
        r.finished = true;
        r.finishTime = S.raceTime;
        r.dist = S.raceLength;
        spawnDust(r, 5);
      }
    }
  }

  function updatePlayer(dt) {
    const p = S.player;
    if (!p) return;

    if (p.finished) {
      p.phase += 2.6 * dt;
      p.stamina = Math.min(100, p.stamina + 9.5 * dt);
      return;
    }

    p.v = Math.max(0, p.v - p.v * 0.42 * dt);
    p.dist += p.v * dt;
    p.phase += (3.4 + p.v * 1.24) * dt;
    p.stamina = Math.min(100, p.stamina + 9.5 * dt);

    p.dustTimer -= dt;
    if (p.dustTimer <= 0 && p.v > 4) {
      p.dustTimer = rand(0.09, 0.18);
      spawnDust(p, 1);
    }

    if (p.dist >= S.raceLength) {
      p.dist = S.raceLength;
      onPlayerFinished();
    }
  }

  function updateDust(dt) {
    for (let i = S.dust.length - 1; i >= 0; i--) {
      const d = S.dust[i];
      d.life -= dt;
      if (d.life <= 0) {
        S.dust.splice(i, 1);
        continue;
      }
      d.ox += d.vx * dt;
      d.oy += d.vy * dt;
      d.vy += 34 * dt;
    }
  }

  function updateCamera(dt) {
    let target;
    if (S.mode === 'menu') {
      target = -5.5;
    } else if (S.player) {
      const anchor = L.w * (S.player.finished ? 0.52 : (L.compact ? 0.36 : 0.32));
      target = S.player.dist - anchor / L.pxPerM;
      target = Math.max(-7, target);
    } else {
      target = -5.5;
    }
    const k = 1 - Math.exp(-dt * 6.5);
    S.camera += (target - S.camera) * k;
  }

  function liveRank() {
    const ordered = [...S.runners].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.dist - a.dist;
    });
    return ordered.indexOf(S.player) + 1;
  }

  function updateProgressUI() {
    if (!S.player) return;
    const pct = clamp(S.player.dist / S.raceLength, 0, 1) * 100;
    els.progressFill.style.width = `${pct}%`;
    S.runners.forEach((r) => {
      if (!r.dot) return;
      r.dot.style.left = `${clamp(r.dist / S.raceLength, 0, 1) * 100}%`;
    });
  }

  function updateHud() {
    if (!S.player || (S.mode !== 'racing' && S.mode !== 'countdown')) return;
    const p = S.player;

    const shown = p.finished ? p.finishTime : S.raceTime;
    const timeText = fmtTime(shown);
    if (els.timer.textContent !== timeText) els.timer.textContent = timeText;

    const distText = `${Math.floor(Math.min(p.dist, S.raceLength))} / ${S.raceLength} M`;
    if (els.distanceLabel.textContent !== distText) els.distanceLabel.textContent = distText;

    const rankText = S.mode === 'countdown' || S.raceTime < 0.7 ? 'POS —' : `POS ${liveRank()}/4`;
    if (els.rankLabel.textContent !== rankText) els.rankLabel.textContent = rankText;

    updateProgressUI();

    const stamina = clamp(p.stamina, 0, 100);
    els.staminaFill.style.width = `${stamina.toFixed(1)}%`;
    const staminaText = `${Math.round(stamina)}%`;
    if (els.staminaPct.textContent !== staminaText) els.staminaPct.textContent = staminaText;
    els.staminaWrap.classList.toggle('is-low', stamina < 25);
  }

  /* ---------------- Rendering: sky & village ---------------- */

  const CLOUDS = Array.from({ length: 7 }, (_, i) => ({
    x: hash(i * 2.31 + 0.7),
    y: hash(i * 5.73 + 1.1),
    s: 0.55 + hash(i * 9.13) * 0.85,
    sp: 0.35 + hash(i * 4.27) * 0.9,
  }));

  const SHIRTS = ['#df5a4b', '#e8a23b', '#3f74c9', '#3f9c61', '#8456c9', '#f0e2c5', '#d66f9b', '#2d9a8c'];
  const SKINS = ['#c6865a', '#e2a87a', '#a96b45', '#8d5a3b', '#f0bd91'];
  const HAIRS = ['#24212a', '#3a241d', '#191a21', '#5b3a26'];

  const crowdSprite = { canvas: null, count: 10, w: 30, h: 38, scale: 2 };

  function ensureCrowdSprites() {
    if (crowdSprite.canvas) return;
    const sheet = document.createElement('canvas');
    sheet.width = crowdSprite.count * crowdSprite.w * crowdSprite.scale;
    sheet.height = crowdSprite.h * crowdSprite.scale;
    const g = sheet.getContext('2d');
    g.scale(crowdSprite.scale, crowdSprite.scale);

    for (let i = 0; i < crowdSprite.count; i++) {
      const cx = i * crowdSprite.w + crowdSprite.w / 2;
      const base = 36;
      const shirt = SHIRTS[i % SHIRTS.length];
      const skin = SKINS[(i * 3 + 1) % SKINS.length];
      const hair = HAIRS[i % HAIRS.length];

      g.fillStyle = shirt;
      roundRect(g, cx - 4.3, base - 11, 8.6, 12, 2.5);
      g.fill();

      g.fillStyle = hair;
      g.beginPath();
      g.arc(cx, base - 14.6, 3.5, 0, TAU);
      g.fill();
      g.fillStyle = skin;
      g.beginPath();
      g.arc(cx, base - 14.2, 2.9, 0, TAU);
      g.fill();

      if (i % 3 === 0) {
        g.strokeStyle = skin;
        g.lineWidth = 1.6;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx + 3.4, base - 9);
        g.lineTo(cx + 6.2, base - 16);
        g.stroke();
      }

      if (i % 4 === 0) {
        g.strokeStyle = 'rgba(60,45,38,0.78)';
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(cx + 6, base - 12);
        g.lineTo(cx + 6, base - 27);
        g.stroke();
        g.fillStyle = '#e8402f';
        g.fillRect(cx + 6, base - 27, 7, 3.2);
        g.fillStyle = '#fff8e8';
        g.fillRect(cx + 6, base - 23.8, 7, 3.2);
      }
    }
    crowdSprite.canvas = sheet;
  }

  function render(now) {
    const t = now / 1000;
    ctx.save();
    ctx.fillStyle = L.skyGrad || '#ffbd76';
    ctx.fillRect(0, 0, L.w, L.h);

    drawSky(t);
    drawClouds(t);
    drawBirds(t);
    drawMountains(t);
    drawVillage(t);
    drawBunting(t);
    drawCrowd(t);
    drawTrack(t);
    drawGate(t, 'start');
    drawGate(t, 'finish');
    drawDust();
    drawRunners(t);
    ctx.restore();
  }

  function drawSky(t) {
    const w = L.w;
    const top = L.trackTop;

    const hg = ctx.createRadialGradient(w * 0.68, top * 0.92, 8, w * 0.68, top * 0.92, Math.max(w * 0.58, 260));
    hg.addColorStop(0, 'rgba(255,244,196,0.58)');
    hg.addColorStop(0.55, 'rgba(255,226,160,0.16)');
    hg.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, top + 30);

    const sx = w * 0.79;
    const sy = Math.max(34, top * 0.4);
    const sr = clamp(w * 0.055, 19, 40);
    const glow = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.4);
    glow.addColorStop(0, 'rgba(255,248,206,0.65)');
    glow.addColorStop(0.45, 'rgba(255,235,170,0.22)');
    glow.addColorStop(1, 'rgba(255,235,170,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, sr * 3.4, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(sx - sr * 0.24, sy - sr * 0.22, sr * 0.5, 0, TAU);
    ctx.fill();

    const haze = ctx.createLinearGradient(0, top - 70, 0, top + 8);
    haze.addColorStop(0, 'rgba(255,223,168,0)');
    haze.addColorStop(1, 'rgba(255,234,192,0.4)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, Math.max(0, top - 70), w, 78);
  }

  function drawCloud(x, y, s, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff7e2';
    ctx.beginPath();
    ctx.arc(x, y, 15 * s, 0, TAU);
    ctx.arc(x + 18 * s, y - 7 * s, 18 * s, 0, TAU);
    ctx.arc(x + 39 * s, y - 1 * s, 13 * s, 0, TAU);
    ctx.arc(x + 53 * s, y + 3 * s, 9 * s, 0, TAU);
    ctx.rect(x - 15 * s, y, 72 * s, 11 * s);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = '#ffd9a1';
    ctx.beginPath();
    ctx.ellipse(x + 20 * s, y + 10 * s, 30 * s, 3.2 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawClouds(t) {
    const span = L.w + 280;
    for (const c of CLOUDS) {
      let x = ((c.x * span - S.camera * L.pxPerM * 0.035 - t * 7 * c.sp) % span + span) % span - 140;
      const y = L.trackTop * (0.06 + c.y * 0.55) + 8;
      const s = c.s * clamp(L.w / 390, 0.72, 1.35);
      drawCloud(x, y, s, 0.62);
    }
  }

  function drawBirds(t) {
    if (L.trackTop < 110) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(78,63,61,0.4)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = ((i * 121 + t * 11) % (L.w + 90)) - 45;
      const y = 44 + i * 15 + Math.sin(t * 0.8 + i) * 3;
      const fl = Math.sin(t * 4 + i * 1.7) * 2.2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + fl);
      ctx.quadraticCurveTo(x - 2, y - 2, x, y);
      ctx.quadraticCurveTo(x + 2, y - 2, x + 6, y + fl);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRidge(base, amp, color, speed, phase) {
    const off = S.camera * L.pxPerM * speed;
    ctx.beginPath();
    ctx.moveTo(-24, base + 90);
    for (let x = -24; x <= L.w + 26; x += 12) {
      const wx = x + off;
      const y = base
        - amp * (0.42
          + 0.3 * Math.sin(wx * 0.0055 + phase)
          + 0.18 * Math.sin(wx * 0.013 + phase * 2.3)
          + 0.1 * Math.sin(wx * 0.031 + phase * 4.1));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(L.w + 24, base + 90);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawVolcano(x, baseY, size, color, t) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - size * 1.12, baseY);
    ctx.lineTo(x - size * 0.3, baseY - size * 0.86);
    ctx.quadraticCurveTo(x - size * 0.14, baseY - size * 0.94, x - size * 0.06, baseY - size * 0.9);
    ctx.lineTo(x + size * 0.06, baseY - size * 0.9);
    ctx.quadraticCurveTo(x + size * 0.14, baseY - size * 0.94, x + size * 0.3, baseY - size * 0.86);
    ctx.lineTo(x + size * 1.12, baseY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,245,224,0.22)';
    for (let i = 0; i < 3; i++) {
      const puff = (t * 4 + i * 9) % 26;
      ctx.beginPath();
      ctx.arc(x - 2 + Math.sin(t * 0.5 + i) * 5 + i * 2.5, baseY - size * 0.92 - puff, 5 + i * 2.4, 0, TAU);
      ctx.fill();
    }
  }

  function drawMountains(t) {
    const base = L.trackTop + 16;
    const span = L.w * 1.5 + 500;
    let vx = L.w * 0.68 - ((S.camera * L.pxPerM * 0.035) % span);
    if (vx < -220) vx += span;
    drawVolcano(vx, base, Math.min(120, L.w * 0.155), '#bd8d84', t);

    drawRidge(base + 2, Math.min(118, L.h * 0.14), '#d49a87', 0.045, 1.4);
    drawRidge(base + 8, Math.min(96, L.h * 0.115), '#9fab7f', 0.085, 3.1);
    drawRidge(base + 15, Math.min(58, L.h * 0.075), '#658b68', 0.15, 5.2);
  }

  function drawPalm(x, baseY, s, seed) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(s, s);
    const h = 36 + seed * 14;
    ctx.strokeStyle = '#65503e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(4, -h * 0.55, -2 + seed * 6, -h);
    ctx.stroke();

    const topX = -2 + seed * 6;
    const topY = -h;
    ctx.strokeStyle = '#36704e';
    ctx.lineWidth = 2.6;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.56;
      const ex = topX + Math.cos(a) * (13 + seed * 4);
      const ey = topY + Math.sin(a) * (8 + seed * 3) + 4;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * 8, topY + Math.sin(a) * 5 - 4, ex, ey);
      ctx.stroke();
    }
    ctx.fillStyle = '#6b4a2f';
    ctx.beginPath();
    ctx.arc(topX - 2, topY + 2, 2.4, 0, TAU);
    ctx.arc(topX + 2.5, topY + 3, 2.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawHouse(x, baseY, s, seed) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(s, s);
    const w = 26 + seed * 13;
    const h = 13 + seed * 8;
    ctx.fillStyle = '#d9a57e';
    ctx.fillRect(-w / 2, -h, w, h + 2);
    ctx.fillStyle = '#8c5343';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 4, -h);
    ctx.lineTo(0, -h - 10 - seed * 5);
    ctx.lineTo(w / 2 + 4, -h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6d4034';
    ctx.fillRect(-w * 0.16, -h * 0.62, w * 0.24, h * 0.62 + 2);
    ctx.fillStyle = '#ffe6a8';
    ctx.fillRect(w * 0.13, -h * 0.82, 4.5, 4.5);
    ctx.strokeStyle = '#47352e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.26, -h - 6);
    ctx.lineTo(w * 0.26, -h - 17);
    ctx.stroke();
    ctx.fillStyle = '#e8402f';
    ctx.fillRect(w * 0.26, -h - 17, 7, 4);
    ctx.fillStyle = '#fff5dd';
    ctx.fillRect(w * 0.26, -h - 13, 7, 3);
    ctx.restore();
  }

  function drawTent(x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(s, s);
    ctx.fillStyle = '#f3e3c2';
    ctx.beginPath();
    ctx.moveTo(-19, 0);
    ctx.lineTo(-15, -19);
    ctx.lineTo(15, -19);
    ctx.lineTo(19, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d95543';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-15 + i * 8, -19);
      ctx.lineTo(-12 + i * 8, -19);
      ctx.lineTo(-10.5 + i * 8, 0);
      ctx.lineTo(-13.5 + i * 8, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#6b5140';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-16, -19);
    ctx.lineTo(-16, 1);
    ctx.moveTo(16, -19);
    ctx.lineTo(16, 1);
    ctx.stroke();
    ctx.restore();
  }

  function drawVillage(t) {
    const spacing = 7;
    const cam = S.camera * 0.36;
    const visible = L.w / L.pxPerM;
    const start = Math.floor(cam / spacing) - 2;
    const end = Math.ceil((cam + visible) / spacing) + 2;
    const scale = clamp(L.laneH / 95, 0.52, 1.06);
    for (let m = start; m <= end; m++) {
      const x = (m - cam) * L.pxPerM;
      if (x < -80 || x > L.w + 80) continue;
      const pick = hash(m * 7.17 + 2.1);
      const s = (0.72 + hash(m * 4.3) * 0.52) * scale;
      const baseY = L.trackTop + 3;
      if (pick < 0.34) drawPalm(x, baseY, s, hash(m * 2.7));
      else if (pick < 0.7) drawHouse(x, baseY, s, hash(m * 3.9));
      else drawTent(x, baseY, s);
    }
  }

  function drawBunting(t) {
    if (L.trackTop < 88) return;
    const par = S.camera * L.pxPerM * 0.55;
    const rows = [
      { y: L.trackTop - 50, phase: 0.7, colors: ['#e8402f', '#fff5dd', '#ffd23f'] },
      { y: L.trackTop - 40, phase: 2.3, colors: ['#fff5dd', '#2f9e5b', '#e8402f'] },
    ];
    for (const row of rows) {
      ctx.strokeStyle = 'rgba(55,44,40,0.52)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -12; x <= L.w + 12; x += 8) {
        const y = row.y + Math.sin((x + par) * 0.013 + row.phase) * 2.2;
        if (x === -12) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      for (let x = -18; x <= L.w + 18; x += 19) {
        const y = row.y + Math.sin((x + par) * 0.013 + row.phase) * 2.2;
        const i = Math.round((x + par) / 19);
        ctx.fillStyle = row.colors[((i % row.colors.length) + row.colors.length) % row.colors.length];
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 7, y);
        ctx.lineTo(x + 0.5, y + 12);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawCrowd(t) {
    ensureCrowdSprites();
    const spacing = 12.5;
    const cam = S.camera * L.pxPerM * 0.72;
    const baseScale = clamp(L.laneH / 100, 0.8, 1.12);
    for (let row = 0; row < 2; row++) {
      const base = L.trackTop - (row === 0 ? 14 : 2);
      const start = Math.floor(cam / spacing) - 1;
      const count = Math.ceil(L.w / spacing) + 3;
      const sc = (row === 0 ? 0.82 : 1) * baseScale;
      for (let i = 0; i < count; i++) {
        const idx = start + i;
        const x = idx * spacing - cam + (row === 0 ? 6 : 0);
        if (x < -16 || x > L.w + 16) continue;
        const variant = Math.floor(hash(idx * 1.37 + row * 17.3) * crowdSprite.count);
        const sheet = crowdSprite.canvas;
        const sway = Math.sin(t * 2.1 + idx * 0.7 + row) * 0.7;
        const dw = crowdSprite.w * sc;
        const dh = crowdSprite.h * sc;
        ctx.drawImage(
          sheet,
          variant * crowdSprite.w * crowdSprite.scale, 0,
          crowdSprite.w * crowdSprite.scale, crowdSprite.h * crowdSprite.scale,
          x - dw / 2,
          base - 36 * sc + sway,
          dw, dh
        );
      }
    }
  }

  /* ---------------- Rendering: track, gate, runners ---------------- */

  function worldX(meters) {
    return (meters - S.camera) * L.pxPerM;
  }

  function laneBase(lane) {
    return L.trackTop + L.laneH * (lane + 0.87);
  }

  function drawCheckered(worldM, top, bottom, widthPx, cell) {
    const x = worldX(worldM) - widthPx / 2;
    if (x > L.w + 8 || x + widthPx < -8) return;
    const cols = Math.max(2, Math.round(widthPx / cell));
    const cw = widthPx / cols;
    const rows = Math.ceil((bottom - top) / cell);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, top, widthPx, bottom - top);
    ctx.clip();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = (row + col) % 2 === 0 ? '#fff6e0' : '#262832';
        ctx.fillRect(x + col * cw, top + row * cell, cw + 0.6, cell + 0.6);
      }
    }
    ctx.restore();
  }

  function drawTrack(t) {
    const top = L.trackTop;
    const bottom = L.trackBottom;
    const laneH = L.laneH;
    const w = L.w;

    ctx.fillStyle = '#3c704f';
    ctx.fillRect(0, top - 7, w, 8);

    ctx.fillStyle = L.trackGrad;
    ctx.fillRect(0, top, w, bottom - top);

    const playerY = top + 2 * laneH;
    ctx.fillStyle = 'rgba(255,232,150,0.085)';
    ctx.fillRect(0, playerY, w, laneH);
    ctx.strokeStyle = 'rgba(255,242,190,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, playerY + 2, w - 12, laneH - 4);

    for (let i = 1; i < 4; i++) {
      const y = top + i * laneH;
      ctx.strokeStyle = 'rgba(62,24,18,0.16)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y + 1.5);
      ctx.lineTo(w, y + 1.5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,205,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,225,170,0.2)';
    ctx.fillRect(0, top, w, 3);
    ctx.fillStyle = 'rgba(80,30,24,0.22)';
    ctx.fillRect(0, bottom - 3, w, 3);
    ctx.strokeStyle = 'rgba(255,243,214,0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, top + 1.5);
    ctx.lineTo(w, top + 1.5);
    ctx.moveTo(0, bottom - 1.5);
    ctx.lineTo(w, bottom - 1.5);
    ctx.stroke();

    const mStart = Math.floor((S.camera - 1) * 2) / 2;
    const visible = w / L.pxPerM;
    for (let m = mStart; m < S.camera + visible + 1; m += 1.1) {
      const h1 = hash(m * 13.37 + 3.3);
      if (h1 < 0.55) continue;
      const x = worldX(m);
      const lane = Math.floor(hash(m * 7.77) * 4);
      const y = top + lane * laneH + laneH * (0.18 + hash(m * 5.13) * 0.64);
      ctx.fillStyle = h1 > 0.78 ? 'rgba(255,240,210,0.09)' : 'rgba(70,32,25,0.1)';
      ctx.fillRect(x, y, 1.2 + h1 * 2.2, 1.2);
    }

    for (let m = 10; m < S.raceLength; m += 10) {
      const x = worldX(m);
      if (x < -12 || x > w + 12) continue;
      ctx.fillStyle = 'rgba(255,243,214,0.28)';
      ctx.fillRect(x, top + 3, 1.5, 6);
      ctx.fillRect(x, bottom - 9, 1.5, 6);
      if (m % 20 === 0) {
        ctx.fillStyle = 'rgba(255,244,218,0.56)';
        ctx.font = '900 8px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${m}M`, x + 3, top + 8);
      }
    }

    drawCheckered(0, top, bottom, 13, 6.5);
    drawCheckered(S.raceLength, top, bottom, 16, 6.5);

    ctx.fillStyle = '#2f6649';
    ctx.fillRect(0, bottom + 3, w, 6);
  }

  function drawGate(t, type) {
    const isFinish = type === 'finish';
    const x = worldX(isFinish ? S.raceLength : 0);
    if (x < -110 || x > L.w + 110) return;
    const top = L.trackTop;
    const label = isFinish ? 'FINISH' : 'START';
    const sw = isFinish ? 70 : 54;
    const sh = isFinish ? 20 : 16;
    const sy = Math.max(7, top - (isFinish ? 66 : 58));

    ctx.strokeStyle = '#34313d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, sy + sh);
    ctx.lineTo(x, top + 1);
    ctx.stroke();

    ctx.fillStyle = isFinish ? '#fff5dd' : '#f8e6b8';
    roundRect(ctx, x - sw / 2, sy, sw, sh, 4);
    ctx.fill();
    ctx.strokeStyle = '#262832';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = isFinish ? '#bd2a24' : '#2f6e58';
    ctx.font = `900 ${isFinish ? 10 : 8}px "Arial Black", "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, sy + sh / 2 + 0.5);

    if (isFinish) {
      const flagW = 7;
      for (let i = 0; i < 2; i++) {
        const fx = x - sw / 2 + 3 + i * (sw - 6 - flagW);
        ctx.fillStyle = i === 0 ? '#e8402f' : '#189b86';
        ctx.beginPath();
        ctx.moveTo(fx, sy - 6);
        ctx.lineTo(fx + flagW, sy - 6);
        ctx.lineTo(fx, sy + 3);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.strokeStyle = '#262832';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 9, top - 2);
    ctx.lineTo(x + 9, top - 2);
    ctx.stroke();
  }

  function drawDust() {
    for (const d of S.dust) {
      const a = clamp(d.life / d.max, 0, 1);
      const x = worldX(d.dist) + d.ox;
      const y = laneBase(d.lane) + d.oy;
      if (x < -20 || x > L.w + 20) continue;
      ctx.fillStyle = `rgba(255,231,188,${(a * 0.34).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, d.size * (1.5 - a * 0.4), 0, TAU);
      ctx.fill();
    }
  }

  function drawRunners(t) {
    for (const r of S.runners) drawRunner(r, t);
  }

  function drawRunner(r, t) {
    let x = worldX(r.dist);
    if (x < -90 || x > L.w + 90) return;

    const baseY = laneBase(r.lane);
    const bodyH = clamp(L.laneH * 0.84, 27, 92);
    const u = bodyH / 46;
    const speed = clamp(r.v / 10, 0, 1);
    const celebrating = r.isPlayer && r.finished;
    const finishedAI = !r.isPlayer && r.finished;
    const bob = (celebrating ? Math.abs(Math.sin(t * 5.5)) * 2.8 : Math.abs(Math.sin(r.phase)) * 1.25) * (0.25 + speed * 0.75);
    let jx = 0;
    let jy = 0;
    if (r.isPlayer && S.shake > 0) {
      jx = (Math.random() - 0.5) * S.shake * 6;
      jy = (Math.random() - 0.5) * S.shake * 4;
    }
    x += jx;

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#2b1a18';
    ctx.beginPath();
    ctx.ellipse(x + u * 2, baseY + 2 + jy, u * 13.5, u * 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (r.isPlayer) {
      ctx.fillStyle = 'rgba(255,216,104,0.15)';
      ctx.beginPath();
      ctx.ellipse(x, baseY + 1, u * 17, u * 5, 0, 0, TAU);
      ctx.fill();
    }

    if (r.v > 8 && !r.finished) {
      ctx.strokeStyle = `rgba(255,247,220,${(0.16 + speed * 0.18).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, u * 1.3);
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ly = baseY - bodyH * (0.36 + i * 0.14);
        const lx = x - u * (20 + i * 4);
        ctx.beginPath();
        ctx.moveTo(lx - u * (8 + i * 3), ly);
        ctx.lineTo(lx, ly);
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(x, baseY - bob * u + jy);
    ctx.scale(u, u);

    const lean = clamp(r.v * 0.016, 0, 0.17) - (celebrating ? 0.06 : 0);
    ctx.rotate(lean);

    const hipX = -0.8;
    const hipY = -21.5;
    const shoulderX = 0.4;
    const shoulderY = -32.8;

    const swing = celebrating ? Math.sin(t * 5.2) * 0.16 : (finishedAI ? Math.sin(r.phase) * 0.28 : Math.sin(r.phase));
    const backLeg = -swing;
    const frontLeg = swing;

    function limb(points, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
    }

    function drawLeg(sv, back) {
      const a1 = sv * 0.72;
      const kneeX = hipX + Math.sin(a1) * 10;
      const kneeY = hipY + Math.cos(a1) * 10;
      const a2 = a1 - 0.38 - Math.max(0, sv) * 0.9;
      const ankleX = kneeX + Math.sin(a2) * 10;
      const ankleY = kneeY + Math.cos(a2) * 10;

      limb([[hipX, hipY], [kneeX, kneeY]], back ? shade(r.shorts, -26) : r.shorts, 6.6);
      limb([[kneeX, kneeY], [ankleX, ankleY]], back ? shade(r.skin, -22) : r.skin, 4.1);

      ctx.save();
      ctx.translate(ankleX + 1.4, ankleY + 0.7);
      ctx.rotate(a2 * 0.3);
      ctx.fillStyle = back ? shade(r.shoes, -28) : r.shoes;
      ctx.beginPath();
      ctx.ellipse(1.4, 0.3, 4.4, 2.25, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(34,36,45,0.58)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-2.6, 1.9);
      ctx.lineTo(4.8, 1.9);
      ctx.stroke();
      ctx.restore();
    }

    function drawArm(sv, back) {
      let a1;
      let a2;
      if (celebrating) {
        a1 = (back ? -2.9 : -2.2) + Math.sin(t * 6 + (back ? 1 : 0)) * 0.1;
        a2 = a1 + 0.5;
      } else {
        a1 = (back ? -0.25 : -0.05) + sv * 0.8;
        a2 = a1 + 1.06 + Math.max(0, sv) * 0.3;
      }
      const ex = shoulderX + Math.sin(a1) * 7.2;
      const ey = shoulderY + Math.cos(a1) * 7.2;
      const hx = ex + Math.sin(a2) * 7.2;
      const hy = ey + Math.cos(a2) * 7.2;

      limb([[shoulderX, shoulderY], [shoulderX + Math.sin(a1) * 2.8, shoulderY + Math.cos(a1) * 2.8]], back ? shade(r.shirt, -30) : r.shirt, 4.7);
      limb([[ex, ey], [hx, hy]], back ? shade(r.skin, -24) : r.skin, 3.2);
      ctx.fillStyle = back ? shade(r.skin, -24) : r.skin;
      ctx.beginPath();
      ctx.arc(hx, hy, 1.55, 0, TAU);
      ctx.fill();
    }

    drawLeg(backLeg, true);
    drawArm(-backLeg * 0.92, true);

    ctx.fillStyle = r.shirt;
    ctx.beginPath();
    ctx.moveTo(-5.4, -33.1);
    ctx.quadraticCurveTo(0.2, -35.4, 5.3, -33);
    ctx.quadraticCurveTo(6.8, -28, 4.2, -21.5);
    ctx.lineTo(-4.6, -21.5);
    ctx.quadraticCurveTo(-6.8, -28, -5.4, -33.1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,248,232,0.7)';
    ctx.beginPath();
    ctx.moveTo(3.5, -32.8);
    ctx.quadraticCurveTo(5.8, -27.8, 3.7, -21.8);
    ctx.lineTo(2, -21.8);
    ctx.quadraticCurveTo(4.1, -27.6, 2.2, -32.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = r.shorts;
    roundRect(ctx, -4.9, -23.1, 9.7, 4.2, 1.7);
    ctx.fill();

    ctx.save();
    ctx.translate(-0.7, -28.2);
    ctx.rotate(-0.035);
    ctx.fillStyle = '#fffdf4';
    roundRect(ctx, -2.9, -2.9, 5.8, 5.8, 0.9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,36,45,0.34)';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.fillStyle = '#22242d';
    ctx.font = '900 4px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.bib, 0, 0.25);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,248,232,0.82)';
    ctx.beginPath();
    ctx.moveTo(-2.3, -33.6);
    ctx.lineTo(2.7, -33.8);
    ctx.lineTo(0.5, -31.2);
    ctx.closePath();
    ctx.fill();

    drawLeg(frontLeg, false);
    drawArm(-frontLeg * 0.92, false);

    const headX = 2.5;
    const headY = -40;
    limb([[0.5, -33.8], [1.3, -36.7]], r.skin, 2.8);

    if (r.hairStyle === 'pony') {
      ctx.fillStyle = r.hair;
      ctx.beginPath();
      ctx.arc(headX - 5.8, headY + 0.6, 3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = r.hair;
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(headX - 5.8, headY + 1.4);
      ctx.quadraticCurveTo(headX - 9.5, headY + 4.5, headX - 9.3, headY + 10);
      ctx.stroke();
    }

    ctx.fillStyle = shade(r.skin, -12);
    ctx.beginPath();
    ctx.arc(headX - 4.4, headY + 0.8, 1.7, 0, TAU);
    ctx.fill();

    ctx.fillStyle = r.skin;
    ctx.beginPath();
    ctx.arc(headX, headY, 6.15, 0, TAU);
    ctx.fill();

    ctx.fillStyle = r.hair;
    if (r.hairStyle === 'cap') {
      ctx.fillStyle = r.cap;
      ctx.beginPath();
      ctx.arc(headX, headY - 0.9, 6.35, Math.PI, TAU);
      ctx.fill();
      ctx.fillRect(headX + 1, headY - 4.1, 7, 2.1);
      ctx.fillStyle = shade(r.cap, -32);
      ctx.fillRect(headX - 1, headY - 4.6, 2, 2);
    } else {
      ctx.beginPath();
      ctx.arc(headX, headY - 0.6, 6.3, Math.PI, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX - 5.1, headY + 1.4, 1.9, 0, TAU);
      ctx.fill();
    }

    if (r.hairStyle === 'band') {
      ctx.save();
      ctx.translate(headX, headY - 2.2);
      ctx.rotate(-0.07);
      ctx.fillStyle = '#fff8e8';
      ctx.fillRect(-6.1, -1.2, 12.2, 2.4);
      ctx.fillStyle = '#e8402f';
      ctx.fillRect(-6.1, 0, 12.2, 0.9);
      ctx.restore();
    }

    ctx.fillStyle = '#25232b';
    ctx.beginPath();
    ctx.arc(headX + 3.6, headY - 0.2, 0.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,36,45,0.7)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(headX + 2.3, headY - 2.4);
    ctx.lineTo(headX + 5.2, headY - 2.5);
    ctx.stroke();

    ctx.fillStyle = 'rgba(120,50,45,0.85)';
    ctx.beginPath();
    ctx.ellipse(headX + 4.1, headY + 2.9, 1.4, 1.05, -0.1, 0, TAU);
    ctx.fill();

    if (r.isPlayer && !r.finished) {
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath();
      ctx.ellipse(headX + 1.3, headY + 1.8, 1.3, 1, 0, 0, TAU);
      ctx.fill();
    }

    ctx.restore();

    if (r.isPlayer) {
      drawNameTag(x, baseY - bodyH - 10 + jy, t);
    }
  }

  function drawNameTag(x, y, t) {
    const label = 'KAMU';
    ctx.save();
    ctx.font = '900 9px "Trebuchet MS", sans-serif';
    const tw = ctx.measureText(label).width;
    const bw = tw + 13;
    const bh = 14;
    const by = y - bh - 4 + Math.sin(t * 2.4) * 1.1;

    ctx.strokeStyle = '#22242d';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffd23f';
    roundRect(ctx, x - bw / 2, by, bw, bh, 4);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 3.6, by + bh - 1);
    ctx.lineTo(x + 3.6, by + bh - 1);
    ctx.lineTo(x, by + bh + 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#22242d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, by + bh / 2 + 0.7);
    ctx.restore();
  }

  /* ---------------- Input & loop ---------------- */

  function pressPad(pad) {
    pad.classList.add('pressed');
    clearTimeout(pad._pressTimer);
    pad._pressTimer = setTimeout(() => pad.classList.remove('pressed'), 130);
  }

  function bindEvents() {
    padEls.forEach((pad) => {
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Sound.init();
        if (pad.setPointerCapture) {
          try { pad.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
        }
        pressPad(pad);
        stride(pad.dataset.foot, 'touch');
      });
      pad.addEventListener('pointerup', () => pad.classList.remove('pressed'));
      pad.addEventListener('pointercancel', () => pad.classList.remove('pressed'));
      pad.addEventListener('lostpointercapture', () => pad.classList.remove('pressed'));
      pad.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    els.startBtn.addEventListener('click', () => startGuarded());
    els.againBtn.addEventListener('click', () => startGuarded());
    els.menuBtn.addEventListener('click', () => showMenu());
    els.pauseBtn.addEventListener('click', () => togglePause(true));
    els.resumeBtn.addEventListener('click', () => resumeRace());
    els.restartBtn.addEventListener('click', () => restartRace());
    els.quitBtn.addEventListener('click', () => quitToMenu());

    els.howBtn.addEventListener('click', () => openHow());
    els.closeHowBtn.addEventListener('click', () => closeHow());
    els.howPlayBtn.addEventListener('click', () => { closeHow(); startGuarded(); });
    els.howModal.querySelector('[data-close-modal]').addEventListener('click', () => closeHow());

    els.soundBtn.addEventListener('click', () => {
      S.sound = !S.sound;
      Sound.init();
      Sound.setMuted(!S.sound);
      if (S.sound) Sound.beep(false);
      updateSoundUI();
      saveStore();
    });

    els.distanceGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-distance]');
      if (!btn) return;
      S.distance = Number(btn.dataset.distance);
      syncMenuUI();
      computeLayout();
      saveStore();
      Sound.init();
      Sound.tone(520, 0.05, 'triangle', 0.05);
    });

    els.difficultyGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-difficulty]');
      if (!btn) return;
      S.difficulty = btn.dataset.difficulty;
      syncMenuUI();
      saveStore();
      Sound.init();
      Sound.tone(620, 0.05, 'triangle', 0.05);
    });

    els.controlGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-control]');
      if (!btn) return;
      chooseControl(btn.dataset.control);
    });

    els.tiltGauge.addEventListener('click', () => calibrateTilt());

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;
      const typable = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

      if (code === 'Escape') {
        if (els.howModal.classList.contains('is-open')) { closeHow(); return; }
        if (S.mode === 'racing') { togglePause(true); return; }
        if (S.mode === 'paused') { resumeRace(); return; }
      }

      if (typable) return;

      if (S.mode === 'menu') {
        if ((code === 'Enter' || code === 'Space') && !els.howModal.classList.contains('is-open')) {
          e.preventDefault();
          startGuarded();
        }
        return;
      }

      if (S.mode === 'result') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          startGuarded();
        }
        return;
      }

      if (S.mode === 'paused') {
        if (code === 'Enter' || code === 'Space' || code === 'KeyP') {
          e.preventDefault();
          resumeRace();
        }
        return;
      }

      if (S.mode === 'countdown') {
        if (code === 'Space' || code === 'ArrowLeft' || code === 'ArrowRight') e.preventDefault();
        return;
      }

      if (S.mode === 'racing') {
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyZ' || code === 'KeyF') {
          e.preventDefault();
          stride('left', 'key');
        } else if (code === 'ArrowRight' || code === 'KeyD' || code === 'KeyX' || code === 'KeyJ') {
          e.preventDefault();
          stride('right', 'key');
        } else if (code === 'Space') {
          e.preventDefault();
          const next = S.player && S.player.lastFoot === 'left' ? 'right' : 'left';
          stride(next, 'key');
        } else if (code === 'KeyP') {
          togglePause(true);
        }
      }
    });

    let resizeTimer = 0;
    const scheduleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
        motion.neutral = null;
        motion.samples = [];
        updateTiltGauge();
      }, 80);
    };
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', () => setTimeout(scheduleResize, 220));
    if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
      window.screen.orientation.addEventListener('change', scheduleResize);
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', scheduleResize);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && S.mode === 'racing') togglePause(true);
      S.lastFrame = performance.now();
    });

    document.addEventListener('contextmenu', (e) => {
      if (e.target && e.target.closest && e.target.closest('.pad')) e.preventDefault();
    });
  }

  let animTime = 0;

  function frame(now) {
    const dt = clamp((now - S.lastFrame) / 1000, 0, 0.1);
    S.lastFrame = now;

    if (S.mode === 'menu') {
      animTime += dt;
      updateMenu(dt);
    } else if (S.mode === 'countdown') {
      animTime += dt;
      updateCountdown(dt);
    } else if (S.mode === 'racing') {
      animTime += dt;
      updateRace(dt);
    }

    render(animTime);
    requestAnimationFrame(frame);
  }

  /* ---------------- Init ---------------- */

  resizeCanvas();
  Sound.setMuted(!S.sound);
  syncMenuUI();
  resetPreview();
  bindEvents();
  updateTiltGauge();
  computeLayout();
  S.lastFrame = performance.now();
  requestAnimationFrame(frame);
})();
