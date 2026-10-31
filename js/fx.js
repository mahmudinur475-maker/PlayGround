/* =========================================================
   UPGRADE CLICKER — audio + particle systems
   ©2026 Nur Mahmudi
   ========================================================= */
(() => {
  'use strict';

  const UC = window.UC = window.UC || {};

  const Audio = (() => {
    let ctx = null;
    let unlocked = false;

    function ensure() {
      if (!window.AudioContext && !window.webkitAudioContext) return null;
      if (!ctx) {
        try {
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          ctx = new AudioCtor();
        } catch (error) {
          return null;
        }
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      unlocked = true;
      return ctx;
    }

    function tone({ freq, endFreq, dur = 0.1, type = 'sine', volume = 0.035, delay = 0 }) {
      const audio = ensure();
      if (!audio || !unlocked) return;
      const start = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, freq), start);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), start + dur);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    }

    return {
      ensure,
      click(crit = false) {
        if (crit) {
          tone({ freq: 760, endFreq: 240, dur: 0.16, type: 'triangle', volume: 0.05 });
          tone({ freq: 1240, endFreq: 620, dur: 0.1, type: 'sine', volume: 0.03, delay: 0.015 });
        } else {
          tone({ freq: 390 + Math.random() * 90, endFreq: 180, dur: 0.07, type: 'triangle', volume: 0.028 });
        }
      },
      buy() {
        tone({ freq: 520, endFreq: 700, dur: 0.08, type: 'sine', volume: 0.03 });
        tone({ freq: 780, endFreq: 980, dur: 0.09, type: 'sine', volume: 0.022, delay: 0.055 });
      },
      level() {
        [523, 659, 784, 1046].forEach((freq, i) => {
          tone({ freq, dur: 0.17, type: 'sine', volume: 0.028, delay: i * 0.07 });
        });
      },
      achievement() {
        [880, 1108, 1318].forEach((freq, i) => {
          tone({ freq, dur: 0.2, type: 'triangle', volume: 0.024, delay: i * 0.075 });
        });
      },
      evolve() {
        tone({ freq: 120, endFreq: 1600, dur: 1.05, type: 'sawtooth', volume: 0.025 });
        [392, 523, 659, 784, 1046].forEach((freq, i) => {
          tone({ freq, dur: 0.4, type: 'sine', volume: 0.022, delay: 0.35 + i * 0.11 });
        });
      },
      rebirth() {
        tone({ freq: 220, endFreq: 44, dur: 1.2, type: 'sine', volume: 0.055 });
        [440, 554, 659, 880].forEach((freq, i) => {
          tone({ freq, dur: 0.35, type: 'triangle', volume: 0.02, delay: 0.2 + i * 0.12 });
        });
      },
      drop() {
        tone({ freq: 640, endFreq: 1160, dur: 0.12, type: 'sine', volume: 0.035 });
        tone({ freq: 960, endFreq: 1440, dur: 0.16, type: 'sine', volume: 0.02, delay: 0.07 });
      },
      error() {
        tone({ freq: 150, endFreq: 90, dur: 0.14, type: 'square', volume: 0.018 });
      }
    };
  })();

  const FX = (() => {
    let canvas = null;
    let ctx = null;
    let dpr = 1;
    let width = 0;
    let height = 0;
    let stars = [];
    let particles = [];
    let accent = '#61f3ff';
    let running = false;
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      if (!canvas) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
    }

    function buildStars() {
      const count = Math.max(46, Math.min(130, Math.floor((width * height) / 15000)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.3 + 0.25,
        alpha: Math.random() * 0.48 + 0.08,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 2.8 + 0.4,
        drift: Math.random() * 0.08 - 0.04
      }));
    }

    function start() {
      canvas = document.getElementById('fxCanvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      if (!ctx) return;
      resize();
      window.addEventListener('resize', resize, { passive: true });
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    }

    function setAccent(color) {
      if (color) accent = color;
    }

    function spawnBurst(x, y, count = 12, crit = false) {
      if (!ctx) return;
      if (reducedMotion) count = Math.min(4, count);
      const palette = crit
        ? ['#ffd36a', '#fff3b0', '#ff9d52', '#ffffff']
        : [accent, '#ffffff', accent, '#8b7dff'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (crit ? 210 : 150) + 30;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          life: 0,
          maxLife: Math.random() * 0.55 + 0.35,
          size: Math.random() * (crit ? 3.2 : 2.2) + 0.7,
          color: palette[Math.floor(Math.random() * palette.length)]
        });
      }
      if (particles.length > 280) particles.splice(0, particles.length - 280);
    }

    function drawStars(time) {
      for (const star of stars) {
        const twinkle = 0.55 + Math.sin(time * 0.0012 + star.phase) * 0.4;
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.fillStyle = star.size > 1.05 ? accent : '#d7edff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        star.y += star.speed * 0.016;
        star.x += star.drift * 0.016;
        if (star.y > height + 2) {
          star.y = -2;
          star.x = Math.random() * width;
        }
        if (star.x < -2) star.x = width + 2;
        if (star.x > width + 2) star.x = -2;
      }
      ctx.globalAlpha = 1;
    }

    let last = 0;
    function frame(time) {
      if (!ctx) return;
      const dt = Math.min(0.05, (time - last) / 1000 || 0.016);
      last = time;
      ctx.clearRect(0, 0, width, height);
      drawStars(time);

      if (particles.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life += dt;
          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
            continue;
          }
          const progress = p.life / p.maxLife;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.965;
          p.vy = p.vy * 0.965 + 28 * dt;
          ctx.globalAlpha = (1 - progress) * 0.9;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - progress * 0.55), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      requestAnimationFrame(frame);
    }

    return { start, spawnBurst, setAccent, resize };
  })();

  UC.Audio = Audio;
  UC.FX = FX;
})();
