/* =========================================================
   UPGRADE CLICKER — app controller
   ©2026 Nur Mahmudi
   ========================================================= */
(() => {
  'use strict';

  const UC = window.UC;
  const E = UC.Engine;
  const UI = UC.UI;
  const state = E.state;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  let lastTick = performance.now();
  let uiTimer = 0;
  let achievementTimer = 0;
  let saveTimer = 0;
  let dropTimer = nextDropDelay();
  let activeDrop = null;
  let stageTap = null;
  let hiddenAt = 0;
  let bootHidden = false;
  let tiltAttached = false;
  let tiltBusy = false;
  let lastTiltUI = 0;
  let lastAchievementSound = 0;
  let userGesture = false;

  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

  function haptic(pattern) {
    if (!state.settings.haptics) return;
    if (!userGesture && !(navigator.userActivation && navigator.userActivation.hasBeenActive)) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (error) { /* noop */ }
    }
  }

  function nextDropDelay() {
    const fortune = 1 + state.specials.fortune * 0.08;
    return Math.max(8, (18 + Math.random() * 18) / fortune);
  }

  function hideBoot() {
    if (bootHidden) return;
    bootHidden = true;
    const boot = $('#boot');
    if (!boot) return;
    boot.classList.add('is-hidden');
    setTimeout(() => boot.remove(), 520);
  }

  function setModalState() {
    document.body.classList.toggle('is-modal-open', Boolean(document.querySelector('dialog[open]')));
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    setModalState();
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) return;
    dialog.close();
    setModalState();
  }

  function toggleSound() {
    state.settings.sound = !state.settings.sound;
    UI.updateSoundUI();
    if (state.settings.sound) {
      UC.Audio.ensure();
      E.sound('click');
    }
    E.save();
  }

  function toggleHaptics() {
    state.settings.haptics = !state.settings.haptics;
    if (state.settings.haptics) haptic(16);
    UI.updateSoundUI();
    E.save();
  }

  function attachTilt() {
    if (!tiltAttached) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      tiltAttached = true;
    }
    E.tilt.enabled = true;
  }

  function detachTilt() {
    if (tiltAttached) {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      tiltAttached = false;
    }
    E.tilt.enabled = false;
    E.tilt.active = false;
    E.tilt.alignment = 1;
    UI.refs.reactorStage.style.setProperty('--tilt-x', '0px');
    UI.refs.reactorStage.style.setProperty('--tilt-y', '0px');
  }

  async function enableTilt() {
    if (tiltBusy) return;
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      UI.toast('MOTION TIDAK TERSEDIA', 'Perangkat ini tidak memiliki sensor gerak.', 'energy', '◉', 3200);
      return;
    }
    tiltBusy = true;
    try {
      if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await window.DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          state.settings.tilt = false;
          UI.updateTiltUI();
          UI.updateSoundUI();
          UI.toast('IZIN DITOLAK', 'Tilt reactor membutuhkan izin motion.', 'energy', '◉', 3200);
          E.save();
          return;
        }
      }
      state.settings.tilt = true;
      attachTilt();
      UI.updateTiltUI();
      UI.updateSoundUI();
      E.save();
      UI.toast('TILT REACTOR AKTIF', 'Miringkan perangkat untuk bonus click hingga +20%.', 'energy', '◉', 3400);
      setTimeout(() => {
        if (state.settings.tilt && !E.tilt.active) {
          UI.updateTiltUI();
          UI.toast('MENUNGGU SENSOR', 'Pegang perangkat dan coba miringkan perlahan.', 'energy', '◉', 3000);
        }
      }, 2200);
    } catch (error) {
      state.settings.tilt = false;
      UI.updateTiltUI();
      UI.updateSoundUI();
      UI.toast('MOTION GAGAL', 'Izin motion tidak dapat diproses. Pastikan halaman dibuka via HTTPS.', 'energy', '◉', 3600);
      E.save();
    } finally {
      tiltBusy = false;
    }
  }

  function disableTilt() {
    state.settings.tilt = false;
    detachTilt();
    UI.updateTiltUI();
    UI.updateSoundUI();
    E.save();
  }

  function toggleTilt() {
    if (state.settings.tilt) disableTilt();
    else enableTilt();
  }

  function initTiltFromSave() {
    if (!state.settings.tilt) return;
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      state.settings.tilt = false;
      return;
    }
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      // iOS requires a fresh user gesture every session.
      state.settings.tilt = false;
      return;
    }
    attachTilt();
  }

  function handleOrientation(event) {
    if (!state.settings.tilt) return;
    if (event.gamma === null && event.beta === null) return;
    const gamma = Number(event.gamma) || 0;
    const beta = Number(event.beta) || 0;
    E.tilt.active = true;
    E.tilt.gamma = gamma;
    E.tilt.beta = beta;
    E.tilt.alignment = Math.max(0, Math.min(1, 1 - Math.abs(gamma) / 45));

    const x = Math.max(-14, Math.min(14, gamma * 0.2));
    const y = Math.max(-10, Math.min(10, (beta - 45) * 0.1));
    UI.refs.reactorStage.style.setProperty('--tilt-x', `${x.toFixed(1)}px`);
    UI.refs.reactorStage.style.setProperty('--tilt-y', `${y.toFixed(1)}px`);

    const now = performance.now();
    if (now - lastTiltUI > 140) {
      lastTiltUI = now;
      UI.updateTiltUI();
    }
  }

  function performClick(clientX, clientY) {
    const result = E.click();
    const rect = UI.refs.reactorStage.getBoundingClientRect();
    const fallbackX = rect.left + rect.width / 2;
    const fallbackY = rect.top + rect.height * 0.48;
    const x = typeof clientX === 'number' ? clientX : fallbackX;
    const y = typeof clientY === 'number' ? clientY : fallbackY;

    UI.pulseCore(result.crit);
    UI.floatNumber(result.amount, x - rect.left, y - rect.top, result.crit);
    UC.FX.spawnBurst(x, y, result.crit ? 18 : 9, result.crit);
    E.sound('click', result.crit);
    haptic(result.crit ? [10, 24, 12] : 7);

    state.tutorialSeen = true;
    UI.refs.tapHint.classList.add('is-hidden');
    UI.update();
    E.checkAchievements();
  }

  function spawnDrop() {
    if (activeDrop || document.hidden || !UI.refs.dropLayer) return;
    if (isMobile() && UI.refs.app.dataset.mobileView !== 'core') {
      dropTimer = 2;
      return;
    }
    const fortune = 1 + state.specials.fortune * 0.08;
    const roll = Math.random();
    let type = 'gold';
    if (state.rebirths > 0 && Math.random() < 0.018) type = 'infinity';
    else if (roll < 0.12 * fortune) type = 'diamond';
    else if (roll < 0.25 * fortune) type = 'crystal';
    else if (roll < 0.38) type = 'energy';
    else type = 'gold';

    const element = document.createElement('button');
    element.type = 'button';
    element.className = `supply-drop is-${type}`;
    element.style.left = `${18 + Math.random() * 64}%`;
    element.style.top = `${20 + Math.random() * 58}%`;
    element.innerHTML = UC.ICONS[type] || UC.ICONS.gold;
    element.setAttribute('aria-label', `Ambil supply drop ${type}`);
    element.addEventListener('click', event => {
      event.stopPropagation();
      collectDrop(type, element);
    });
    UI.refs.dropLayer.append(element);
    activeDrop = { element, type, expires: performance.now() + 12000 };
    dropTimer = nextDropDelay();
  }

  function expireDrop() {
    if (!activeDrop) return;
    const { element } = activeDrop;
    activeDrop = null;
    element.classList.add('is-leaving');
    setTimeout(() => element.remove(), 320);
  }

  function collectDrop(type, element) {
    if (!activeDrop) return;
    const rect = element.getBoundingClientRect();
    const stageRect = UI.refs.reactorStage.getBoundingClientRect();
    let amount = 0;
    let label = '';
    let toastType = type;
    let icon = '⬡';

    if (type === 'gold') {
      amount = 10 + state.level * 4 + Math.floor(state.level * state.level * 0.3);
      state.gold += amount;
      state.stats.totalGold += amount;
      label = `+${E.format(amount)} GOLD`;
      icon = '⬡';
      toastType = 'gold';
    } else if (type === 'diamond') {
      amount = 1 + Math.floor(state.level / 25) + Math.floor(state.specials.fortune / 4);
      state.diamonds += amount;
      state.stats.totalDiamonds += amount;
      label = `+${E.format(amount)} DIAMOND`;
      icon = '◆';
      toastType = 'diamond';
    } else if (type === 'crystal') {
      amount = 2 + Math.floor(state.level / 10);
      state.crystals += amount;
      state.stats.totalCrystals += amount;
      label = `+${E.format(amount)} CRYSTAL`;
      icon = '✧';
      toastType = 'crystal';
    } else if (type === 'infinity') {
      amount = 1;
      state.infinity += amount;
      state.stats.totalInfinity += amount;
      label = '+1 INFINITY';
      icon = '∞';
      toastType = 'infinity';
    } else {
      amount = Math.max(50, E.clickPower() * 20, E.autoRate() * 18);
      E.gainEnergy(amount, 'drop', false);
      label = `+${E.format(amount)} ENERGY`;
      icon = '⚡';
      toastType = 'energy';
    }

    state.stats.drops += 1;
    UI.floatNumber(amount, rect.left - stageRect.left + rect.width / 2, rect.top - stageRect.top, true);
    UC.FX.spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 18, type !== 'energy');
    E.sound('drop');
    haptic([8, 18, 8]);
    UI.toast('SUPPLY SECURED', label, toastType, icon, 2600);

    element.classList.add('is-leaving');
    activeDrop = null;
    setTimeout(() => element.remove(), 320);
    dropTimer = nextDropDelay();
    E.checkAchievements();
    UI.update();
    UI.updateAchievements();
    E.save();
  }

  function bindEvents() {
    document.addEventListener('pointerdown', () => {
      userGesture = true;
      UC.Audio.ensure();
    }, { once: true });
    document.addEventListener('keydown', () => { userGesture = true; }, { once: true });

    UI.refs.coreButton.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      performClick(event.clientX, event.clientY);
    });

    UI.refs.coreButton.addEventListener('click', event => {
      if (event.detail !== 0) return;
      event.preventDefault();
      performClick();
    });

    UI.refs.reactorStage.addEventListener('pointerdown', event => {
      if (event.target.closest('button, .supply-drop')) return;
      stageTap = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });

    UI.refs.reactorStage.addEventListener('pointerup', event => {
      if (!stageTap || stageTap.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - stageTap.x, event.clientY - stageTap.y);
      stageTap = null;
      if (distance < 14) performClick(event.clientX, event.clientY);
    });

    UI.refs.reactorStage.addEventListener('pointercancel', () => { stageTap = null; });
    UI.refs.reactorStage.addEventListener('contextmenu', event => {
      if (event.target.closest('.reactor-core')) event.preventDefault();
    });

    UI.refs.deckScroll.addEventListener('click', event => {
      const buy = event.target.closest('.buy-btn');
      if (!buy) return;
      const result = E.buyUpgrade(buy.dataset.buyKind, buy.dataset.buyId, state.buyMode);
      if (result.ok) {
        E.checkAchievements();
        UI.update();
        E.save();
      } else {
        E.sound('error');
        UI.toast('BELUM BISA', result.reason || 'Coba lagi.', 'energy', 'ⓘ', 2200);
      }
    });

    $$('.deck-tabs button').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        if (isMobile()) UI.setMobileView(tab);
        else UI.setTab(tab);
        if (tab === 'awards') UI.updateAchievements();
      });
    });

    $$('[data-mobile-tab]').forEach(button => {
      button.addEventListener('click', () => {
        UI.setMobileView(button.dataset.mobileTab);
        if (button.dataset.mobileTab === 'awards') UI.updateAchievements();
      });
    });

    UI.refs.buyMode.addEventListener('click', event => {
      const button = event.target.closest('[data-buy-mode]');
      if (!button) return;
      UI.setBuyMode(button.dataset.buyMode);
      E.save();
    });

    $$('[data-award-filter]').forEach(button => {
      button.addEventListener('click', () => UI.setFilter(button.dataset.awardFilter));
    });

    $('#settingsBtn').addEventListener('click', () => openDialog('settingsDialog'));
    $('#soundBtn').addEventListener('click', toggleSound);
    $('#settingsSound').addEventListener('click', toggleSound);
    $('#settingsHaptics').addEventListener('click', toggleHaptics);
    $('#settingsTilt').addEventListener('click', toggleTilt);
    $('#motionPermissionBtn').addEventListener('click', toggleTilt);

    $('#resetBtn').addEventListener('click', () => {
      const confirmed = window.confirm('Reset semua progres UPGRADE CLICKER? Achievement dan Infinity juga akan hilang.');
      if (!confirmed) return;
      E.resetSave();
      window.location.reload();
    });

    UI.refs.evolveButton.addEventListener('click', () => {
      const result = E.evolve();
      if (!result.ok) {
        E.sound('error');
        const info = result.info;
        UI.toast('EVOLUSI TERKUNCI', `Butuh Level ${info.reqLevel} dan ${E.format(info.cost)} Crystal.`, 'crystal', '✧', 3000);
      }
    });

    UI.refs.rebirthButton.addEventListener('click', () => {
      if (E.rebirthReward() <= 0) {
        E.sound('error');
        UI.toast('REBIRTH TERKUNCI', 'Capai Level 20 terlebih dahulu.', 'infinity', '∞', 2800);
        return;
      }
      UI.updateRebirth();
      openDialog('rebirthDialog');
    });

    $('#confirmRebirthBtn').addEventListener('click', () => {
      closeDialog($('#rebirthDialog'));
      const result = E.rebirth();
      if (!result.ok) E.sound('error');
    });

    $('#brandHome').addEventListener('click', event => {
      event.preventDefault();
      UI.setMobileView('core');
    });

    $$('[data-close]').forEach(button => {
      button.addEventListener('click', () => closeDialog(document.getElementById(button.dataset.close)));
    });

    $$('dialog').forEach(dialog => {
      dialog.addEventListener('close', setModalState);
      dialog.addEventListener('click', event => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        E.save();
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt ? (Date.now() - hiddenAt) / 1000 : 0;
      hiddenAt = 0;
      lastTick = performance.now();
      if (away > 10 && E.autoRate() > 0) {
        const gain = E.autoRate() * Math.min(UC.MAX_OFFLINE_SECONDS, away) * E.offlineEfficiency();
        if (gain >= 1) {
          E.gainEnergy(gain, 'idle', true);
          E.checkAchievements();
          UI.update();
          UI.updateAchievements();
          UI.toast('IDLE CATCH-UP', `+${E.format(gain)} energy selama ${E.formatDuration(away)}.`, 'energy', '⚡', 3000);
          E.save();
        }
      }
    });

    window.addEventListener('beforeunload', () => E.save());
    window.addEventListener('pagehide', () => E.save());

    document.addEventListener('uc:save', event => UI.setSaveStatus(event.detail.time));

    document.addEventListener('uc:levelup', event => {
      const detail = event.detail;
      if (detail.silent) return;
      const extra = detail.diamonds ? ` · +${detail.diamonds} ◆` : '';
      UI.toast(`LEVEL ${detail.level}`, `+${detail.gold} Gold · +${detail.crystals} Crystal${extra}`, 'crystal', '▲', 2800);
      E.sound('level');
      haptic([14, 28, 14]);
      if (detail.level === 10) {
        UI.toast('EVOLUTION READY', 'Buka tab Evolve dan gunakan Crystal.', 'crystal', '✧', 3800);
      } else if (detail.level === 20) {
        UI.toast('REBIRTH UNLOCKED', 'Singularity Protocol tersedia di Level 20.', 'infinity', '∞', 4000);
      } else if (detail.level === 100) {
        UI.toast('ULTIMATE LEVEL', 'Kamu mencapai Level 100. Infinity +10.', 'infinity', '∞', 5200);
      }
    });

    document.addEventListener('uc:achievement', event => {
      const def = event.detail.def;
      const reward = def.reward.diamonds ? `+${def.reward.diamonds} ◆` : '';
      UI.toast('ACHIEVEMENT UNLOCKED', `${def.name} · ${reward}`, 'diamond', '◈', 3200);
      const now = performance.now();
      if (now - lastAchievementSound > 450) {
        lastAchievementSound = now;
        E.sound('achievement');
      }
      haptic(12);
    });

    document.addEventListener('uc:allachievements', () => {
      UI.toast('100 / 100 AWARDS', 'Semua achievement terbuka. Bonus Infinity +10.', 'infinity', '∞', 5200);
      E.sound('achievement');
      E.save();
    });

    document.addEventListener('uc:upgrade', () => {
      E.sound('buy');
      haptic(9);
    });

    document.addEventListener('uc:evolve', event => {
      const stage = event.detail.stage;
      UI.evolveFlash(stage);
      E.sound('evolve');
      haptic([18, 40, 18, 40, 25]);
      UI.toast(`EVOLUTION ${event.detail.index + 1} / 10`, `${stage.title} unlocked · core ×${E.format(E.stageMult())}.`, 'crystal', '✧', 4200);
      E.checkAchievements();
      UI.update();
      UI.updateAchievements();
      E.save();
    });

    document.addEventListener('uc:rebirth', event => {
      const reward = event.detail.reward;
      if (activeDrop) {
        activeDrop.element.remove();
        activeDrop = null;
      }
      dropTimer = nextDropDelay();
      E.sound('rebirth');
      haptic([30, 50, 30, 50, 40]);
      UI.toast('SINGULARITY REBIRTH', `+${E.format(reward)} Infinity. Siklus baru dimulai.`, 'infinity', '∞', 5000);
      UI.setMobileView('core');
      E.checkAchievements();
      UI.update();
      UI.updateAchievements();
      E.save();
    });
  }

  function initOfflineReport() {
    const report = E.applyOffline();
    if (!report) return;
    E.save();
    E.checkAchievements();
    UI.update();
    UI.updateAchievements();
    const time = document.getElementById('offlineTime');
    const efficiency = document.getElementById('offlineEfficiency');
    const energy = document.getElementById('offlineEnergy');
    if (time) time.textContent = E.formatDuration(report.elapsed);
    if (efficiency) efficiency.textContent = `${Math.round(report.efficiency * 100)}%`;
    if (energy) energy.textContent = `+${E.format(report.gain)}`;
    setTimeout(() => openDialog('offlineDialog'), 1200);
  }

  function loop(now) {
    const dt = Math.min(2, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;

    if (!document.hidden) {
      const rate = E.autoRate();
      if (rate > 0) E.gainEnergy(rate * dt, 'auto', false);
      E.tickCombo(dt);
      state.stats.playSeconds += dt;

      dropTimer -= dt;
      if (dropTimer <= 0) spawnDrop();
      if (activeDrop && now > activeDrop.expires) expireDrop();

      uiTimer += dt;
      if (uiTimer >= 0.12) {
        uiTimer = 0;
        UI.update();
      }

      achievementTimer += dt;
      if (achievementTimer >= 0.8) {
        achievementTimer = 0;
        const unlocked = E.checkAchievements();
        if (unlocked.length) UI.updateAchievements();
      }

      saveTimer += dt;
      if (saveTimer >= UC.SAVE_INTERVAL / 1000) {
        saveTimer = 0;
        E.save();
      }
    }

    requestAnimationFrame(loop);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secure) return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  function init() {
    UI.init();
    UC.FX.start();
    E.setAudioHooks(UC.Audio);
    initTiltFromSave();
    UI.updateTiltUI();
    UI.updateSoundUI();
    bindEvents();
    initOfflineReport();
    E.checkAchievements();
    UI.update();
    UI.updateAchievements();
    E.save();

    requestAnimationFrame(loop);
    setTimeout(hideBoot, 850);
    window.addEventListener('load', () => setTimeout(hideBoot, 350), { once: true });
    registerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
