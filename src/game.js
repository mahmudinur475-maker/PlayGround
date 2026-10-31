import {
  RACE_LENGTH,
  LANES,
  START_LANE,
  HAZARD,
  generateCourse,
  createRivals,
  medalClass,
} from './course.js';
import { clamp, damp, formatTime, prefersReducedMotion } from './util.js';

const BASE_SPEED = 12.62;
const TURBO_SPEED = 4.5;
const GRAVITY = 15.5;
const JUMP_VELOCITY = 5.15;
const PLAYER_GRAVITY = 16.2;
const PLAYER_JUMP = 5.2;
const ENERGY_DRAIN = 30;
const ENERGY_REGEN = 2.75;
const ORB_ENERGY = 13;
const RIVAL_COLORS = ['#ffc857', '#58e6ff', '#ff5d8f'];

const clamp01 = (value) => clamp(value, 0, 1);

export class Game {
  constructor({ renderer, audio, callbacks = {} }) {
    this.renderer = renderer;
    this.audio = audio;
    this.callbacks = callbacks;
    this.reducedMotion = prefersReducedMotion();

    this.phase = 'menu';
    this.pausedFrom = null;
    this.worldTime = 0;
    this.raceTime = 0;
    this.menuTime = 0;
    this.seed = 0;
    this.course = { obstacles: [], orbs: [], seed: 0 };
    this.player = this.createPlayer();
    this.rivals = [];
    const menuRel = this.renderer.height > this.renderer.width ? 13.6 : 11.4;
    this.cam = { x: 0, y: 4.25, rel: menuRel, z: -menuRel, zoom: 1, bob: 0, shake: 0 };
    this.effects = {
      particles: [],
      confetti: [],
      dustTimer: 0,
      stepTimer: 0,
      sparkTimer: 0,
    };
    this.holdSprint = false;
    this.sprinting = false;
    this.sprintLock = false;
    this.sprintVisual = 0;
    this.combo = 0;
    this.countdown = 0;
    this.countdownStep = 0;
    this.finishDelay = 0;
    this.finished = false;
    this.finalResults = null;
    this.lastRank = 1;
    this.flashCooldown = 0;
    this.lastSpeed = 0;
    this.tilt = {
      enabled: false,
      raw: 0,
      baseline: 0,
      calibrated: false,
      armed: false,
      value: 0,
      axis: 'gamma',
    };
    this.menuSetup();
  }

  createPlayer() {
    return {
      dist: 0,
      lane: START_LANE,
      x: LANES[START_LANE],
      speed: 0,
      energy: 60,
      jumpY: 0,
      jumpV: 0,
      sliding: 0,
      stumble: 0,
      stride: 0,
      lean: 0,
      hits: 0,
      place: null,
      finished: false,
      finishTime: null,
      sprinting: false,
    };
  }

  menuSetup() {
    const now = Date.now();
    this.seed = (now ^ (Math.random() * 0xffffffff)) >>> 0;
    this.course = generateCourse(this.seed);
    this.player = this.createPlayer();
    this.player.dist = 0;
    this.player.x = LANES[START_LANE];
    this.rivals = createRivals(this.seed);
    this.rivals.forEach((rival, index) => {
      rival.dist = 0.6 + index * 0.55;
      rival.x = LANES[rival.lane];
      rival.targetLane = rival.lane;
      rival.speed = 0;
      rival.stride = index * 2.3;
    });
    const menuRel = this.renderer.height > this.renderer.width ? 13.6 : 11.4;
    this.cam = { x: 0, y: 4.25, rel: menuRel, z: -menuRel, zoom: 1, bob: 0, shake: 0 };
    this.audio?.setSprint(false);
    this.audio?.setCrowd(0.3);
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  emit(name, ...args) {
    const fn = this.callbacks[name];
    if (typeof fn === 'function') fn(...args);
  }

  startRace(seedOverride = null) {
    if (this.phase === 'countdown' || this.phase === 'race') return;
    this.seed = seedOverride ?? (((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0) || 1);
    this.course = generateCourse(this.seed);
    this.player = this.createPlayer();
    this.player.x = LANES[START_LANE];
    this.rivals = createRivals(this.seed);
    this.rivals.forEach((rival) => {
      rival.dist = 0;
      rival.x = LANES[rival.lane];
      rival.targetLane = rival.lane;
      rival.speed = 10.8;
    });
    this.raceTime = 0;
    this.finished = false;
    this.finalResults = null;
    this.finishDelay = 0;
    this.combo = 0;
    this.holdSprint = false;
    this.sprinting = false;
    this.sprintLock = false;
    this.sprintVisual = 0;
    this.effects.particles.length = 0;
    this.effects.confetti.length = 0;
    this.effects.dustTimer = 0;
    this.effects.stepTimer = 0;
    this.countdown = 3.0;
    this.countdownStep = 3;
    this.tilt.calibrated = false;
    this.tilt.armed = false;
    this.tilt.value = 0;
    this.player.energy = 62;
    this.phase = 'countdown';
    this.emit('onPhase', 'countdown');
    this.emit('onCountdown', '3');
    this.audio?.unlock();
    this.audio?.setCrowd(0.62);
    this.audio?.countdown(false);
  }

  setPaused(paused) {
    if (paused) {
      if (this.phase !== 'race' && this.phase !== 'countdown') return false;
      this.pausedFrom = this.phase;
      this.phase = 'paused';
      this.holdSprint = false;
      this.sprinting = false;
      this.audio?.setSprint(false);
      this.emit('onPause', true);
      return true;
    }
    if (this.phase !== 'paused') return false;
    this.phase = this.pausedFrom || 'race';
    this.emit('onPause', false);
    return true;
  }

  togglePause() {
    if (this.phase === 'paused') return this.setPaused(false);
    return this.setPaused(true);
  }

  quitToMenu() {
    this.holdSprint = false;
    this.sprinting = false;
    this.audio?.setSprint(false);
    this.menuSetup();
    this.phase = 'menu';
    this.emit('onPhase', 'menu');
    this.emit('onPause', false);
  }

  restart() {
    this.phase = 'menu';
    this.startRace();
  }

  moveLane(direction) {
    if (this.phase !== 'race' && this.phase !== 'countdown') return;
    if (this.player.stumble > 0.62) return;
    const next = clamp(this.player.lane + direction, 0, LANES.length - 1);
    if (next === this.player.lane) return;
    this.player.lane = next;
    this.audio?.lane();
    this.effects.sparkTimer = 0;
  }

  jump() {
    if (this.phase !== 'race') return;
    const player = this.player;
    if (player.jumpY > 0.01 || player.sliding > 0 || player.stumble > 0.65) return;
    player.jumpV = PLAYER_JUMP;
    player.jumpY = 0.001;
    player.sliding = 0;
    this.audio?.jump();
    this.spawnDust(8, 0.7);
  }

  slide() {
    if (this.phase !== 'race') return;
    const player = this.player;
    if (player.sliding > 0 || player.jumpY > 0.01 || player.stumble > 0.65) return;
    player.sliding = 0.62;
    this.audio?.slide();
    this.spawnDust(5, 0.5);
  }

  setSprint(active) {
    this.holdSprint = Boolean(active);
    if (!active) {
      this.sprinting = false;
      this.audio?.setSprint(false);
    }
  }

  setTiltEnabled(enabled) {
    this.tilt.enabled = Boolean(enabled);
    this.tilt.calibrated = false;
    this.tilt.armed = false;
    this.tilt.value = 0;
    if (!enabled) this.audio?.setSprint(false);
  }

  handleOrientation({ gamma, beta, angle = 0 }) {
    if (!this.tilt.enabled) return;
    const portrait = Math.abs(angle) < 45 || Math.abs(angle) > 135;
    const raw = portrait ? gamma : beta;
    if (!Number.isFinite(raw)) return;
    this.tilt.raw = raw;
    if (!this.tilt.calibrated) {
      this.tilt.baseline = raw;
      this.tilt.calibrated = true;
      this.tilt.armed = true;
      return;
    }
    const delta = raw - this.tilt.baseline;
    this.tilt.value = clamp(delta / 28, -1, 1);
    if (this.phase !== 'race') return;
    if (!this.tilt.armed) {
      if (Math.abs(delta) < 5) this.tilt.armed = true;
      return;
    }
    if (delta > 15) {
      this.moveLane(1);
      this.tilt.armed = false;
    } else if (delta < -15) {
      this.moveLane(-1);
      this.tilt.armed = false;
    }
  }

  recalibrateTilt() {
    this.tilt.calibrated = false;
    this.tilt.armed = false;
    this.tilt.value = 0;
  }

  getRank() {
    const playerDist = this.player.dist;
    let rank = 1;
    for (const rival of this.rivals) {
      if (rival.dist > playerDist + 0.02) rank += 1;
    }
    return rank;
  }

  update(dt) {
    dt = clamp(dt, 0, 0.05);
    this.worldTime += dt;

    if (this.phase === 'paused') {
      return;
    }

    if (this.phase === 'menu') {
      this.menuTime += dt;
      this.updateMenuRunners(dt);
      this.updateCamera(dt);
      this.updateEffects(dt);
      return;
    }

    if (this.phase === 'countdown') {
      this.updateCountdown(dt);
      this.updateIdleRunners(dt);
      this.updateCamera(dt);
      this.updateEffects(dt);
      return;
    }

    if (this.phase === 'race') {
      this.raceTime += dt;
      this.updatePlayer(dt);
      this.updateRivals(dt);
      this.updateCamera(dt);
      this.updateEffects(dt);
      this.checkCourse();
      if (!this.finished && this.player.dist >= RACE_LENGTH) {
        this.crossFinish();
      }
      return;
    }

    if (this.phase === 'finishing') {
      this.updateFinishing(dt);
      this.updateCamera(dt);
      this.updateEffects(dt);
      return;
    }

    if (this.phase === 'results') {
      this.updateCamera(dt);
      this.updateEffects(dt);
      this.updateCelebrationRunners(dt);
    }
  }

  updateCountdown(dt) {
    const previous = Math.ceil(this.countdown);
    this.countdown -= dt;
    const current = Math.ceil(this.countdown);
    if (current !== previous && current > 0) {
      this.countdownStep = current;
      this.emit('onCountdown', String(current));
      this.audio?.countdown(false);
    }
    this.player.stride += dt * 2.4;
    this.player.lean = damp(this.player.lean, 0, 8, dt);
    if (this.countdown <= 0) {
      this.phase = 'race';
      this.raceTime = 0;
      this.player.speed = 11.6;
      this.emit('onCountdown', 'LARI!');
      this.audio?.countdown(true);
      this.audio?.cheer();
      this.emit('onRaceStart');
    }
  }

  updateMenuRunners(dt) {
    const bob = Math.sin(this.worldTime * 2.1) * 0.01;
    this.player.stride += dt * 2.2;
    this.player.lean = damp(this.player.lean, bob, 3, dt);
    for (let i = 0; i < this.rivals.length; i += 1) {
      const rival = this.rivals[i];
      rival.stride += dt * (1.8 + i * 0.15);
      rival.speed = 0;
    }
  }

  updateIdleRunners(dt) {
    this.player.stride += dt * 2.4;
    this.player.x = damp(this.player.x, LANES[this.player.lane], 12, dt);
    for (const rival of this.rivals) {
      rival.stride += dt * 2.1;
      rival.x = damp(rival.x, LANES[rival.lane], 10, dt);
    }
  }

  updatePlayer(dt) {
    const player = this.player;
    const previousX = player.x;
    player.x = damp(player.x, LANES[player.lane], 13, dt);
    player.lean = damp(player.lean, clamp(((player.x - previousX) / Math.max(dt, 0.001)) * 0.035, -0.48, 0.48), 10, dt);

    player.stumble = Math.max(0, player.stumble - dt);
    player.sliding = Math.max(0, player.sliding - dt);

    if (player.jumpY > 0 || player.jumpV > 0) {
      player.jumpV -= PLAYER_GRAVITY * dt;
      player.jumpY += player.jumpV * dt;
      if (player.jumpY <= 0) {
        player.jumpY = 0;
        player.jumpV = 0;
        this.spawnDust(6, 0.6);
      }
    }

    const canSprint = this.holdSprint && !this.sprintLock && player.energy > 0.5 && player.stumble <= 0.1;
    if (canSprint) {
      player.sprinting = true;
      player.energy = Math.max(0, player.energy - ENERGY_DRAIN * dt);
      if (player.energy <= 0) {
        player.sprinting = false;
        this.sprintLock = true;
        this.audio?.setSprint(false);
        this.emit('onToast', { text: 'Energi habis', icon: '!', tone: 'warn' });
      }
    } else {
      player.sprinting = false;
      player.energy = Math.min(100, player.energy + ENERGY_REGEN * dt);
      if (player.energy >= 15) this.sprintLock = false;
    }
    this.sprinting = player.sprinting;
    this.audio?.setSprint(player.sprinting);
    this.sprintVisual = damp(this.sprintVisual, player.sprinting ? 1 : 0, 7, dt);

    let target = BASE_SPEED + (player.sprinting ? TURBO_SPEED : 0);
    if (player.stumble > 0) target = 6.9;
    if (player.sliding > 0) target -= 0.4;
    if (player.jumpY > 0) target -= 0.2;
    const smoothing = target < player.speed ? 4.2 : 2.2;
    player.speed = damp(player.speed, target, smoothing, dt);
    player.dist += player.speed * dt;
    player.stride += dt * (5.4 + player.speed * 0.5);

    this.effects.dustTimer -= dt;
    if (player.speed > 6 && this.effects.dustTimer <= 0) {
      this.effects.dustTimer = player.sprinting ? 0.055 : 0.095;
      this.spawnDust(player.sprinting ? 3 : 2, player.sprinting ? 0.9 : 0.55, player.jumpY > 0 ? 0.4 : 0);
    }

    this.effects.stepTimer -= dt;
    if (this.effects.stepTimer <= 0 && player.jumpY <= 0.02) {
      this.effects.stepTimer = clamp(1 / (4.2 + player.speed * 0.3), 0.08, 0.24);
      this.audio?.step(clamp(player.speed / 14, 0.5, 1.2));
    }

    if (player.jumpY > 0) this.effects.sparkTimer += dt;
  }

  updateRivals(dt) {
    const playerDist = this.player.dist;
    for (const rival of this.rivals) {
      if (rival.finished) {
        rival.speed = damp(rival.speed, 6, 2, dt);
        rival.dist += rival.speed * dt;
        continue;
      }
      rival.think -= dt;

      if (rival.think <= 0) {
        rival.think = 0.22 + Math.random() * 0.18;
        this.planRivalLane(rival);
      }

      const nextHazard = this.nextHazardFor(rival);
      if (nextHazard) {
        const gap = nextHazard.d - rival.dist;
        if (gap < 4.8 && gap > 0.2) {
          if (nextHazard.type === HAZARD.HURDLE && rival.jumpY <= 0 && rival.slide <= 0) {
            rival.jumpV = JUMP_VELOCITY;
            rival.jumpY = 0.001;
          } else if (nextHazard.type === HAZARD.BARRIER && rival.slide <= 0 && rival.jumpY <= 0) {
            rival.slide = 0.58;
          }
        }
      }

      rival.slide = Math.max(0, rival.slide - dt);
      if (rival.jumpY > 0 || rival.jumpV > 0) {
        rival.jumpV -= GRAVITY * dt;
        rival.jumpY += rival.jumpV * dt;
        if (rival.jumpY <= 0) {
          rival.jumpY = 0;
          rival.jumpV = 0;
        }
      }

      const gap = rival.dist - playerDist;
      const rubber = clamp(-gap * 0.009, -0.2, 0.28);
      const surge = rival.dist > RACE_LENGTH * 0.76 ? rival.surge : 0;
      const wobble = Math.sin(this.raceTime * 0.82 + rival.phase) * rival.wobble;
      let target = rival.base + rubber + surge + wobble;
      if (rival.slide > 0) target -= 0.25;
      if (rival.jumpY > 0) target -= 0.2;
      rival.speed = damp(rival.speed, target, 2.2, dt);
      rival.dist += rival.speed * dt;
      rival.x = damp(rival.x, LANES[rival.targetLane], 9, dt);
      rival.stride += dt * (5.2 + rival.speed * 0.5);

      if (rival.dist >= RACE_LENGTH && !rival.finished) {
        rival.finished = true;
        rival.finishTime = this.raceTime - (rival.dist - RACE_LENGTH) / Math.max(rival.speed, 1);
        rival.dist = RACE_LENGTH;
      }
    }
  }

  planRivalLane(rival) {
    const player = this.player;
    const nearPlayer = Math.abs(rival.dist - player.dist) < 8;
    const lookAhead = [];
    for (const obstacle of this.course.obstacles) {
      const gap = obstacle.d - rival.dist;
      if (gap > 1 && gap < 24 && obstacle.type === HAZARD.CONE) lookAhead.push(obstacle);
    }

    // Do not sit on top of the player: step aside when level and sharing a lane.
    if (nearPlayer && rival.targetLane === player.lane) {
      const options = [rival.targetLane - 1, rival.targetLane + 1].filter(
        (lane) => lane >= 0 && lane < LANES.length,
      );
      const safe = options.filter((lane) => !lookAhead.some((obstacle) => obstacle.lane === lane));
      const choices = safe.length ? safe : options;
      if (choices.length) {
        choices.sort((a, b) => Math.abs(a - rival.targetLane) - Math.abs(b - rival.targetLane));
        rival.targetLane = choices[0];
      }
      return;
    }

    const blocked = lookAhead.some((obstacle) => obstacle.lane === rival.targetLane);
    if (!blocked) {
      if (rival.dist > 28 && Math.random() < 0.018) {
        const options = [rival.targetLane - 1, rival.targetLane + 1].filter(
          (lane) =>
            lane >= 0 &&
            lane < LANES.length &&
            !(nearPlayer && lane === player.lane),
        );
        if (options.length) rival.targetLane = options[Math.floor(Math.random() * options.length)];
      }
      return;
    }
    const candidates = [];
    for (let lane = 0; lane < LANES.length; lane += 1) {
      if (lane === rival.targetLane) continue;
      const dangerous = lookAhead.some((obstacle) => obstacle.lane === lane);
      if (!dangerous) candidates.push(lane);
    }
    if (candidates.length) {
      const safe = nearPlayer ? candidates.filter((lane) => lane !== player.lane) : candidates;
      const choices = safe.length ? safe : candidates;
      choices.sort((a, b) => Math.abs(a - rival.targetLane) - Math.abs(b - rival.targetLane));
      rival.targetLane = choices[0];
    }
  }

  nextHazardFor(rival) {
    let best = null;
    for (const obstacle of this.course.obstacles) {
      const gap = obstacle.d - rival.dist;
      if (gap <= 0 || gap > 14) continue;
      if (obstacle.lane !== rival.targetLane) continue;
      if (!best || obstacle.d < best.d) best = obstacle;
    }
    return best;
  }

  checkCourse() {
    const player = this.player;

    for (const obstacle of this.course.obstacles) {
      if (obstacle.hit || obstacle.cleared) continue;
      const delta = obstacle.d - player.dist;
      if (delta > 0.85 || delta < -0.9) continue;
      if (Math.abs(player.x - LANES[obstacle.lane]) > 0.56) continue;

      let cleared = false;
      if (obstacle.type === HAZARD.HURDLE) cleared = player.jumpY > 0.5;
      else if (obstacle.type === HAZARD.BARRIER) cleared = player.sliding > 0 && player.jumpY < 0.16;
      else if (obstacle.type === HAZARD.CONE) cleared = player.jumpY > 0.42;

      if (cleared) {
        obstacle.cleared = true;
        this.combo += 1;
        player.energy = Math.min(100, player.energy + 3.5);
        this.audio?.clear();
        this.spawnBurst(LANES[obstacle.lane], obstacle.type === HAZARD.BARRIER ? 1.5 : 0.7, obstacle.d, 5, '#d8ff57', 0.5);
        if (this.combo > 0 && this.combo % 3 === 0) {
          this.emit('onToast', { text: `Bersih x${this.combo}`, icon: '✓', tone: 'good' });
        }
      } else {
        obstacle.hit = true;
        player.stumble = 1.0;
        player.speed = Math.min(player.speed, 6.4);
        player.hits += 1;
        this.combo = 0;
        this.cam.shake = this.reducedMotion ? 0.25 : 1;
        this.audio?.hit();
        if (navigator.vibrate) navigator.vibrate([18, 25, 24]);
        this.spawnBurst(player.x, 0.8, player.dist + 0.4, 14, '#ff8a4c', 0.8);
        this.emit('onFlash');
        this.emit('onToast', { text: 'Aduh! Kecepatan turun', icon: '!', tone: 'warn' });
      }
    }

    for (const orb of this.course.orbs) {
      if (orb.taken) continue;
      const delta = orb.d - player.dist;
      if (Math.abs(delta) > 0.95) continue;
      if (Math.abs(player.x - LANES[orb.lane]) > 0.62) continue;
      orb.taken = true;
      player.energy = Math.min(100, player.energy + ORB_ENERGY);
      this.combo += 1;
      this.audio?.pickup(this.combo);
      this.spawnBurst(LANES[orb.lane], orb.y, orb.d, 12, '#ffe27a', 0.55);
      if (navigator.vibrate) navigator.vibrate(8);
      this.emit('onToast', { text: `+${ORB_ENERGY} energi`, icon: '⚡', tone: 'good' });
    }
  }

  crossFinish() {
    this.finished = true;
    this.player.finished = true;
    const overshoot = Math.max(0, this.player.dist - RACE_LENGTH);
    this.player.finishTime = this.raceTime - overshoot / Math.max(this.player.speed, 1);
    this.phase = 'finishing';
    this.finishDelay = 1.05;
    this.holdSprint = false;
    this.sprinting = false;
    this.audio?.setSprint(false);
    this.computeFinalResults();
    this.spawnConfetti();
    this.audio?.finish(this.player.place);
    this.audio?.cheer();
    this.emit('onFinishCrossed', this.finalResults);
  }

  computeFinalResults() {
    const now = this.raceTime;
    const entries = [
      {
        id: 'you',
        name: 'KAMU',
        color: '#d8ff57',
        isPlayer: true,
        time: this.player.finishTime ?? now,
      },
      ...this.rivals.map((rival, index) => ({
        id: rival.id,
        name: rival.name,
        color: RIVAL_COLORS[index] || rival.jersey,
        isPlayer: false,
        time: rival.finished
          ? rival.finishTime
          : now + Math.max(0.1, (RACE_LENGTH - rival.dist) / Math.max(rival.speed, 8)),
      })),
    ];
    entries.sort((a, b) => a.time - b.time);
    entries.forEach((entry, index) => {
      entry.place = index + 1;
    });
    const playerEntry = entries.find((entry) => entry.isPlayer);
    this.player.place = playerEntry.place;
    this.finalResults = {
      place: playerEntry.place,
      time: this.player.finishTime,
      entries,
      medal: medalClass(playerEntry.place),
      label:
        playerEntry.place === 1
          ? 'Juara 1'
          : playerEntry.place === 2
            ? 'Juara 2'
            : playerEntry.place === 3
              ? 'Juara 3'
              : 'Garis finish',
    };
  }

  updateFinishing(dt) {
    const player = this.player;
    player.speed = damp(player.speed, 3.2, 1.6, dt);
    player.dist += player.speed * dt;
    player.stride += dt * (4 + player.speed * 0.4);
    player.lean = damp(player.lean, 0, 4, dt);
    this.finishDelay -= dt;
    if (this.finishDelay <= 0 && this.finalResults) {
      this.phase = 'results';
      this.emit('onResults', this.finalResults);
    }
  }

  updateCelebrationRunners(dt) {
    this.player.stride += dt * 1.4;
    for (const rival of this.rivals) {
      rival.stride += dt * 1.2;
    }
  }

  updateCamera(dt) {
    const isMenu = this.phase === 'menu';
    const portrait = this.renderer.height > this.renderer.width;
    const targetX = isMenu ? 0 : this.player.x * 0.32;
    const targetY = isMenu ? 4.25 : 3.56;
    const targetRel = isMenu ? (portrait ? 13.6 : 11.4) : portrait ? 10.35 : 8.7;
    const targetZoom = isMenu ? 1 : 1 + this.sprintVisual * 0.028;
    this.cam.x = damp(this.cam.x, targetX, isMenu ? 3 : 7, dt);
    this.cam.y = damp(this.cam.y, targetY, 4, dt);
    this.cam.rel = damp(this.cam.rel, targetRel, 4, dt);
    this.cam.zoom = damp(this.cam.zoom, targetZoom, 5, dt);
    this.cam.z = this.player.dist - this.cam.rel;
    const bobStrength = isMenu ? 0.35 : this.phase === 'race' ? 1.35 : 0.7;
    this.cam.bob = Math.sin(this.player.stride * 2) * bobStrength + Math.sin(this.worldTime * 7.2) * 0.12;
    this.cam.shake = Math.max(0, this.cam.shake - dt * 3.4);
  }

  updateEffects(dt) {
    const reduced = this.reducedMotion;
    for (let i = this.effects.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.effects.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.effects.particles.splice(i, 1);
        continue;
      }
      particle.vy -= particle.gravity * dt;
      particle.vx *= 1 - particle.drag * dt;
      particle.vz *= 1 - particle.drag * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      if (particle.y < 0) {
        particle.y = 0;
        particle.vy *= -0.2;
      }
    }
    if (this.effects.particles.length > (reduced ? 90 : 240)) {
      this.effects.particles.splice(0, this.effects.particles.length - (reduced ? 90 : 240));
    }

    const width = this.renderer.width || 1;
    const height = this.renderer.height || 1;
    for (let i = this.effects.confetti.length - 1; i >= 0; i -= 1) {
      const piece = this.effects.confetti[i];
      piece.life -= dt;
      if (piece.life <= 0) {
        this.effects.confetti.splice(i, 1);
        continue;
      }
      piece.vy += 240 * dt;
      piece.vx += Math.sin(piece.life * 4 + piece.phase) * 34 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.rotation += piece.spin * dt;
      if (piece.y > height + 40) piece.life = 0;
      if (piece.x < -30) piece.x = width + 30;
      if (piece.x > width + 30) piece.x = -30;
    }

    this.sprintVisual = damp(this.sprintVisual, this.sprinting ? 1 : 0, 6, dt);
    if (this.effects.particles.length === 0 && this.phase === 'menu') {
      this.effects.sparkTimer = 0;
    }
  }

  spawnDust(count = 3, strength = 0.6, lift = 0) {
    const player = this.player;
    const reduced = this.reducedMotion;
    const amount = reduced ? Math.ceil(count / 2) : count;
    for (let i = 0; i < amount; i += 1) {
      this.effects.particles.push({
        x: player.x + (Math.random() - 0.5) * 0.55,
        y: 0.04 + Math.random() * 0.08 + lift,
        z: player.dist - 0.1 - Math.random() * 0.3,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 0.35 + Math.random() * 0.8 * strength,
        vz: -1.2 - Math.random() * 2.6,
        gravity: 1.8,
        drag: 1.5,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        size: 0.04 + Math.random() * 0.08 * strength,
        color: Math.random() < 0.55 ? '#d8b48a' : '#f0d4aa',
        kind: 'dust',
      });
    }
  }

  spawnBurst(x, y, z, count, color, strength = 0.6) {
    const reduced = this.reducedMotion;
    const amount = reduced ? Math.ceil(count / 2) : count;
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.6 + Math.random() * 2.4) * strength;
      this.effects.particles.push({
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vy: 0.7 + Math.random() * 2.4 * strength,
        vz: Math.sin(angle) * speed * 0.7,
        gravity: 4.8,
        drag: 0.8,
        life: 0.35 + Math.random() * 0.55,
        max: 0.9,
        size: 0.03 + Math.random() * 0.06,
        color: Math.random() < 0.45 ? '#ffffff' : color,
        kind: 'spark',
      });
    }
  }

  spawnConfetti() {
    const width = this.renderer.width || 800;
    const height = this.renderer.height || 600;
    const colors = ['#d8ff57', '#ffc857', '#ff5d8f', '#58e6ff', '#f6f1e3', '#ff8a4c'];
    const amount = this.reducedMotion ? 50 : 150;
    for (let i = 0; i < amount; i += 1) {
      this.effects.confetti.push({
        x: width * (0.15 + Math.random() * 0.7),
        y: -height * (0.05 + Math.random() * 0.5),
        vx: (Math.random() - 0.5) * 260,
        vy: -40 - Math.random() * 120,
        size: 3 + Math.random() * 5,
        w: 3 + Math.random() * 6,
        h: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 14,
        phase: Math.random() * Math.PI * 2,
        life: 3 + Math.random() * 2.4,
        max: 5.4,
      });
    }
  }

  debugFinish() {
    if (this.phase !== 'race') return false;
    this.player.dist = RACE_LENGTH;
    this.player.speed = 13;
    this.raceTime = Math.max(this.raceTime, 20);
    this.player.finishTime = this.raceTime;
    this.phase = 'race';
    return true;
  }

  showResultsNow() {
    if (!this.finalResults) this.computeFinalResults();
    this.phase = 'results';
    this.emit('onResults', this.finalResults);
  }

  getSnapshot() {
    return {
      phase: this.phase,
      seed: this.seed,
      raceTime: this.raceTime,
      distance: this.player.dist,
      speed: this.player.speed,
      energy: this.player.energy,
      lane: this.player.lane,
      rank: this.getRank(),
      place: this.player.place,
      sprinting: this.player.sprinting,
      obstacles: this.course.obstacles.length,
      orbs: this.course.orbs.length,
      jumpY: this.player.jumpY,
      sliding: this.player.sliding,
      tilt: { ...this.tilt },
      results: this.finalResults
        ? {
            place: this.finalResults.place,
            time: this.finalResults.time,
            entries: this.finalResults.entries,
          }
        : null,
    };
  }

  debugState() {
    return this.getSnapshot();
  }
}

export { formatTime };
