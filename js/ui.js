/* =========================================================
   UPGRADE CLICKER — interface renderer
   ©2026 Nur Mahmudi
   ========================================================= */
(() => {
  'use strict';

  const UC = window.UC = window.UC || {};
  const E = UC.Engine;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = E.state;
  const refs = {};
  const upgradeCards = new Map();
  const achievementNodes = new Map();
  let lastStage = -1;
  let activeFilter = 'all';
  let saveTimer = 0;

  function cacheRefs() {
    [
      'app', 'energyValue', 'energyDisplay', 'energyRate', 'clickPowerValue',
      'critChanceValue', 'autoRateValue', 'comboValue', 'tiltStatus', 'levelValue',
      'levelPercent', 'levelFill', 'levelProgress', 'nextLevelHint', 'evolutionHint',
      'stageBadge', 'totalClicks', 'bestCombo', 'achievementMini', 'tapHint',
      'goldValue', 'diamondValue', 'crystalValue', 'infinityValue',
      'labClickPower', 'labAutoRate', 'upgradeList', 'techList', 'specialList', 'permList',
      'formName', 'formStage', 'formBand', 'formMult', 'evolveNextName', 'evolveNextDesc',
      'evolveLevelReq', 'evolveCrystalReq', 'evolveButton', 'evolveButtonSub',
      'stageTrack', 'rebirthCount', 'rebirthBonus', 'rebirthReward', 'rebirthRequirement',
      'rebirthButton', 'rebirthButtonSub', 'confirmReward', 'achievementCount',
      'achievementBar', 'awardRing', 'achievementList', 'saveStatus', 'toastStack',
      'soundBtn', 'settingsSound', 'settingsHaptics', 'settingsTilt', 'motionStatus',
      'motionStatusText', 'motionPermissionBtn', 'deckTitle', 'deckScroll', 'buyMode',
      'mobileNav', 'coreButton', 'reactorStage', 'floatLayer', 'dropLayer', 'formCard'
    ].forEach(id => { refs[id] = document.getElementById(id); });
  }

  function esc(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function currencyIcon(name) {
    return UC.ICONS[name] || UC.ICONS.energy;
  }

  function upgradeCardHTML(def) {
    return `
      <article class="upgrade-card" data-card="${def.kind}:${def.id}" data-kind="${def.kind}">
        <div class="upgrade-icon" aria-hidden="true">${UC.ICONS[def.icon] || UC.ICONS.tap}</div>
        <div class="upgrade-copy">
          <div class="upgrade-title-row">
            <span class="upgrade-title">${esc(def.name)}</span>
            <span class="upgrade-level">LV 0</span>
          </div>
          <p class="upgrade-desc">${esc(def.desc)}</p>
          <div class="upgrade-effect">—</div>
        </div>
        <button class="buy-btn" type="button" data-buy-kind="${def.kind}" data-buy-id="${def.id}" data-currency="${def.currency}" aria-label="Beli ${esc(def.name)}">
          <span>BUY</span>
          <b>${currencyIcon(def.currency)}<i class="cost">0</i></b>
        </button>
      </article>`;
  }

  function mountUpgrades() {
    refs.upgradeList.innerHTML = UC.ENERGY_UPGRADES.map(upgradeCardHTML).join('');
    refs.techList.innerHTML = UC.TECH_UPGRADES.map(upgradeCardHTML).join('');
    refs.specialList.innerHTML = UC.SPECIAL_UPGRADES.map(upgradeCardHTML).join('');
    refs.permList.innerHTML = UC.PERM_UPGRADES.map(upgradeCardHTML).join('');
    UC.ALL_UPGRADES.forEach(def => {
      const card = document.querySelector(`[data-card="${def.kind}:${def.id}"]`);
      if (card) upgradeCards.set(`${def.kind}:${def.id}`, card);
    });
  }

  function mountStageTrack() {
    refs.stageTrack.innerHTML = UC.STAGES.map((stage, index) => `
      <div class="stage-item" data-stage-index="${index}">
        <span class="stage-num">${String(index + 1).padStart(2, '0')}</span>
        <span class="stage-item-copy">
          <b>${esc(stage.name)}</b>
          <small>${esc(stage.band)}</small>
        </span>
        <em>×${E.format(stage.mult)}</em>
      </div>`).join('');
  }

  function mountAchievements() {
    refs.achievementList.innerHTML = UC.ACHIEVEMENTS.map(def => `
      <article class="achievement" data-achievement-id="${def.id}" data-unlocked="false">
        <div class="achievement-icon" aria-hidden="true">${def.icon}</div>
        <div class="achievement-copy">
          <b>${esc(def.name)}</b>
          <small>${esc(def.desc)}</small>
          <div class="achievement-progress"><span></span></div>
        </div>
        <div class="achievement-status">
          <b>+${def.reward.diamonds} ◆</b>
          <span>0 / ${E.format(def.target)}</span>
        </div>
      </article>`).join('');
    UC.ACHIEVEMENTS.forEach(def => {
      const node = document.querySelector(`[data-achievement-id="${def.id}"]`);
      if (node) achievementNodes.set(def.id, node);
    });
  }

  function applyStage() {
    if (lastStage === state.evolution) return;
    lastStage = state.evolution;
    refs.app.dataset.stage = String(state.evolution);
    const accent = getComputedStyle(refs.app).getPropertyValue('--accent').trim();
    UC.FX.setAccent(accent);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#050713');
  }

  function updateCurrencies() {
    refs.goldValue.textContent = E.format(state.gold);
    refs.diamondValue.textContent = E.format(state.diamonds);
    refs.crystalValue.textContent = E.format(state.crystals);
    refs.infinityValue.textContent = E.format(state.infinity);
    refs.goldValue.title = E.formatExact(state.gold);
    refs.diamondValue.title = E.formatExact(state.diamonds);
    refs.crystalValue.title = E.formatExact(state.crystals);
    refs.infinityValue.title = E.formatExact(state.infinity);
  }

  function updateCore() {
    refs.energyValue.textContent = E.format(state.energy);
    refs.energyDisplay.title = `${E.formatExact(state.energy)} energy`;
    refs.energyRate.textContent = `+${E.format(E.autoRate())}`;
    refs.clickPowerValue.textContent = E.format(E.clickPower() * E.tiltBonus());
    refs.critChanceValue.textContent = `${Math.round(E.critChance() * 100)}%`;
    refs.autoRateValue.textContent = E.format(E.autoRate());
    refs.comboValue.textContent = `×${E.comboMultiplier().toFixed(2)}`;
    refs.levelValue.textContent = String(state.level);
    refs.stageBadge.textContent = E.stage().name.toUpperCase();
    refs.totalClicks.textContent = E.format(state.stats.clicks);
    refs.bestCombo.textContent = E.format(state.stats.bestCombo);
    refs.achievementMini.textContent = String(Object.keys(state.achievements).length);
    refs.labClickPower.textContent = E.format(E.clickPower() * E.tiltBonus());
    refs.labAutoRate.textContent = `${E.format(E.autoRate())}/s`;

    const need = E.levelNeed(state.level);
    const percent = state.level >= UC.MAX_LEVEL ? 100 : Math.max(0, Math.min(100, Math.floor((state.levelXp / need) * 100)));
    refs.levelPercent.textContent = String(percent);
    refs.levelFill.style.width = `${percent}%`;
    refs.levelProgress.setAttribute('aria-valuenow', String(percent));
    refs.levelProgress.setAttribute('aria-valuetext', `${percent}% menuju level berikutnya`);

    if (state.level >= UC.MAX_LEVEL) {
      refs.nextLevelHint.textContent = 'MAX LEVEL — ULTIMATE ACHIEVED';
    } else {
      const nextLevel = state.level + 1;
      const gold = 4 + nextLevel * 3;
      const crystals = 3 + Math.floor(nextLevel / 10) * 2 + (nextLevel % 10 === 0 ? 8 : 0);
      const diamonds = nextLevel % 5 === 0 ? 2 + Math.floor(nextLevel / 20) + state.perm.oracle : 0;
      refs.nextLevelHint.textContent = `NEXT: +${gold} GOLD · +${crystals} CRYSTAL${diamonds ? ` · +${diamonds} ◆` : ''}`;
    }

    const evolve = E.evolveInfo();
    if (evolve.max) refs.evolutionHint.textContent = 'ULTIMATE FORM';
    else if (evolve.can) refs.evolutionHint.textContent = 'EVOLUTION READY';
    else refs.evolutionHint.textContent = `EVOLVE AT LV. ${evolve.reqLevel}`;

    updateTiltUI();
  }

  function updateUpgrades() {
    for (const def of UC.ALL_UPGRADES) {
      const card = upgradeCards.get(`${def.kind}:${def.id}`);
      if (!card) continue;
      const level = E.getLevel(def);
      const maxed = level >= def.max;
      const info = E.upgradeQuantity(def, state.buyMode);
      const levelChip = card.querySelector('.upgrade-level');
      const effect = card.querySelector('.upgrade-effect');
      const buy = card.querySelector('.buy-btn');
      const cost = buy.querySelector('.cost');
      const label = buy.querySelector('span');

      levelChip.textContent = maxed ? 'MAX' : `LV ${level}`;
      if (maxed) {
        effect.textContent = `MAX · ${def.effect(level)}`;
      } else {
        effect.textContent = `${def.effect(level)} → ${def.effect(level + 1)}`;
      }

      card.classList.toggle('is-maxed', maxed);
      card.classList.toggle('is-affordable', !maxed && info.affordable);

      let text = 'BUY';
      if (maxed) text = 'MAX';
      else if (state.buyMode === 'max' && info.qty > 0) text = `MAX ×${info.qty}`;
      else if (Number(state.buyMode) > 1) text = `BUY ×${info.qty}`;
      label.textContent = text;
      cost.textContent = maxed ? '—' : E.format(info.cost);
      buy.disabled = maxed || !info.affordable;
      buy.setAttribute('aria-label', maxed
        ? `${def.name} sudah maksimal`
        : `Beli ${info.qty} ${def.name} seharga ${E.formatExact(info.cost)} ${def.currency}`);
    }
  }

  function updateStageTrack() {
    $$('.stage-item', refs.stageTrack).forEach((node, index) => {
      node.classList.toggle('is-current', index === state.evolution);
      node.classList.toggle('is-next', index === state.evolution + 1);
      node.classList.toggle('is-locked', index > state.evolution + 1);
    });
  }

  function updateEvolve() {
    const stage = E.stage();
    const info = E.evolveInfo();
    refs.formName.textContent = stage.title;
    refs.formStage.textContent = `STAGE ${state.evolution + 1}`;
    refs.formBand.textContent = stage.band;
    refs.formMult.textContent = `×${E.format(E.stageMult())}`;

    if (info.max) {
      refs.evolveNextName.textContent = 'ULTIMATE FORM ACHIEVED';
      refs.evolveNextDesc.textContent = 'Inti telah mencapai bentuk tertinggi. Selesaikan Level 100, lalu rebirth untuk memulai siklus baru.';
      refs.evolveLevelReq.textContent = 'MAX FORM';
      refs.evolveCrystalReq.textContent = '∞';
      refs.evolveLevelReq.className = 'req-chip is-ok';
      refs.evolveCrystalReq.className = 'req-chip is-ok';
      refs.evolveButton.disabled = true;
      refs.evolveButton.querySelector('.btn-main').textContent = 'MAX FORM';
      refs.evolveButtonSub.textContent = 'ULTIMATE';
    } else {
      refs.evolveNextName.textContent = info.nextStage.title;
      refs.evolveNextDesc.textContent = `Form ${info.nextIndex + 1}/10 · ${info.nextStage.band} · lipatgandakan output inti menjadi ×${E.format(info.nextStage.mult)}.`;
      refs.evolveLevelReq.textContent = `LV. ${info.reqLevel}`;
      refs.evolveCrystalReq.textContent = `◆ ${E.format(info.cost)} CRYSTAL`;
      refs.evolveLevelReq.className = `req-chip ${info.levelOk ? 'is-ok' : 'is-missing'}`;
      refs.evolveCrystalReq.className = `req-chip req-crystal ${info.crystalOk ? 'is-ok' : 'is-missing'}`;
      refs.evolveButton.disabled = !info.can;
      refs.evolveButton.querySelector('.btn-main').textContent = 'EVOLVE';
      refs.evolveButtonSub.textContent = info.can
        ? 'READY'
        : !info.levelOk
          ? `NEED LV. ${info.reqLevel}`
          : `NEED ${E.format(info.cost)} ◆`;
    }
    updateStageTrack();
  }

  function updateRebirth() {
    const reward = E.rebirthReward();
    refs.rebirthCount.textContent = E.format(state.rebirths);
    refs.rebirthBonus.textContent = `+${Math.round((E.permMult() - 1) * 100)}%`;
    refs.rebirthReward.textContent = E.format(reward);
    refs.confirmReward.textContent = `${E.format(reward)} ∞`;
    if (reward > 0) {
      refs.rebirthRequirement.textContent = 'Ready. Semua progres sesi ini akan di-reset.';
      refs.rebirthButton.disabled = false;
      refs.rebirthButtonSub.textContent = `+${E.format(reward)} ∞`;
    } else {
      refs.rebirthRequirement.textContent = `Reach Level 20 to unlock. (${state.level}/20)`;
      refs.rebirthButton.disabled = true;
      refs.rebirthButtonSub.textContent = 'LOCKED';
    }
  }

  function updateAchievements() {
    const unlocked = Object.keys(state.achievements).length;
    const pct = (unlocked / UC.ACHIEVEMENTS.length) * 100;
    refs.achievementCount.textContent = String(unlocked);
    refs.achievementBar.style.width = `${pct}%`;
    refs.awardRing.style.setProperty('--pct', pct.toFixed(2));
    refs.achievementMini.textContent = String(unlocked);

    for (const def of UC.ACHIEVEMENTS) {
      const node = achievementNodes.get(def.id);
      if (!node) continue;
      const isUnlocked = Boolean(state.achievements[def.id]);
      const progress = Math.min(def.target, E.getAchievementProgress(def));
      node.classList.toggle('is-unlocked', isUnlocked);
      node.dataset.unlocked = String(isUnlocked);
      node.querySelector('.achievement-progress span').style.width = `${Math.min(100, (progress / def.target) * 100)}%`;
      const status = node.querySelector('.achievement-status span');
      status.textContent = isUnlocked ? 'UNLOCKED' : `${E.format(progress)} / ${E.format(def.target)}`;
      if (activeFilter === 'unlocked' && !isUnlocked) node.classList.add('is-hidden');
      else if (activeFilter === 'locked' && isUnlocked) node.classList.add('is-hidden');
      else node.classList.remove('is-hidden');
    }
  }

  function update() {
    applyStage();
    updateCurrencies();
    updateCore();
    updateUpgrades();
    updateEvolve();
    updateRebirth();
  }

  function updateSoundUI() {
    refs.soundBtn.classList.toggle('is-muted', !state.settings.sound);
    refs.soundBtn.setAttribute('aria-label', state.settings.sound ? 'Matikan suara' : 'Nyalakan suara');
    refs.settingsSound.setAttribute('aria-checked', String(state.settings.sound));
    refs.settingsHaptics.setAttribute('aria-checked', String(state.settings.haptics));
    refs.settingsTilt.setAttribute('aria-checked', String(state.settings.tilt));
  }

  function updateTiltUI() {
    const supported = typeof window.DeviceOrientationEvent !== 'undefined';
    const enabled = state.settings.tilt;
    const active = enabled && E.tilt.active;
    if (!supported) {
      refs.tiltStatus.textContent = 'TOUCH MODE';
      refs.tiltStatus.classList.remove('is-active');
      refs.motionStatusText.textContent = 'Sensor gerak tidak tersedia di perangkat ini.';
      refs.motionStatus.classList.add('is-error');
      refs.motionStatus.classList.remove('is-on');
      refs.motionPermissionBtn.disabled = true;
      refs.motionPermissionBtn.textContent = 'N/A';
      return;
    }
    if (!enabled) {
      refs.tiltStatus.textContent = 'TOUCH MODE';
      refs.tiltStatus.classList.remove('is-active');
      refs.motionStatusText.textContent = 'Motion sensor belum aktif.';
      refs.motionStatus.classList.remove('is-on', 'is-error');
      refs.motionPermissionBtn.disabled = false;
      refs.motionPermissionBtn.textContent = 'ENABLE';
    } else if (!active) {
      refs.tiltStatus.textContent = 'CALIBRATING';
      refs.tiltStatus.classList.remove('is-active');
      refs.motionStatusText.textContent = 'Menunggu data sensor. Pegang perangkat secara alami.';
      refs.motionStatus.classList.remove('is-on', 'is-error');
      refs.motionPermissionBtn.disabled = false;
      refs.motionPermissionBtn.textContent = 'DISABLE';
    } else {
      const bonus = Math.round(Math.max(0, Math.min(1, E.tilt.alignment)) * 20);
      refs.tiltStatus.textContent = `TILT +${bonus}%`;
      refs.tiltStatus.classList.add('is-active');
      refs.motionStatusText.textContent = `Motion online. Bonus click +${bonus}% (maks +20%).`;
      refs.motionStatus.classList.add('is-on');
      refs.motionStatus.classList.remove('is-error');
      refs.motionPermissionBtn.disabled = false;
      refs.motionPermissionBtn.textContent = 'DISABLE';
    }
  }

  function setBuyMode(mode) {
    state.buyMode = mode;
    $$('[data-buy-mode]', refs.buyMode).forEach(button => {
      button.classList.toggle('is-active', button.dataset.buyMode === mode);
    });
    updateUpgrades();
  }

  function setTab(tab) {
    $$('.deck-tabs button').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('.panel').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === tab));
    const titles = { lab: 'POWER LAB', evolve: 'EVOLUTION LAB', rebirth: 'SINGULARITY', awards: 'ACHIEVEMENTS' };
    refs.deckTitle.textContent = titles[tab] || 'POWER LAB';
    if (refs.buyMode) refs.buyMode.style.display = tab === 'lab' ? '' : 'none';
    if (refs.deckScroll) refs.deckScroll.scrollTop = 0;
  }

  function setMobileView(view) {
    refs.app.dataset.mobileView = view;
    $$('[data-mobile-tab]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.mobileTab === view);
    });
    if (view !== 'core') setTab(view);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function setFilter(filter) {
    activeFilter = filter;
    $$('[data-award-filter]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.awardFilter === filter);
    });
    updateAchievements();
  }

  function toast(title, description, type = 'energy', icon = '⚡', duration = 3600) {
    if (!refs.toastStack) return;
    while (refs.toastStack.children.length >= 4) {
      refs.toastStack.firstElementChild.remove();
    }
    const node = document.createElement('div');
    node.className = `toast is-${type}`;
    const iconNode = document.createElement('div');
    iconNode.className = 'toast-icon';
    iconNode.textContent = icon;
    const copy = document.createElement('div');
    copy.className = 'toast-copy';
    const strong = document.createElement('b');
    strong.textContent = title;
    const small = document.createElement('small');
    small.textContent = description;
    copy.append(strong, small);
    node.append(iconNode, copy);
    refs.toastStack.append(node);
    setTimeout(() => {
      if (!node.isConnected) return;
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 280);
    }, duration);
  }

  function floatNumber(amount, x, y, crit = false) {
    if (!refs.floatLayer) return;
    while (refs.floatLayer.children.length > 20) refs.floatLayer.firstElementChild.remove();
    const node = document.createElement('span');
    node.className = `float-number${crit ? ' is-crit' : ''}`;
    node.textContent = `${crit ? 'CRIT ' : '+'}${E.format(amount)}`;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    refs.floatLayer.append(node);
    setTimeout(() => node.remove(), 980);
  }

  function pulseCore(crit = false) {
    refs.coreButton.classList.remove('is-clicked', 'is-crit');
    void refs.coreButton.offsetWidth;
    refs.coreButton.classList.add(crit ? 'is-crit' : 'is-clicked');
    if (crit) {
      refs.app.classList.remove('is-shaking');
      void refs.app.offsetWidth;
      refs.app.classList.add('is-shaking');
      setTimeout(() => refs.app.classList.remove('is-shaking'), 220);
    }
    setTimeout(() => refs.coreButton.classList.remove('is-clicked', 'is-crit'), 380);
  }

  function evolveFlash(stage) {
    const node = document.createElement('div');
    node.className = 'evolve-flash';
    const strong = document.createElement('strong');
    strong.textContent = stage.name.toUpperCase();
    const span = document.createElement('span');
    span.textContent = `EVOLUTION ${state.evolution + 1} / 10 · ${stage.title}`;
    node.append(strong, span);
    document.body.append(node);
    requestAnimationFrame(() => node.classList.add('is-active'));
    setTimeout(() => node.remove(), 2200);
  }

  function setSaveStatus(time) {
    if (!refs.saveStatus) return;
    const date = new Date(time || Date.now());
    refs.saveStatus.textContent = `SAVED ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      refs.saveStatus.textContent = 'AUTO-SAVE ON';
    }, 3200);
  }

  function init() {
    cacheRefs();
    mountUpgrades();
    mountStageTrack();
    mountAchievements();
    setBuyMode(state.buyMode || '1');
    updateSoundUI();
    update();
    updateAchievements();
    setSaveStatus(Date.now());
    setTab('lab');
    setMobileView('core');
  }

  UC.UI = {
    refs,
    init,
    update,
    updateAchievements,
    updateSoundUI,
    updateTiltUI,
    updateUpgrades,
    updateRebirth,
    setBuyMode,
    setTab,
    setMobileView,
    setFilter,
    toast,
    floatNumber,
    pulseCore,
    evolveFlash,
    setSaveStatus,
    upgradeCards
  };
})();
