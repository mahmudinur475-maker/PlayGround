import { Game } from './game.js';
import { Renderer } from './renderer.js';
import { GameAudio } from './audio.js';
import { formatTime } from './util.js';
import { RACE_LENGTH } from './course.js';

const $ = (selector) => document.querySelector(selector);

const STORAGE = {
  best: 'lomba.best',
  wins: 'lomba.wins',
  races: 'lomba.races',
  muted: 'lomba.muted',
  tilt: 'lomba.tilt',
};

const readNumber = (key) => {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : 0;
};

const writeNumber = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage can be unavailable in private mode */
  }
};

const readFlag = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeFlag = (key, value) => {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
};

class LombaLariApp {
  constructor() {
    this.canvas = $('#scene');
    this.renderer = new Renderer(this.canvas);
    this.audio = new GameAudio();
    this.game = new Game({
      renderer: this.renderer,
      audio: this.audio,
      callbacks: {
        onPhase: (phase) => this.handlePhase(phase),
        onCountdown: (value) => this.handleCountdown(value),
        onResults: (results) => this.showResults(results),
        onFinishCrossed: (results) => this.handleFinishCrossed(results),
        onPause: (paused) => this.handlePause(paused),
        onToast: (toast) => this.toast(toast),
        onFlash: () => this.flash(),
        onRaceStart: () => this.handleRaceStart(),
      },
    });

    this.dom = {
      menu: $('#menu'),
      hud: $('#hud'),
      results: $('#results'),
      pause: $('#pause'),
      how: $('#how'),
      countdown: $('#countdown'),
      countdownText: $('#countdownText'),
      toasts: $('#toasts'),
      posValue: $('#posValue'),
      distValue: $('#distValue'),
      timeValue: $('#timeValue'),
      energyFill: $('#energyFill'),
      energyTrack: $('.energy-track'),
      progressFill: $('#progressFill'),
      playerDot: $('#playerDot'),
      rivalDots: Array.from(document.querySelectorAll('.progress-dot.rival')),
      turboBtn: $('#turboBtn'),
      tiltToggle: $('#tiltToggle'),
      tiltNote: $('#tiltNote'),
      tiltIndicator: $('#tiltIndicator'),
      tiltBubble: document.querySelector('.tilt-bubble'),
      recordText: $('#recordText'),
      cardRecordText: $('#cardRecordText'),
      pauseBtn: $('#pauseBtn'),
      soundBtn: $('#soundBtn'),
      pauseSoundBtn: $('#pauseSoundBtn'),
      muteMenuBtn: $('#muteMenuBtn'),
      medal: $('#medal'),
      medalRank: $('#medalRank'),
      resultKicker: $('#resultKicker'),
      resultTitle: $('#resultTitle'),
      resultSub: $('#resultSub'),
      resultTime: $('#resultTime'),
      resultBest: $('#resultBest'),
      newRecord: $('#newRecord'),
      resultBoard: $('#resultBoard'),
      resultsCard: document.querySelector('.results-card'),
      countdownTimer: null,
      resultsTimer: null,
    };

    this.muted = readFlag(STORAGE.muted);
    this.tiltPreference = readFlag(STORAGE.tilt);
    this.motionHandler = null;
    this.tiltRequesting = false;
    this.lastHud = {};
    this.lastSprintClass = false;

    this.applyMute(this.muted, false);
    this.bind();
    this.updateRecord();
    this.handlePhase('menu');
    this.setupTiltPreference();

    this.lastTime = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => this.renderer.buildBackdrop()).catch(() => {});
    }

    window.__LOMBA_READY__ = true;
    window.__lomba = {
      game: this.game,
      renderer: this.renderer,
      app: this,
      start: () => this.startRace(),
      skipCountdown: () => {
        this.game.countdown = 0.001;
      },
      state: () => this.game.getSnapshot(),
      finish: () => this.game.debugFinish(),
      showResults: () => this.game.showResultsNow(),
      setEnergy: (value) => {
        this.game.player.energy = Math.max(0, Math.min(100, value));
      },
      clearObstacles: () => {
        this.game.course.obstacles.length = 0;
      },
      setTime: (value) => {
        this.game.raceTime = value;
      },
      version: 1,
    };
  }

  bind() {
    $('#startBtn').addEventListener('click', () => this.startRace());
    $('#againBtn').addEventListener('click', () => this.restartRace());
    $('#menuBtn').addEventListener('click', () => this.game.quitToMenu());
    $('#pauseBtn').addEventListener('click', () => {
      this.audio.unlock();
      this.game.setPaused(true);
    });
    $('#resumeBtn').addEventListener('click', () => this.game.setPaused(false));
    $('#restartPauseBtn').addEventListener('click', () => this.restartRace());
    $('#quitBtn').addEventListener('click', () => this.game.quitToMenu());
    $('#howBtn').addEventListener('click', () => this.openHow());
    $('#howClose').addEventListener('click', () => this.closeHow());
    $('#howOk').addEventListener('click', () => this.closeHow());
    this.dom.how.addEventListener('pointerdown', (event) => {
      if (event.target === this.dom.how) this.closeHow();
    });

    this.bindSoundButtons();
    this.bindTilt();

    this.bindHoldButton($('#laneLeft'), () => this.game.moveLane(-1), 'tap');
    this.bindHoldButton($('#laneRight'), () => this.game.moveLane(1), 'tap');
    this.bindHoldButton($('#jumpBtn'), () => this.game.jump(), 'tap');
    this.bindHoldButton($('#slideBtn'), () => this.game.slide(), 'tap');

    const turbo = this.dom.turboBtn;
    const startTurbo = (event) => {
      event.preventDefault();
      this.audio.unlock();
      this.game.setSprint(true);
      turbo.classList.add('is-down');
      try {
        turbo.setPointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
    };
    const stopTurbo = () => {
      this.game.setSprint(false);
      turbo.classList.remove('is-down');
    };
    turbo.addEventListener('pointerdown', startTurbo);
    turbo.addEventListener('pointerup', stopTurbo);
    turbo.addEventListener('pointercancel', stopTurbo);
    turbo.addEventListener('lostpointercapture', stopTurbo);
    window.addEventListener('pointerup', stopTurbo);
    window.addEventListener('blur', stopTurbo);

    this.bindKeyboard();
    this.bindSwipe();

    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.handleResize(), 120));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.handleResize());
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.game.phase === 'race') this.game.setPaused(true);
    });
    document.addEventListener('gesturestart', (event) => event.preventDefault());
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    // A single unlock gesture makes iOS audio reliable.
    const unlock = () => {
      this.audio.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
  }

  bindSoundButtons() {
    const buttons = [$('#soundBtn'), this.dom.pauseSoundBtn, this.dom.muteMenuBtn];
    for (const button of buttons) {
      if (!button) continue;
      button.addEventListener('click', () => {
        this.audio.unlock();
        this.applyMute(!this.muted, true);
      });
    }
  }

  bindTilt() {
    this.dom.tiltToggle.addEventListener('click', () => {
      this.audio.unlock();
      if (this.game.tilt.enabled) {
        this.disableTilt();
      } else {
        this.enableTilt();
      }
    });
  }

  setupTiltPreference() {
    if (!this.tiltPreference) return;
    if (typeof window.DeviceOrientationEvent === 'undefined') return;
    // iOS needs a fresh user gesture, so only restore automatically where allowed.
    if (typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
      this.enableTilt({ silent: true });
    } else {
      this.dom.tiltNote.textContent = 'Ketuk untuk mengaktifkan gerak (izin iOS diminta saat diketuk).';
    }
  }

  async enableTilt({ silent = false } = {}) {
    if (this.tiltRequesting) return;
    const OrientationEvent = window.DeviceOrientationEvent;
    if (typeof OrientationEvent === 'undefined') {
      this.setTiltState(false);
      this.dom.tiltNote.textContent = 'Perangkat ini tidak mendukung sensor gerak.';
      this.dom.tiltNote.classList.add('is-warn');
      return;
    }
    this.tiltRequesting = true;
    if (!silent) {
      this.dom.tiltNote.classList.remove('is-warn');
      this.dom.tiltNote.textContent = 'Meminta izin gerak…';
    }
    try {
      if (typeof OrientationEvent.requestPermission === 'function') {
        const result = await OrientationEvent.requestPermission();
        if (result !== 'granted') {
          this.setTiltState(false);
          this.dom.tiltNote.textContent = 'Izin gerak ditolak. Kontrol sentuh tetap bisa dipakai.';
          this.dom.tiltNote.classList.add('is-warn');
          return;
        }
      }
      this.motionHandler = (event) => {
        const angle = screen.orientation?.angle ?? window.orientation ?? 0;
        this.game.handleOrientation({
          gamma: event.gamma,
          beta: event.beta,
          angle,
        });
      };
      window.addEventListener('deviceorientation', this.motionHandler, true);
      this.game.setTiltEnabled(true);
      this.setTiltState(true);
      this.dom.tiltNote.classList.remove('is-warn');
      this.dom.tiltNote.textContent = 'Gerak aktif. Miringkan HP untuk pindah lajur.';
      writeFlag(STORAGE.tilt, true);
      if (!silent) this.audio.ui();
    } catch {
      this.setTiltState(false);
      this.dom.tiltNote.textContent = 'Izin gerak tidak tersedia. Gunakan geser atau tombol.';
      this.dom.tiltNote.classList.add('is-warn');
    } finally {
      this.tiltRequesting = false;
    }
  }

  disableTilt() {
    if (this.motionHandler) {
      window.removeEventListener('deviceorientation', this.motionHandler, true);
      this.motionHandler = null;
    }
    this.game.setTiltEnabled(false);
    this.setTiltState(false);
    this.dom.tiltNote.classList.remove('is-warn');
    this.dom.tiltNote.textContent = 'Opsional. Di iPhone, izin gerak diminta saat diaktifkan.';
    writeFlag(STORAGE.tilt, false);
    this.audio.ui();
  }

  setTiltState(enabled) {
    this.tiltPreference = enabled;
    this.dom.tiltToggle.setAttribute('aria-checked', String(enabled));
    this.dom.tiltIndicator.classList.toggle('is-active', enabled);
  }

  applyMute(muted, persist = true) {
    this.muted = Boolean(muted);
    this.audio.setMuted(this.muted);
    document.body.classList.toggle('is-muted', this.muted);
    const label = `Suara: ${this.muted ? 'OFF' : 'ON'}`;
    for (const button of [this.dom.soundBtn, this.dom.pauseSoundBtn]) {
      if (!button) continue;
      button.textContent = label;
      button.setAttribute('aria-pressed', String(!this.muted));
    }
    this.dom.muteMenuBtn?.setAttribute('aria-label', this.muted ? 'Nyalakan suara' : 'Matikan suara');
    if (persist) writeFlag(STORAGE.muted, this.muted);
  }

  bindHoldButton(button, action, mode) {
    if (!button) return;
    const trigger = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.audio.unlock();
      action();
      button.classList.add('is-down');
      if (mode === 'tap') {
        clearTimeout(button.__releaseTimer);
        button.__releaseTimer = setTimeout(() => button.classList.remove('is-down'), 120);
      }
    };
    button.addEventListener('pointerdown', trigger);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  bindKeyboard() {
    const jumpKeys = new Set(['ArrowUp', 'KeyW', 'Space']);
    const slideKeys = new Set(['ArrowDown', 'KeyS']);
    const leftKeys = new Set(['ArrowLeft', 'KeyA']);
    const rightKeys = new Set(['ArrowRight', 'KeyD']);

    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        event.preventDefault();
        this.game.setSprint(true);
        this.dom.turboBtn.classList.add('is-down');
        return;
      }
      if (jumpKeys.has(event.code)) {
        event.preventDefault();
        if (this.game.phase === 'menu') this.startRace();
        else this.game.jump();
        return;
      }
      if (slideKeys.has(event.code)) {
        event.preventDefault();
        this.game.slide();
        return;
      }
      if (leftKeys.has(event.code)) {
        event.preventDefault();
        this.game.moveLane(-1);
        return;
      }
      if (rightKeys.has(event.code)) {
        event.preventDefault();
        this.game.moveLane(1);
        return;
      }
      if (event.code === 'KeyP' || event.code === 'Escape') {
        event.preventDefault();
        if (this.game.phase === 'race' || this.game.phase === 'paused') this.game.togglePause();
        return;
      }
      if (event.code === 'Enter') {
        if (this.game.phase === 'menu' && !this.dom.how.classList.contains('is-hidden')) return;
        if (this.game.phase === 'menu') this.startRace();
        else if (this.game.phase === 'results') this.restartRace();
        return;
      }
      if (event.code === 'KeyR' && this.game.phase === 'results') {
        this.restartRace();
      }
      if (event.code === 'KeyM') {
        this.applyMute(!this.muted, true);
      }
    });

    window.addEventListener('keyup', (event) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        this.game.setSprint(false);
        this.dom.turboBtn.classList.remove('is-down');
      }
    });
  }

  bindSwipe() {
    let start = null;
    let startTime = 0;
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY };
      startTime = performance.now();
    });
    this.canvas.addEventListener('pointerup', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      const elapsed = performance.now() - startTime;
      start = null;
      if (this.game.phase !== 'race') return;
      const threshold = 26;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        if (Math.abs(dx) > Math.abs(dy) * 1.15) {
          this.game.moveLane(dx > 0 ? 1 : -1);
        } else if (dy < 0) {
          this.game.jump();
        } else {
          this.game.slide();
        }
      } else if (elapsed < 320) {
        this.game.jump();
      }
    });
    this.canvas.addEventListener('pointercancel', () => {
      start = null;
    });
  }

  startRace() {
    if (!this.dom.how.classList.contains('is-hidden')) this.closeHow();
    if (!this.dom.results.classList.contains('is-hidden')) this.hideResults();
    this.audio.unlock();
    this.audio.ui();
    this.game.startRace();
  }

  restartRace() {
    this.hideResults();
    this.handlePhase('countdown');
    this.game.restart();
  }

  handlePhase(phase) {
    if (phase === 'menu') {
      this.dom.menu.classList.remove('is-hidden');
      this.dom.menu.setAttribute('aria-hidden', 'false');
      this.dom.hud.classList.remove('is-active');
      this.hideResults();
      this.handlePause(false);
      this.hideCountdown();
      this.dom.countdown.classList.remove('is-active');
      this.updateRecord();
      this.dom.pauseBtn.disabled = true;
      document.body.classList.remove('is-sprinting');
    } else if (phase === 'countdown' || phase === 'race') {
      this.dom.menu.classList.add('is-hidden');
      this.dom.menu.setAttribute('aria-hidden', 'true');
      this.dom.hud.classList.add('is-active');
      this.dom.results.classList.add('is-hidden');
      this.dom.results.setAttribute('aria-hidden', 'true');
      this.dom.pause.classList.add('is-hidden');
      this.dom.pause.setAttribute('aria-hidden', 'true');
      this.dom.pauseBtn.disabled = phase === 'countdown';
      this.dom.tiltIndicator.classList.toggle('is-active', this.game.tilt.enabled);
    } else if (phase === 'results') {
      this.dom.hud.classList.remove('is-active');
    }
  }

  handleCountdown(value) {
    if (!value) {
      this.hideCountdown();
      return;
    }
    const overlay = this.dom.countdown;
    const text = this.dom.countdownText;
    overlay.classList.add('is-active');
    text.textContent = value;
    text.classList.toggle('is-go', value === 'LARI!');
    text.classList.remove('is-pop');
    void text.offsetWidth;
    text.classList.add('is-pop');
    clearTimeout(this.dom.countdownTimer);
    if (value === 'LARI!') {
      this.dom.countdownTimer = setTimeout(() => this.hideCountdown(), 760);
    }
  }

  hideCountdown() {
    clearTimeout(this.dom.countdownTimer);
    this.dom.countdown.classList.remove('is-active');
  }

  handleRaceStart() {
    this.dom.pauseBtn.disabled = false;
    this.toast({ text: 'Geser untuk pindah lajur', icon: '↔', tone: '' });
    this.audio.cheer();
  }

  handlePause(paused) {
    if (paused) {
      this.dom.pause.classList.remove('is-hidden');
      this.dom.pause.setAttribute('aria-hidden', 'false');
      setTimeout(() => $('#resumeBtn')?.focus({ preventScroll: true }), 30);
      this.lastSprintClass = false;
      document.body.classList.remove('is-sprinting');
    } else {
      this.dom.pause.classList.add('is-hidden');
      this.dom.pause.setAttribute('aria-hidden', 'true');
    }
  }

  handleFinishCrossed() {
    this.dom.pauseBtn.disabled = true;
    this.toast({ text: 'Garis finish!', icon: '★', tone: 'good' });
  }

  updateRecord() {
    const best = readNumber(STORAGE.best);
    const wins = readNumber(STORAGE.wins);
    if (best > 0) {
      this.dom.recordText.innerHTML = `Rekor <b>${best.toFixed(2)}</b> dtk · ${wins} kemenangan`;
      if (this.dom.cardRecordText) {
        this.dom.cardRecordText.textContent = `Rekor ${best.toFixed(2)} dtk · ${wins} menang`;
      }
    } else {
      this.dom.recordText.textContent = 'Belum ada rekor · 0 kemenangan';
      if (this.dom.cardRecordText) this.dom.cardRecordText.textContent = 'Belum ada rekor';
    }
  }

  showResults(results) {
    const previousBest = readNumber(STORAGE.best);
    const previousWins = readNumber(STORAGE.wins);
    const races = readNumber(STORAGE.races) + 1;
    const best = previousBest > 0 ? Math.min(previousBest, results.time) : results.time;
    const wins = previousWins + (results.place === 1 ? 1 : 0);
    writeNumber(STORAGE.best, best);
    writeNumber(STORAGE.wins, wins);
    writeNumber(STORAGE.races, races);
    this.updateRecord();

    const isNewRecord = previousBest <= 0 || results.time < previousBest - 0.005;
    const place = results.place;
    const copy = {
      1: 'Kamu memimpin dari awal sampai akhir. Lari yang bersih!',
      2: 'Selisih tipis! Satu turbo tepat waktu bisa membalikkan hasil.',
      3: 'Podium sudah dekat. Jaga ritme dan jangan menabrak gawang.',
      4: 'Bukan malammu. Ambil bola energi dan coba lagi.',
    };
    this.dom.resultTitle.textContent =
      place === 1 ? 'Juara 1!' : place === 2 ? 'Juara 2!' : place === 3 ? 'Juara 3!' : 'Hampir saja!';
    this.dom.resultTitle.classList.toggle('is-win', place === 1);
    this.dom.resultKicker.textContent = place === 1 ? 'GARIS FINISH · MENANG' : 'GARIS FINISH';
    this.dom.resultSub.textContent = copy[place] || copy[4];
    this.dom.resultTime.textContent = formatTime(results.time);
    this.dom.resultBest.textContent = formatTime(best);
    this.dom.newRecord.classList.toggle('is-hidden', !isNewRecord || place !== 1);
    this.dom.medal.className = `medal ${results.medal || ''}`.trim();
    this.dom.medalRank.textContent = String(place);
    this.dom.resultBoard.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (const entry of results.entries) {
      const row = document.createElement('div');
      row.className = `board-row${entry.isPlayer ? ' is-you' : ''}`;
      const rank = document.createElement('span');
      rank.className = 'board-rank';
      rank.textContent = String(entry.place);
      const dot = document.createElement('span');
      dot.className = 'board-dot';
      dot.style.background = entry.color;
      dot.style.color = entry.color;
      const name = document.createElement('span');
      name.className = 'board-name';
      name.textContent = entry.name;
      const time = document.createElement('span');
      time.className = 'board-time';
      time.textContent = `${formatTime(entry.time)} s`;
      row.append(rank, dot, name, time);
      fragment.append(row);
    }
    this.dom.resultBoard.append(fragment);

    this.dom.results.classList.remove('is-hidden');
    this.dom.results.setAttribute('aria-hidden', 'false');
    this.dom.hud.classList.remove('is-active');
    this.dom.pause.classList.add('is-hidden');
    this.dom.pause.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-sprinting');

    const card = this.dom.resultsCard;
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    setTimeout(() => $('#againBtn')?.focus({ preventScroll: true }), 400);
    this.audio.cheer();
  }

  hideResults() {
    this.dom.results.classList.add('is-hidden');
    this.dom.results.setAttribute('aria-hidden', 'true');
  }

  openHow() {
    this.dom.how.classList.remove('is-hidden');
    this.dom.how.setAttribute('aria-hidden', 'false');
    setTimeout(() => this.dom.howClose?.focus({ preventScroll: true }), 50);
    this.audio.ui();
  }

  closeHow() {
    this.dom.how.classList.add('is-hidden');
    this.dom.how.setAttribute('aria-hidden', 'true');
    $('#howBtn')?.focus({ preventScroll: true });
    this.audio.ui();
  }

  toast({ text, icon = '★', tone = '' }) {
    if (!text) return;
    const container = this.dom.toasts;
    while (container.children.length >= 3) container.firstChild.remove();
    const item = document.createElement('div');
    item.className = `toast${tone ? ` is-${tone}` : ''}`;
    const iconEl = document.createElement('i');
    iconEl.textContent = icon;
    const label = document.createElement('span');
    label.textContent = text;
    item.append(iconEl, label);
    container.append(item);
    setTimeout(() => item.remove(), 1300);
  }

  flash() {
    const el = $('#hitFlash');
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
  }

  handleResize() {
    this.renderer.resize();
  }

  updateHud() {
    const game = this.game;
    const dom = this.dom;
    const phase = game.phase;
    if (phase !== 'race' && phase !== 'countdown' && phase !== 'finishing' && phase !== 'paused') return;

    const rank = game.getRank();
    if (this.lastHud.rank !== rank) {
      this.lastHud.rank = rank;
      dom.posValue.innerHTML = `${rank}<span>/4</span>`;
    }
    const distance = Math.min(RACE_LENGTH, Math.floor(game.player.dist));
    if (this.lastHud.distance !== distance) {
      this.lastHud.distance = distance;
      dom.distValue.textContent = String(distance);
    }
    const time = game.raceTime.toFixed(2);
    if (this.lastHud.time !== time) {
      this.lastHud.time = time;
      dom.timeValue.textContent = `${time} s`;
    }
    const energy = Math.max(0, Math.min(100, game.player.energy));
    const energyRounded = Math.round(energy);
    if (this.lastHud.energy !== energyRounded) {
      this.lastHud.energy = energyRounded;
      dom.energyFill.style.transform = `scaleX(${energy / 100})`;
      dom.energyTrack.classList.toggle('is-low', energy < 24);
      dom.turboBtn.style.setProperty('--energy', energy.toFixed(1));
      dom.turboBtn.classList.toggle('is-empty', game.sprintLock || energy < 10);
    }

    const playerProgress = Math.max(0, Math.min(1, game.player.dist / RACE_LENGTH));
    dom.progressFill.style.width = `${playerProgress * 100}%`;
    dom.playerDot.style.left = `${playerProgress * 100}%`;
    for (let i = 0; i < game.rivals.length; i += 1) {
      const dot = dom.rivalDots[i];
      if (!dot) continue;
      const progress = Math.max(0, Math.min(1, game.rivals[i].dist / RACE_LENGTH));
      dot.style.left = `${progress * 100}%`;
    }

    const sprinting = game.sprintVisual > 0.35 && !this.muted;
    if (sprinting !== this.lastSprintClass) {
      this.lastSprintClass = sprinting;
      document.body.classList.toggle('is-sprinting', sprinting);
    }
    if (game.tilt.enabled) {
      dom.tiltBubble.style.setProperty('--tilt-x', `${game.tilt.value * 5}px`);
    }
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.game.update(dt);
    this.renderer.render(this.game);
    this.updateHud();
    requestAnimationFrame(this.frame);
  }
}

new LombaLariApp();
