import { drawRunner, drawRunnerShadow, drawRunnerTag } from './runner.js';
import { LANES, HAZARD, RACE_LENGTH, TRACK_EDGE } from './course.js';
import { clamp, easeOutCubic } from './util.js';

const FONT = '"Lato", "DejaVu Sans", "Helvetica Neue", Arial, sans-serif';
const CROWD_COLORS = ['#ffc857', '#ff8a4c', '#f6f1e3', '#58e6ff', '#ff5d8f', '#b7e82f', '#8ba6d9'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.horizon = 0;
    this.focalBase = 800;
    this.backdrop = null;
    this.backdropW = 0;
    this.backdropH = 0;
    this.reducedMotion = false;
    this.resize();
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.horizon = height * (width > height ? 0.345 : 0.355);
    this.focalBase = height * 0.98;
    this.reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildBackdrop();
  }

  setCameraProjection(cam) {
    return {
      x: cam.x,
      y: cam.y,
      z: cam.z,
      focal: this.focalBase * cam.zoom,
      horizon: this.horizon,
    };
  }

  project(cam, x, y, z) {
    const rel = z - cam.z;
    if (rel < 0.35) return null;
    const scale = cam.focal / rel;
    return {
      x: this.width / 2 + (x - cam.x) * scale,
      y: cam.horizon + (cam.y - y) * scale,
      s: scale,
      rel,
    };
  }

  // ==================================================================
  // backdrop
  // ==================================================================

  buildBackdrop() {
    const w = this.width;
    const h = this.height;
    const dpr = Math.min(this.dpr, 1.75);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const horizon = this.horizon;

    // sky ------------------------------------------------------------
    const sky = ctx.createLinearGradient(0, 0, 0, horizon + 26);
    sky.addColorStop(0, '#040916');
    sky.addColorStop(0.26, '#0b1230');
    sky.addColorStop(0.52, '#25204c');
    sky.addColorStop(0.72, '#572955');
    sky.addColorStop(0.87, '#b03d58');
    sky.addColorStop(1, '#ff7a45');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 28);

    // stars
    const random = this.seeded(9173);
    ctx.save();
    for (let i = 0; i < 110; i += 1) {
      const x = random() * w;
      const y = random() * horizon * 0.72;
      const radius = random() * 1.25 + 0.25;
      const alpha = 0.15 + random() * 0.62;
      ctx.fillStyle = `rgba(231, 240, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // cloud bands
    ctx.save();
    ctx.filter = 'blur(15px)';
    for (let i = 0; i < 7; i += 1) {
      const x = random() * w;
      const y = horizon * (0.3 + random() * 0.48);
      const rx = 70 + random() * 190;
      const ry = 7 + random() * 19;
      const gradient = ctx.createLinearGradient(0, y - ry, 0, y + ry);
      gradient.addColorStop(0, 'rgba(255, 129, 112, 0.12)');
      gradient.addColorStop(1, 'rgba(90, 45, 104, 0.03)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, -0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // sun
    const sunX = w * 0.785;
    const sunY = horizon - 48;
    const sunRadius = Math.min(w, h) * 0.085;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.18, sunX, sunY, sunRadius * 4.2);
    sunGlow.addColorStop(0, 'rgba(255, 232, 167, 0.95)');
    sunGlow.addColorStop(0.16, 'rgba(255, 195, 108, 0.66)');
    sunGlow.addColorStop(0.42, 'rgba(255, 125, 81, 0.2)');
    sunGlow.addColorStop(1, 'rgba(255, 94, 75, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - sunRadius * 4.4, sunY - sunRadius * 4.4, sunRadius * 8.8, sunRadius * 8.8);
    const sunCore = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
    sunCore.addColorStop(0, '#fff6d8');
    sunCore.addColorStop(0.54, '#ffd184');
    sunCore.addColorStop(1, 'rgba(255, 139, 72, 0.18)');
    ctx.fillStyle = sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // distant mountains
    this.drawRidge(ctx, w, horizon + 4, horizon * 0.1, '#2c1c3d', 0.65, 11, random);
    this.drawRidge(ctx, w, horizon + 8, horizon * 0.065, '#1a142f', 0.9, 7, random);

    // stadium bowl
    this.drawStadium(ctx, w, h, horizon, random);

    // warm haze at the horizon
    const haze = ctx.createLinearGradient(0, horizon - 48, 0, horizon + 36);
    haze.addColorStop(0, 'rgba(255, 145, 91, 0)');
    haze.addColorStop(0.55, 'rgba(255, 135, 84, 0.14)');
    haze.addColorStop(1, 'rgba(255, 120, 72, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 48, w, 84);

    // grass below horizon
    const grass = ctx.createLinearGradient(0, horizon, 0, h);
    grass.addColorStop(0, '#184b3d');
    grass.addColorStop(0.34, '#0e352d');
    grass.addColorStop(1, '#071b1c');
    ctx.fillStyle = grass;
    ctx.fillRect(0, horizon + 2, w, h - horizon);

    // vignette on the backdrop
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.2, w * 0.5, h * 0.48, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(1,4,12,0.36)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    this.backdrop = canvas;
    this.backdropW = w;
    this.backdropH = h;
  }

  seeded(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  drawRidge(ctx, w, baseY, height, color, alpha, peaks, random) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, baseY);
    const points = Math.max(5, peaks);
    for (let i = 0; i <= points; i += 1) {
      const x = (i / points) * (w + 20) - 10;
      const y = baseY - (0.18 + random() * 0.82) * height;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 10, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawStadium(ctx, w, h, horizon, random) {
    const roofY = horizon - Math.min(112, h * 0.145);
    const standTop = horizon - 92;
    const frontY = horizon + 5;

    // roof silhouette
    ctx.save();
    ctx.fillStyle = '#080f22';
    ctx.beginPath();
    ctx.moveTo(-20, horizon - 44);
    ctx.quadraticCurveTo(w * 0.5, roofY - 18, w + 20, horizon - 44);
    ctx.lineTo(w + 20, horizon - 24);
    ctx.quadraticCurveTo(w * 0.5, roofY + 14, -20, horizon - 24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // back of the stands
    ctx.fillStyle = '#101a34';
    ctx.beginPath();
    ctx.moveTo(-20, standTop - 12);
    ctx.quadraticCurveTo(w * 0.5, standTop - 36, w + 20, standTop - 12);
    ctx.lineTo(w + 20, frontY);
    ctx.lineTo(-20, frontY);
    ctx.closePath();
    ctx.fill();

    // tiers
    const tiers = [
      { y: standTop - 8, height: 27, color: '#17213c' },
      { y: standTop + 20, height: 27, color: '#1d2948' },
      { y: standTop + 48, height: 26, color: '#243153' },
      { y: standTop + 75, height: 20, color: '#2c3a5e' },
    ];
    for (const tier of tiers) {
      ctx.fillStyle = tier.color;
      ctx.fillRect(-20, tier.y, w + 40, tier.height);
      ctx.fillStyle = 'rgba(5, 11, 24, 0.28)';
      ctx.fillRect(-20, tier.y + tier.height - 2, w + 40, 2);
    }

    // crowd
    ctx.save();
    for (let i = 0; i < 560; i += 1) {
      const x = random() * w;
      const band = Math.floor(random() * tiers.length);
      const tier = tiers[band];
      const y = tier.y + 4 + random() * (tier.height - 7);
      const size = 0.8 + random() * 1.6;
      ctx.globalAlpha = 0.38 + random() * 0.58;
      ctx.fillStyle = CROWD_COLORS[Math.floor(random() * CROWD_COLORS.length)];
      ctx.fillRect(x, y, size, size + 0.6);
    }
    ctx.restore();

    // aisles
    for (let i = 1; i < 16; i += 1) {
      const x = (i / 16) * w;
      ctx.fillStyle = 'rgba(6, 12, 27, 0.26)';
      ctx.fillRect(x - 1.2, standTop - 6, 2.4, 94);
    }

    // sponsor wall
    const wallTop = horizon - 12;
    ctx.fillStyle = '#0c152b';
    ctx.fillRect(-20, wallTop, w + 40, 21);
    const banners = ['LOMBA LARI', 'SPRINT', 'SENJA', '320 M', 'MERDEKA', 'TURBO'];
    let cursor = -30;
    let index = 0;
    while (cursor < w + 40) {
      const width = 54 + ((index * 17) % 42);
      ctx.fillStyle = index % 3 === 0 ? '#d8ff57' : index % 3 === 1 ? '#ff8a4c' : '#58e6ff';
      ctx.globalAlpha = 0.72;
      ctx.fillRect(cursor, wallTop + 4, width, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#071226';
      ctx.font = `900 6.5px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(banners[index % banners.length], cursor + width / 2, wallTop + 10.2);
      cursor += width + 16;
      index += 1;
    }

    // floodlight towers
    const towers = [0.055, 0.5, 0.945];
    for (let i = 0; i < towers.length; i += 1) {
      const x = towers[i] * w;
      const top = standTop - (i === 1 ? 118 : 138);
      ctx.strokeStyle = '#0a1225';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(x, standTop - 6);
      ctx.lineTo(x, top);
      ctx.stroke();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(x, standTop - 8);
      ctx.lineTo(x, top + 4);
      ctx.stroke();

      const lampW = i === 1 ? 46 : 38;
      const lampH = 17;
      ctx.fillStyle = '#0b1327';
      ctx.fillRect(x - lampW / 2, top - 4, lampW, lampH);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - lampW / 2, top - 4, lampW, lampH);
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          const lx = x - lampW / 2 + 6 + col * ((lampW - 12) / 4);
          const ly = top + 2 + row * 6;
          ctx.fillStyle = '#fff2c5';
          ctx.beginPath();
          ctx.arc(lx, ly, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const glow = ctx.createRadialGradient(x, top + 6, 0, x, top + 6, 70);
      glow.addColorStop(0, 'rgba(255, 236, 180, 0.34)');
      glow.addColorStop(0.32, 'rgba(255, 223, 150, 0.12)');
      glow.addColorStop(1, 'rgba(255, 210, 140, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 72, top - 66, 144, 144);

      // soft light beam
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const beam = ctx.createLinearGradient(x, top, x + (i === 0 ? 140 : i === 2 ? -140 : 0), horizon + 40);
      beam.addColorStop(0, 'rgba(255, 240, 193, 0.09)');
      beam.addColorStop(1, 'rgba(255, 205, 135, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 10, top + 8);
      ctx.lineTo(x + 10, top + 8);
      const spread = i === 1 ? 90 : 170;
      const dir = i === 0 ? 1 : i === 2 ? -1 : 0;
      ctx.lineTo(x + dir * spread + 38, horizon + 28);
      ctx.lineTo(x + dir * spread - 38, horizon + 28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // scoreboard
    const boardW = Math.min(206, w * 0.27);
    const boardH = boardW * 0.29;
    const boardX = w / 2 - boardW / 2;
    const boardY = standTop - 86 - boardH * 0.3;
    ctx.save();
    ctx.fillStyle = '#050b19';
    ctx.strokeStyle = 'rgba(216,255,87,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardW, boardH, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d8ff57';
    ctx.font = `900 ${Math.max(10, boardW * 0.105)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LOMBA LARI', w / 2, boardY + boardH * 0.43);
    ctx.fillStyle = 'rgba(246,241,227,0.52)';
    ctx.font = `900 ${Math.max(5, boardW * 0.045)}px ${FONT}`;
    ctx.fillText('FINAL 320 METER · STADION SENJA', w / 2, boardY + boardH * 0.7);
    ctx.restore();

    // palm silhouettes at the edges
    this.drawPalm(ctx, w * 0.015, horizon + 26, h * 0.22, -0.1, '#07101e');
    this.drawPalm(ctx, w * 0.985, horizon + 18, h * 0.19, 0.13, '#07101e');
    this.drawPalm(ctx, w * 0.065, horizon + 10, h * 0.13, 0.08, '#07131f');

    // foreground glow under the stadium
    const floorGlow = ctx.createLinearGradient(0, horizon - 4, 0, horizon + 80);
    floorGlow.addColorStop(0, 'rgba(255, 140, 82, 0.22)');
    floorGlow.addColorStop(1, 'rgba(255, 120, 70, 0)');
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0, horizon - 4, w, 84);
  }

  drawPalm(ctx, x, baseY, height, lean, color) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(lean);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, height * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(height * 0.1, -height * 0.45, height * 0.02, -height);
    ctx.stroke();
    const topX = height * 0.02;
    const topY = -height;
    for (let i = 0; i < 7; i += 1) {
      const angle = -Math.PI + (i / 6) * Math.PI + 0.22;
      const length = height * (0.35 + (i % 3) * 0.07);
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(angle) * length * 0.6,
        topY + Math.sin(angle) * length * 0.2 - 5,
        topX + Math.cos(angle) * length,
        topY + Math.sin(angle) * length * 0.55 + 10,
      );
      ctx.lineWidth = Math.max(1.2, height * 0.022);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ==================================================================
  // frame
  // ==================================================================

  render(game) {
    const ctx = this.ctx;
    const cam = this.setCameraProjection(game.cam);
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#040916';
    ctx.fillRect(0, 0, w, h);

    const shake = game.cam.shake * (this.reducedMotion ? 2 : 9);
    const shakeX = Math.sin(game.worldTime * 91) * shake;
    const shakeY = Math.cos(game.worldTime * 77) * shake * 0.6;
    const bob = game.cam.bob;

    ctx.save();
    ctx.translate(shakeX, shakeY + bob);

    this.drawBackdrop(ctx, game.cam);
    this.drawHaze(ctx, cam);
    this.drawTrack(ctx, cam, game);
    this.drawWorld(ctx, cam, game);
    this.drawParticles(ctx, cam, game);
    this.drawSpeedLines(ctx, game);
    ctx.restore();

    this.drawConfetti(ctx, game);
  }

  drawBackdrop(ctx, cam) {
    if (!this.backdrop) return;
    const offset = -cam.x * 7;
    ctx.drawImage(this.backdrop, offset, 0, this.width, this.height);
    if (offset > 0) {
      ctx.drawImage(this.backdrop, offset - this.width, 0, this.width, this.height);
    } else if (offset < 0) {
      ctx.drawImage(this.backdrop, offset + this.width, 0, this.width, this.height);
    }
  }

  drawHaze(ctx, cam) {
    const w = this.width;
    const horizon = this.horizon;
    const gradient = ctx.createLinearGradient(0, horizon - 22, 0, horizon + 52);
    gradient.addColorStop(0, 'rgba(255, 140, 88, 0.08)');
    gradient.addColorStop(0.5, 'rgba(255, 134, 82, 0.12)');
    gradient.addColorStop(1, 'rgba(255, 134, 82, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, horizon - 22, w, 76);
  }

  // ==================================================================
  // track
  // ==================================================================

  drawTrack(ctx, cam, game) {
    const near = cam.z + 1.1;
    const far = cam.z + 300;
    const edge = TRACK_EDGE;
    const samples = 54;

    const groundGradient = ctx.createLinearGradient(0, this.horizon, 0, this.height);
    groundGradient.addColorStop(0, '#9c3d32');
    groundGradient.addColorStop(0.34, '#b64a38');
    groundGradient.addColorStop(0.72, '#a64133');
    groundGradient.addColorStop(1, '#7e2e28');

    // mowing stripes on the grass outside the track
    this.drawGrassStripes(ctx, cam);

    // track body
    ctx.beginPath();
    const leftEdge = this.edgePoints(cam, -edge, near, far, samples);
    const rightEdge = this.edgePoints(cam, edge, near, far, samples);
    if (leftEdge.length && rightEdge.length) {
      ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
      for (let i = 1; i < leftEdge.length; i += 1) ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
      for (let i = rightEdge.length - 1; i >= 0; i -= 1) ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
      ctx.closePath();
      ctx.fillStyle = groundGradient;
      ctx.fill();

      // subtle center sheen
      ctx.save();
      ctx.clip();
      const sheen = ctx.createLinearGradient(0, this.horizon, 0, this.height);
      sheen.addColorStop(0, 'rgba(255, 187, 120, 0.1)');
      sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
      sheen.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, this.horizon, this.width, this.height - this.horizon);
      this.drawTrackBands(ctx, cam);
      ctx.restore();
    }

    this.drawTrackBoards(ctx, cam);
    this.drawLaneLines(ctx, cam, near, far);
    this.drawKerbs(ctx, cam);

    this.drawGroundMarks(ctx, cam, game);

    // start and finish surface markings
    this.drawCheckerBand(ctx, cam, 0.2, 0.9, 'rgba(247,243,232,0.82)', 'rgba(13,27,49,0.6)');
    this.drawCheckerBand(ctx, cam, RACE_LENGTH - 0.8, RACE_LENGTH + 0.8, '#f7f3e8', '#111d35');
    this.drawStartLine(ctx, cam);
  }

  edgePoints(cam, x, near, far, samples) {
    const points = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const z = near + (far - near) * t * t;
      const p = this.project(cam, x, 0, z);
      if (p) points.push(p);
    }
    return points;
  }

  drawGrassStripes(ctx, cam) {
    const w = this.width;
    const horizon = this.horizon;
    // broad mown bands outside the track
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i += 1) {
        const x1 = side * (5.2 + i * 2.4);
        const x2 = side * (5.2 + (i + 1) * 2.4);
        const near = cam.z + 2;
        const far = cam.z + 140;
        const a = this.project(cam, Math.min(x1, x2), 0, near);
        const b = this.project(cam, Math.max(x1, x2), 0, near);
        const c = this.project(cam, Math.max(x1, x2), 0, far);
        const d = this.project(cam, Math.min(x1, x2), 0, far);
        if (!a || !b || !c || !d) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.035)';
        ctx.fill();
      }
    }

    // ground falloff near horizon
    const haze = ctx.createLinearGradient(0, horizon, 0, horizon + 70);
    haze.addColorStop(0, 'rgba(255, 151, 93, 0.2)');
    haze.addColorStop(1, 'rgba(255, 151, 93, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon, w, 70);
  }

  drawTrackBands(ctx, cam) {
    const step = 4;
    const start = Math.floor((cam.z + 2) / step) * step;
    for (let z = start; z < cam.z + 160; z += step * 2) {
      const a = this.project(cam, -TRACK_EDGE, 0, z);
      const b = this.project(cam, TRACK_EDGE, 0, z);
      const c = this.project(cam, TRACK_EDGE, 0, z + step);
      const d = this.project(cam, -TRACK_EDGE, 0, z + step);
      if (!a || !b || !c || !d) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 236, 210, 0.026)';
      ctx.fill();
    }
  }

  drawLaneLines(ctx, cam, near, far) {
    const boundaries = [-2.44, -1.22, 0, 1.22, 2.44];
    for (const x of boundaries) {
      this.drawWorldLine(ctx, cam, x, 0.045, near, far, 'rgba(247, 243, 232, 0.9)');
    }
    // shoulder hints
    this.drawWorldLine(ctx, cam, -4.35, 0.035, near, far, 'rgba(247,243,232,0.22)');
    this.drawWorldLine(ctx, cam, 4.35, 0.035, near, far, 'rgba(247,243,232,0.22)');
  }

  drawWorldLine(ctx, cam, x, widthMeters, near, far, color) {
    const samples = 38;
    const left = [];
    const right = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const z = near + (far - near) * t * t;
      const a = this.project(cam, x - widthMeters / 2, 0, z);
      const b = this.project(cam, x + widthMeters / 2, 0, z);
      if (a && b) {
        left.push(a);
        right.push(b);
      }
    }
    if (left.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i += 1) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawKerbs(ctx, cam) {
    const startZ = Math.floor((cam.z + 4) / 1.2) * 1.2;
    for (let i = 0; i < 54; i += 1) {
      const z = startZ + i * 1.2;
      for (const side of [-1, 1]) {
        const x1 = side * TRACK_EDGE;
        const x2 = side * (TRACK_EDGE + 0.32);
        const a = this.project(cam, Math.min(x1, x2), 0, z);
        const b = this.project(cam, Math.max(x1, x2), 0, z);
        const c = this.project(cam, Math.max(x1, x2), 0, z + 1.2);
        const d = this.project(cam, Math.min(x1, x2), 0, z + 1.2);
        if (!a || !b || !c || !d) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#f4ead6' : '#db4e3b';
        ctx.globalAlpha = 0.88;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawTrackBoards(ctx, cam) {
    const start = Math.ceil((cam.z + 8) / 14) * 14;
    for (let z = start; z < cam.z + 125; z += 14) {
      for (const side of [-1, 1]) {
        const inner = 5.15 * side;
        const outer = 6.3 * side;
        const a = this.project(cam, inner, 0, z);
        const b = this.project(cam, inner, 0, z + 4.4);
        const c = this.project(cam, inner, 1.1, z + 4.4);
        const d = this.project(cam, inner, 1.1, z);
        if (!a || !b || !c || !d) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        const index = Math.floor(z / 14);
        ctx.fillStyle = ['rgba(15, 30, 55, 0.92)', 'rgba(20, 42, 66, 0.9)', 'rgba(30, 26, 54, 0.92)'][index % 3];
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // lit top rail
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(c.x, c.y);
        ctx.strokeStyle = index % 2 === 0 ? 'rgba(216,255,87,0.55)' : 'rgba(255,138,76,0.5)';
        ctx.lineWidth = Math.max(1, (this.focalBase * cam.zoom) / Math.max(1, z - cam.z) * 0.04);
        ctx.stroke();
      }
    }
  }

  drawGroundMarks(ctx, cam, game) {
    // lane numbers near the start
    for (let i = 0; i < LANES.length; i += 1) {
      this.drawGroundText(ctx, cam, String(i + 1), LANES[i], 7.6, 0.72, 'rgba(247,243,232,0.2)');
    }
    // distance markers along the left shoulder
    for (const d of [100, 200, 300]) {
      this.drawGroundText(ctx, cam, `${d}`, -4.0, d, 0.95, 'rgba(247,243,232,0.4)');
      this.drawGroundText(ctx, cam, 'M', -4.0, d + 2.6, 0.5, 'rgba(247,243,232,0.28)');
    }
  }

  drawGroundText(ctx, cam, text, x, z, size, color) {
    const p = this.project(cam, x, 0.01, z);
    if (!p || p.rel > 100 || p.s < 1) return;
    const fontPx = size * p.s;
    if (fontPx < 3) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, 0.4);
    ctx.font = `900 ${fontPx}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  drawStartLine(ctx, cam) {
    const a = this.project(cam, -TRACK_EDGE, 0, 0);
    const b = this.project(cam, TRACK_EDGE, 0, 0);
    if (!a || !b) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(247,243,232,0.7)';
    ctx.lineWidth = Math.max(1.5, (this.focalBase * cam.zoom) / Math.max(1, -cam.z) * 0.12);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  drawCheckerBand(ctx, cam, zStart, zEnd, colorA, colorB) {
    if (zEnd < cam.z + 0.8) return;
    if (zStart > cam.z + 220) return;
    const cells = 12;
    const rows = 2;
    const width = TRACK_EDGE * 2;
    const cellW = width / cells;
    const cellD = (zEnd - zStart) / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cells; col += 1) {
        const x1 = -TRACK_EDGE + col * cellW;
        const x2 = x1 + cellW;
        const z1 = zStart + row * cellD;
        const z2 = z1 + cellD;
        const a = this.project(cam, x1, 0, z1);
        const b = this.project(cam, x2, 0, z1);
        const c = this.project(cam, x2, 0, z2);
        const d = this.project(cam, x1, 0, z2);
        if (!a || !b || !c || !d) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = (row + col) % 2 === 0 ? colorA : colorB;
        ctx.fill();
      }
    }
  }

  // ==================================================================
  // world objects
  // ==================================================================

  drawWorld(ctx, cam, game) {
    const items = [];

    for (const obstacle of game.course.obstacles) {
      const rel = obstacle.d - cam.z;
      if (rel > 1.2 && rel < 180) {
        items.push({
          z: obstacle.d,
          draw: () => this.drawObstacle(ctx, cam, obstacle, game),
        });
      }
    }

    for (const orb of game.course.orbs) {
      if (orb.taken) continue;
      const rel = orb.d - cam.z;
      if (rel > 1.2 && rel < 150) {
        items.push({
          z: orb.d,
          draw: () => this.drawOrb(ctx, cam, orb, game),
        });
      }
    }

    const finishRel = RACE_LENGTH - cam.z;
    if (finishRel > 1.2 && finishRel < 230) {
      items.push({
        z: RACE_LENGTH,
        draw: () => this.drawFinishGate(ctx, cam, game),
      });
    }

    for (const rival of game.rivals) {
      const rel = rival.dist - cam.z;
      if (rel > 1.6 && rel < 160) {
        items.push({
          z: rival.dist,
          draw: () => this.drawRival(ctx, cam, rival, game),
        });
      }
    }

    const playerItem = {
      z: game.player.dist,
      draw: () => this.drawPlayer(ctx, cam, game),
    };
    items.push(playerItem);

    items.sort((a, b) => b.z - a.z);
    // Keep the player readable even when a rival is running level in the same lane.
    items.splice(items.indexOf(playerItem), 1);
    items.push(playerItem);
    for (const item of items) item.draw();
  }

  getRivalColor(rival, index) {
    return ['#ffc857', '#58e6ff', '#ff5d8f'][index] || rival.jersey;
  }

  drawRival(ctx, cam, rival, game) {
    const ground = this.project(cam, rival.x, 0, rival.dist);
    if (!ground || ground.rel < 2.4) return;
    const height = 1.78 * ground.s;
    if (height < 2) return;
    const jump = rival.jumpY;
    const yFeet = ground.y - jump * ground.s;
    const sliding = rival.slide > 0 ? 1 : 0;
    const index = game.rivals.indexOf(rival);
    const alpha = ground.rel < 4 ? clamp((ground.rel - 2.4) / 1.6, 0, 1) : 1;

    drawRunnerShadow(ctx, ground.x, ground.y + 1, Math.max(2, ground.s * 0.34), jump > 0 ? 0.18 : 0.3);

    drawRunner(ctx, ground.x, yFeet, height, {
      jersey: rival.jersey,
      accent: rival.accent,
      skin: rival.skin,
      hair: rival.hair,
      shorts: rival.shorts,
      shoe: rival.shoe,
      phase: rival.stride,
      lean: 0.08 + (rival.speed - 12) * 0.02,
      sliding,
      jumping: jump > 0.02 ? clamp(jump / 0.9, 0, 1) : 0,
      alpha,
      detail: height > 42,
      style: rival.style,
      bib: index + 2,
    });

    if (height > 34 && ground.rel < 52) {
      drawRunnerTag(
        ctx,
        ground.x,
        yFeet - height - 8,
        rival.name,
        this.getRivalColor(rival, index),
      );
    }
  }

  drawPlayer(ctx, cam, game) {
    const player = game.player;
    const ground = this.project(cam, player.x, 0, player.dist);
    if (!ground) return;
    const height = 1.78 * ground.s;
    const jump = player.jumpY;
    const yFeet = ground.y - jump * ground.s;
    const sliding = player.sliding > 0 ? 1 : 0;

    drawRunnerShadow(
      ctx,
      ground.x,
      ground.y + 1,
      Math.max(2, ground.s * 0.36),
      jump > 0 ? 0.16 : 0.34,
    );

    if (game.sprintVisual > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const auraRadius = ground.s * 0.72;
      const aura = ctx.createRadialGradient(ground.x, yFeet - height * 0.34, 0, ground.x, yFeet - height * 0.34, auraRadius);
      aura.addColorStop(0, `rgba(216,255,87,${0.14 * game.sprintVisual})`);
      aura.addColorStop(0.55, `rgba(160,255,90,${0.07 * game.sprintVisual})`);
      aura.addColorStop(1, 'rgba(160,255,90,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(ground.x - auraRadius, yFeet - height * 0.34 - auraRadius, auraRadius * 2, auraRadius * 2);
      ctx.restore();
    }

    drawRunner(ctx, ground.x, yFeet, height, {
      jersey: '#d8ff57',
      accent: '#6f9e08',
      skin: '#b9764d',
      hair: '#1a110c',
      shorts: '#102039',
      shoe: '#f7f1e3',
      phase: player.stride,
      lean: player.lean + (player.sprinting ? 0.08 : 0),
      sliding,
      jumping: jump > 0.02 ? clamp(jump / 0.9, 0, 1) : 0,
      alpha: 1,
      detail: true,
      isPlayer: true,
      style: 'short',
      bib: '1',
    });
  }

  drawObstacle(ctx, cam, obstacle, game) {
    const x = LANES[obstacle.lane];
    const ground = this.project(cam, x, 0, obstacle.d);
    if (!ground || ground.rel < 1.2) return;
    const scale = ground.s;
    if (scale < 0.6) return;
    const alpha = clamp((ground.rel - 1.2) / 2, 0.25, 1);

    if (obstacle.type === HAZARD.HURDLE) {
      this.drawHurdle(ctx, cam, x, obstacle.d, scale, obstacle.hit, alpha);
    } else if (obstacle.type === HAZARD.BARRIER) {
      this.drawBarrier(ctx, cam, x, obstacle.d, scale, obstacle.hit, alpha);
    } else {
      this.drawCone(ctx, cam, x, obstacle.d, scale, obstacle.hit, alpha);
    }
  }

  drawHurdle(ctx, cam, x, z, scale, hit, alpha) {
    const width = 1.25;
    const height = 0.82;
    const left = this.project(cam, x - width / 2, 0, z);
    const right = this.project(cam, x + width / 2, 0, z);
    const topLeft = this.project(cam, x - width / 2, height, z);
    const topRight = this.project(cam, x + width / 2, height, z);
    if (!left || !right || !topLeft || !topRight) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(hit ? 7 * scale * 0.1 : 0, 0);
    ctx.rotate(hit ? 0.2 : 0);

    ctx.fillStyle = 'rgba(4,8,16,0.35)';
    ctx.beginPath();
    ctx.ellipse((left.x + right.x) / 2, left.y + 2, Math.max(2, width * scale * 0.55), Math.max(1, width * scale * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();

    const legWidth = Math.max(1.4, scale * 0.06);
    ctx.strokeStyle = '#d8d3c6';
    ctx.lineWidth = legWidth;
    ctx.lineCap = 'round';
    const legInset = width * 0.28;
    for (const side of [-1, 1]) {
      const base = this.project(cam, x + side * width * 0.33, 0, z);
      const top = this.project(cam, x + side * width * 0.33, height - 0.12, z);
      if (base && top) {
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(base.x - scale * 0.12, base.y);
        ctx.lineTo(base.x + scale * 0.12, base.y);
        ctx.strokeStyle = '#0e1b30';
        ctx.lineWidth = Math.max(1, legWidth * 1.2);
        ctx.stroke();
        ctx.strokeStyle = '#d8d3c6';
        ctx.lineWidth = legWidth;
      }
    }

    const barHeight = Math.max(2, scale * 0.12);
    const segments = 7;
    for (let i = 0; i < segments; i += 1) {
      const x1 = left.x + ((right.x - left.x) * i) / segments;
      const x2 = left.x + ((right.x - left.x) * (i + 1)) / segments;
      const y1 = topLeft.y + ((topRight.y - topLeft.y) * i) / segments;
      const y2 = topLeft.y + ((topRight.y - topLeft.y) * (i + 1)) / segments;
      ctx.fillStyle = i % 2 === 0 ? '#f6f1e3' : '#ff6b4a';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, y2 + barHeight);
      ctx.lineTo(x1, y1 + barHeight);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(6,13,28,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ff8a4c';
    ctx.globalAlpha *= 0.9;
    ctx.font = `900 ${Math.max(3, scale * 0.15)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HURDLE', (left.x + right.x) / 2, topLeft.y - 3);
    ctx.restore();
  }

  drawBarrier(ctx, cam, x, z, scale, hit, alpha) {
    const width = 1.55;
    const postHeight = 2.02;
    const left = this.project(cam, x - width / 2, 0, z);
    const right = this.project(cam, x + width / 2, 0, z);
    const topLeft = this.project(cam, x - width / 2, postHeight, z);
    const topRight = this.project(cam, x + width / 2, postHeight, z);
    const barLeft = this.project(cam, x - width / 2, 1.52, z);
    const barRight = this.project(cam, x + width / 2, 1.52, z);
    if (!left || !right || !topLeft || !topRight || !barLeft || !barRight) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (hit) ctx.rotate(0.04);

    ctx.fillStyle = 'rgba(4,8,16,0.4)';
    ctx.beginPath();
    ctx.ellipse((left.x + right.x) / 2, left.y + 2, Math.max(2, width * scale * 0.55), Math.max(1, width * scale * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();

    const postW = Math.max(1.6, scale * 0.075);
    ctx.strokeStyle = '#15243d';
    ctx.lineWidth = postW;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const base = this.project(cam, x + side * width * 0.45, 0, z);
      const top = this.project(cam, x + side * width * 0.45, 2.0, z);
      if (base && top) {
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
      }
    }

    const barTop = topLeft.y;
    const barBottom = barLeft.y;
    const segments = 8;
    for (let i = 0; i < segments; i += 1) {
      const x1 = barLeft.x + ((barRight.x - barLeft.x) * i) / segments;
      const x2 = barLeft.x + ((barRight.x - barLeft.x) * (i + 1)) / segments;
      ctx.fillStyle = i % 2 === 0 ? '#ff8a4c' : '#f6f1e3';
      ctx.fillRect(x1, barTop + 1, x2 - x1 + 0.6, Math.max(2, barBottom - barTop));
    }
    ctx.strokeStyle = 'rgba(6,13,28,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barLeft.x, barTop, barRight.x - barLeft.x, barBottom - barTop);

    // down chevrons
    ctx.strokeStyle = '#071226';
    ctx.lineWidth = Math.max(1, scale * 0.04);
    ctx.lineCap = 'round';
    const centerX = (barLeft.x + barRight.x) / 2;
    const centerY = barTop + (barBottom - barTop) * 0.5;
    const chevron = Math.max(2, scale * 0.12);
    ctx.beginPath();
    ctx.moveTo(centerX - chevron, centerY - chevron * 0.8);
    ctx.lineTo(centerX, centerY);
    ctx.lineTo(centerX + chevron, centerY - chevron * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - chevron, centerY + chevron * 0.1);
    ctx.lineTo(centerX, centerY + chevron * 0.9);
    ctx.lineTo(centerX + chevron, centerY + chevron * 0.1);
    ctx.stroke();

    ctx.restore();
  }

  drawCone(ctx, cam, x, z, scale, hit, alpha) {
    const base = this.project(cam, x, 0, z);
    const tip = this.project(cam, x, 0.64, z);
    if (!base || !tip) return;
    const half = 0.3 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (hit) ctx.rotate(0.25);
    ctx.fillStyle = 'rgba(4,8,16,0.3)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y + 1, half * 1.15, Math.max(1, half * 0.23), 0, 0, Math.PI * 2);
    ctx.fill();

    const gradient = ctx.createLinearGradient(base.x - half, 0, base.x + half, 0);
    gradient.addColorStop(0, '#ff6a35');
    gradient.addColorStop(0.48, '#ff9d4c');
    gradient.addColorStop(1, '#d94d23');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(base.x - half, base.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(base.x + half, base.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(7,18,38,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const bandY = base.y + (tip.y - base.y) * 0.48;
    const bandHalf = half * 0.46;
    ctx.fillStyle = 'rgba(247,243,232,0.9)';
    ctx.beginPath();
    ctx.moveTo(base.x - bandHalf, bandY + 1.5);
    ctx.lineTo(base.x + bandHalf, bandY + 1.5);
    ctx.lineTo(base.x + bandHalf * 0.72, bandY - Math.max(1, half * 0.16));
    ctx.lineTo(base.x - bandHalf * 0.72, bandY - Math.max(1, half * 0.16));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f6f1e3';
    ctx.beginPath();
    ctx.roundRect(base.x - half * 0.8, base.y - 1, half * 1.6, Math.max(1.2, scale * 0.055), 1);
    ctx.fill();
    ctx.restore();
  }

  drawOrb(ctx, cam, orb, game) {
    const bob = Math.sin(game.worldTime * 3.4 + orb.phase) * 0.09;
    const center = this.project(cam, LANES[orb.lane], orb.y + bob, orb.d);
    if (!center) return;
    const radius = Math.max(1.5, 0.17 * center.s);
    if (center.s < 1) return;
    const pulse = 0.82 + Math.sin(game.worldTime * 5 + orb.phase) * 0.18;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 4.6);
    glow.addColorStop(0, `rgba(255, 239, 140, ${0.5 * pulse})`);
    glow.addColorStop(0.28, `rgba(216, 255, 87, ${0.22 * pulse})`);
    glow.addColorStop(1, 'rgba(216, 255, 87, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(center.x - radius * 5, center.y - radius * 5, radius * 10, radius * 10);

    ctx.strokeStyle = `rgba(216,255,87,${0.55 * pulse})`;
    ctx.lineWidth = Math.max(1, radius * 0.17);
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * (1.65 + Math.sin(game.worldTime * 2.6 + orb.phase) * 0.14), 0, Math.PI * 2);
    ctx.stroke();

    const core = ctx.createRadialGradient(center.x - radius * 0.25, center.y - radius * 0.3, 0, center.x, center.y, radius);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.42, '#f2ffc0');
    core.addColorStop(1, '#b7e82f');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(0.8, radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(center.x - radius * 1.5, center.y);
    ctx.lineTo(center.x + radius * 1.5, center.y);
    ctx.moveTo(center.x, center.y - radius * 1.5);
    ctx.lineTo(center.x, center.y + radius * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  // ==================================================================
  // finish gate
  // ==================================================================

  drawFinishGate(ctx, cam, game) {
    const z = RACE_LENGTH;
    const halfW = 5.15;
    const postH = 5.0;
    const bannerBottom = 4.05;
    const bannerTop = 5.15;
    const leftBase = this.project(cam, -halfW, 0, z);
    const rightBase = this.project(cam, halfW, 0, z);
    const leftTop = this.project(cam, -halfW, postH, z);
    const rightTop = this.project(cam, halfW, postH, z);
    const bannerL = this.project(cam, -halfW, bannerBottom, z);
    const bannerR = this.project(cam, halfW, bannerBottom, z);
    const bannerLT = this.project(cam, -halfW, bannerTop, z);
    const bannerRT = this.project(cam, halfW, bannerTop, z);
    if (!leftBase || !rightBase || !leftTop || !rightTop || !bannerL || !bannerLT) return;

    const scale = leftBase.s;
    ctx.save();

    // posts
    ctx.strokeStyle = '#0c172c';
    ctx.lineWidth = Math.max(2, scale * 0.16);
    ctx.lineCap = 'round';
    for (const [base, top] of [[leftBase, leftTop], [rightBase, rightTop]]) {
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(216,255,87,0.55)';
    ctx.lineWidth = Math.max(1, scale * 0.035);
    for (const [base, top] of [[leftBase, leftTop], [rightBase, rightTop]]) {
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }

    // banner
    ctx.beginPath();
    ctx.moveTo(bannerL.x, bannerL.y);
    ctx.lineTo(bannerR.x, bannerR.y);
    ctx.lineTo(bannerRT.x, bannerRT.y);
    ctx.lineTo(bannerLT.x, bannerLT.y);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, bannerLT.y, 0, bannerL.y);
    gradient.addColorStop(0, '#e8ff7e');
    gradient.addColorStop(1, '#b1e736');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6,13,28,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // checkered strip on banner
    const cells = 14;
    const topStrip = Math.max(1, (bannerL.y - bannerLT.y) * 0.12);
    for (let i = 0; i < cells; i += 1) {
      if (i % 2 !== 0) continue;
      const t1 = i / cells;
      const t2 = (i + 1) / cells;
      const x1 = bannerL.x + (bannerR.x - bannerL.x) * t1;
      const x2 = bannerL.x + (bannerR.x - bannerL.x) * t2;
      ctx.fillStyle = '#071226';
      ctx.fillRect(x1, bannerLT.y, x2 - x1, topStrip);
      ctx.fillRect(x1, bannerL.y - topStrip, x2 - x1, topStrip);
    }

    // text
    const fontSize = clamp((bannerL.y - bannerLT.y) * 0.66, 4, 200);
    if (fontSize > 5) {
      ctx.fillStyle = '#071226';
      ctx.font = `900 ${fontSize}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FINISH', (bannerL.x + bannerR.x) / 2, (bannerLT.y + bannerL.y) / 2 + fontSize * 0.04);
    }

    // banner lights
    if (scale > 12) {
      for (let i = 1; i < cells; i += 1) {
        const t = i / cells;
        const x = bannerL.x + (bannerR.x - bannerL.x) * t;
        ctx.fillStyle = 'rgba(255,247,205,0.9)';
        ctx.beginPath();
        ctx.arc(x, bannerLT.y + 2, Math.max(0.6, scale * 0.022), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ==================================================================
  // particles and overlays
  // ==================================================================

  drawParticles(ctx, cam, game) {
    for (const particle of game.effects.particles) {
      const p = this.project(cam, particle.x, particle.y, particle.z);
      if (!p || p.rel < 1.2) continue;
      const alpha = clamp(particle.life / particle.max, 0, 1);
      const size = Math.max(0.56, particle.size * p.s);
      ctx.save();
      ctx.globalAlpha = alpha * (particle.kind === 'dust' ? 0.34 : 0.9);
      if (particle.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.22;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawSpeedLines(ctx, game) {
    const strength = game.sprintVisual;
    if (strength < 0.04) return;
    const w = this.width;
    const h = this.height;
    const time = game.worldTime;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 16; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const y = h * 0.24 + ((time * 780 + i * 137) % (h * 0.62));
      const distanceFromCenter = w * (0.27 + ((i * 37) % 20) / 100);
      const x = w / 2 + side * distanceFromCenter;
      const length = 30 + ((i * 29) % 120) * strength;
      const gradient = ctx.createLinearGradient(x, y, x - side * length, y);
      gradient.addColorStop(0, `rgba(216,255,87,${0.28 * strength})`);
      gradient.addColorStop(1, 'rgba(216,255,87,0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1 + (i % 3) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - side * length, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawConfetti(ctx, game) {
    if (!game.effects.confetti.length) return;
    ctx.save();
    for (const piece of game.effects.confetti) {
      const alpha = clamp(piece.life / Math.min(1, piece.max), 0, 1);
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      ctx.restore();
    }
    ctx.restore();
  }
}
