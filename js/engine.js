/* =========================================================
   UPGRADE CLICKER — simulation engine
   ©2026 Nur Mahmudi
   ========================================================= */
(() => {
  'use strict';

  const UC = window.UC = window.UC || {};

  const clone = value => JSON.parse(JSON.stringify(value));

  function defaultState() {
    return {
      version: 2,
      energy: 0,
      level: 1,
      levelXp: 0,
      evolution: 0,
      gold: 0,
      diamonds: 0,
      crystals: 0,
      infinity: 0,
      rebirths: 0,
      upgrades: { click: 0, auto: 0, overclock: 0, crit: 0, combo: 0 },
      tech: { solar: 0, plasma: 0, quantum: 0, drone: 0 },
      specials: { prism: 0, warp: 0, fortune: 0 },
      perm: { singularity: 0, legacy: 0, oracle: 0 },
      stats: {
        clicks: 0,
        totalEnergy: 0,
        totalGold: 0,
        totalDiamonds: 0,
        totalCrystals: 0,
        totalInfinity: 0,
        crits: 0,
        bestCombo: 0,
        drops: 0,
        upgradesBought: 0,
        playSeconds: 0
      },
      achievements: {},
      flags: { allAwards: false },
      settings: { sound: true, haptics: true, tilt: false },
      buyMode: '1',
      tutorialSeen: false,
      lastSaved: Date.now()
    };
  }

  function mergeDeep(base, incoming) {
    if (incoming === null || incoming === undefined) return base;
    if (Array.isArray(base) || typeof base !== 'object') {
      return typeof incoming === typeof base ? incoming : base;
    }
    const result = { ...base };
    Object.keys(incoming).forEach(key => {
      if (!(key in base)) return;
      const baseValue = base[key];
      const incomingValue = incoming[key];
      if (baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)) {
        if (incomingValue && typeof incomingValue === 'object') {
          result[key] = mergeDeep(baseValue, incomingValue);
        }
      } else if (typeof incomingValue === typeof baseValue) {
        result[key] = incomingValue;
      }
    });
    return result;
  }

  function load() {
    const fallback = defaultState();
    let parsed = null;
    try {
      const raw = localStorage.getItem(UC.SAVE_KEY);
      if (raw) parsed = JSON.parse(raw);
    } catch (error) {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object') return fallback;

    const merged = mergeDeep(fallback, parsed);
    merged.level = Math.max(1, Math.min(UC.MAX_LEVEL, Math.floor(Number(merged.level) || 1)));
    merged.evolution = Math.max(0, Math.min(9, Math.floor(Number(merged.evolution) || 0)));
    merged.evolution = Math.min(merged.evolution, Math.min(9, Math.floor(merged.level / 10)));
    merged.levelXp = Math.max(0, Number(merged.levelXp) || 0);
    merged.rebirths = Math.max(0, Math.floor(Number(merged.rebirths) || 0));
    ['energy', 'gold', 'diamonds', 'crystals', 'infinity'].forEach(key => {
      merged[key] = Math.max(0, Number(merged[key]) || 0);
    });
    // Achievements are a dynamic map, so they cannot be restored by mergeDeep.
    // Rebuild only known award IDs from the saved record.
    const savedAwards = parsed.achievements && typeof parsed.achievements === 'object' ? parsed.achievements : {};
    merged.achievements = {};
    UC.ACHIEVEMENTS.forEach(def => {
      const stamp = Number(savedAwards[def.id]);
      if (Number.isFinite(stamp) && stamp > 0) merged.achievements[def.id] = stamp;
    });
    merged.lastSaved = Number(merged.lastSaved) || Date.now();
    merged.stats.playSeconds = Math.max(0, Number(merged.stats.playSeconds) || 0);
    return merged;
  }

  const state = load();
  let combo = 0;
  let comboTimer = 0;
  const tilt = { enabled: false, active: false, alignment: 1, gamma: 0, beta: 0 };
  let audioHooks = null;

  let saveDisabled = false;

  function save() {
    if (saveDisabled) return state.lastSaved;
    state.lastSaved = Date.now();
    try {
      localStorage.setItem(UC.SAVE_KEY, JSON.stringify(state));
    } catch (error) {
      // Storage can be unavailable in private mode. The game still runs.
    }
    document.dispatchEvent(new CustomEvent('uc:save', { detail: { time: state.lastSaved } }));
    return state.lastSaved;
  }

  function levelNeed(level) {
    return Math.floor(UC.LEVEL_BASE * Math.pow(UC.LEVEL_GROWTH, Math.max(0, level - 1)));
  }

  function stage() {
    return UC.STAGES[state.evolution] || UC.STAGES[0];
  }

  function stageMult() {
    return Math.pow(3, state.evolution);
  }

  function levelMult() {
    return 1 + (state.level - 1) * 0.1;
  }

  function permMult() {
    return 1 + state.perm.singularity * 0.5 + state.rebirths * 0.05;
  }

  function specialMult() {
    return 1 + state.specials.prism * 0.2;
  }

  function clickPower() {
    const base = 1 + state.upgrades.click * 2;
    const overclock = 1 + state.upgrades.overclock * 0.15;
    const plasma = 1 + state.tech.plasma * 0.25;
    return base * overclock * plasma * stageMult() * permMult() * specialMult() * levelMult();
  }

  function autoRate() {
    const base = state.upgrades.auto * 1.2 + state.tech.drone * 2;
    if (base <= 0) return 0;
    const solar = 1 + state.tech.solar * 0.3;
    return base * solar * Math.pow(2.2, state.evolution) * permMult() * specialMult() * levelMult();
  }

  function critChance() {
    return Math.min(0.75, 0.05 + state.upgrades.crit * 0.02 + state.tech.quantum * 0.01);
  }

  function comboMultiplier() {
    const softCap = 200;
    return 1 + Math.min(combo, softCap) * 0.005 * (1 + state.upgrades.combo * 0.02);
  }

  function tiltBonus() {
    if (!state.settings.tilt || !tilt.active) return 1;
    return 1 + Math.max(0, Math.min(1, tilt.alignment)) * 0.2;
  }

  function registerCombo() {
    combo = Math.min(250, combo + 1);
    comboTimer = 2.6;
    if (combo > state.stats.bestCombo) state.stats.bestCombo = combo;
    return comboMultiplier();
  }

  function tickCombo(dt) {
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        comboTimer = 0;
      }
    }
  }

  function getCombo() {
    return combo;
  }

  function getComboTimer() {
    return comboTimer;
  }

  function getLevel(def) {
    if (def.kind === 'energy') return state.upgrades[def.id] || 0;
    if (def.kind === 'tech') return state.tech[def.id] || 0;
    if (def.kind === 'special') return state.specials[def.id] || 0;
    return state.perm[def.id] || 0;
  }

  function setLevel(def, value) {
    if (def.kind === 'energy') state.upgrades[def.id] = value;
    else if (def.kind === 'tech') state.tech[def.id] = value;
    else if (def.kind === 'special') state.specials[def.id] = value;
    else state.perm[def.id] = value;
  }

  function balanceFor(currency) {
    return Number(state[currency]) || 0;
  }

  function costAt(def, level) {
    return Math.floor(def.base * Math.pow(def.growth, level));
  }

  function upgradeQuantity(def, mode = state.buyMode) {
    const level = getLevel(def);
    const maxBuy = Math.max(0, def.max - level);
    if (maxBuy <= 0) {
      return { qty: 0, cost: 0, affordable: false, maxed: true, nextCost: 0, maxBuy: 0 };
    }

    if (mode === 'max') {
      let qty = 0;
      let cost = 0;
      const balance = balanceFor(def.currency);
      while (qty < maxBuy) {
        const next = costAt(def, level + qty);
        if (cost + next > balance) break;
        cost += next;
        qty++;
      }
      return {
        qty,
        cost: qty > 0 ? cost : costAt(def, level),
        affordable: qty > 0,
        maxed: false,
        nextCost: costAt(def, level),
        maxBuy
      };
    }

    const desired = Math.min(maxBuy, Math.max(1, Number(mode) || 1));
    let cost = 0;
    for (let i = 0; i < desired; i++) cost += costAt(def, level + i);
    return {
      qty: desired,
      cost,
      affordable: cost <= balanceFor(def.currency),
      maxed: false,
      nextCost: costAt(def, level),
      maxBuy
    };
  }

  function buyUpgrade(kind, id, mode = state.buyMode) {
    const def = UC.UPGRADE_MAP[`${kind}:${id}`];
    if (!def) return { ok: false, reason: 'Upgrade tidak ditemukan.' };
    const info = upgradeQuantity(def, mode);
    if (info.maxed) return { ok: false, reason: 'Upgrade sudah maksimal.', def, info };
    if (!info.affordable || info.qty < 1) return { ok: false, reason: 'Mata uang belum cukup.', def, info };

    state[def.currency] = Math.max(0, balanceFor(def.currency) - info.cost);
    setLevel(def, getLevel(def) + info.qty);
    state.stats.upgradesBought += info.qty;
    document.dispatchEvent(new CustomEvent('uc:upgrade', { detail: { def, qty: info.qty, cost: info.cost } }));
    return { ok: true, def, info };
  }

  function checkLevelUp(silent = false) {
    let gained = 0;
    while (state.level < UC.MAX_LEVEL && state.levelXp >= levelNeed(state.level)) {
      state.levelXp -= levelNeed(state.level);
      state.level += 1;
      gained++;

      const gold = 4 + state.level * 3;
      const crystals = 3 + Math.floor(state.level / 10) * 2 + (state.level % 10 === 0 ? 8 : 0);
      const diamonds = state.level % 5 === 0
        ? 2 + Math.floor(state.level / 20) + state.perm.oracle
        : 0;

      state.gold += gold;
      state.crystals += crystals;
      state.diamonds += diamonds;
      state.stats.totalGold += gold;
      state.stats.totalCrystals += crystals;
      state.stats.totalDiamonds += diamonds;

      if (state.level === UC.MAX_LEVEL) {
        state.infinity += 10;
        state.stats.totalInfinity += 10;
      }

      document.dispatchEvent(new CustomEvent('uc:levelup', {
        detail: { level: state.level, gold, crystals, diamonds, silent }
      }));
    }
    if (state.level >= UC.MAX_LEVEL) {
      state.levelXp = Math.min(state.levelXp, levelNeed(UC.MAX_LEVEL));
    }
    return gained;
  }

  function gainEnergy(amount, source = 'click', silent = false) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    state.energy += value;
    state.levelXp += value;
    state.stats.totalEnergy += value;
    checkLevelUp(silent);
    return value;
  }

  function click() {
    const crit = Math.random() < critChance();
    const multiplier = comboMultiplier();
    const amount = clickPower() * tiltBonus() * multiplier * (crit ? 5 : 1);
    state.stats.clicks += 1;
    if (crit) state.stats.crits += 1;
    registerCombo();
    gainEnergy(amount, 'click', false);
    return {
      amount,
      crit,
      multiplier: comboMultiplier(),
      combo: getCombo(),
      power: clickPower() * tiltBonus()
    };
  }

  function getAchievementProgress(def) {
    switch (def.stat) {
      case 'level': return state.level;
      case 'clicks': return state.stats.clicks;
      case 'totalEnergy': return state.stats.totalEnergy;
      case 'upgrades': return state.stats.upgradesBought;
      case 'evolution': return state.evolution;
      case 'rebirths': return state.rebirths;
      case 'totalGold': return state.stats.totalGold;
      case 'totalDiamonds': return state.stats.totalDiamonds;
      case 'totalCrystals': return state.stats.totalCrystals;
      case 'totalInfinity': return state.stats.totalInfinity;
      case 'crits': return state.stats.crits;
      case 'bestCombo': return state.stats.bestCombo;
      case 'drops': return state.stats.drops;
      case 'playMinutes': return state.stats.playSeconds / 60;
      default: return 0;
    }
  }

  function checkAchievements() {
    const unlocked = [];
    let passes = 0;
    do {
      let changed = false;
      for (const def of UC.ACHIEVEMENTS) {
        if (state.achievements[def.id]) continue;
        if (getAchievementProgress(def) >= def.target) {
          state.achievements[def.id] = Date.now();
          state.diamonds += def.reward.diamonds || 0;
          state.stats.totalDiamonds += def.reward.diamonds || 0;
          if (def.reward.infinity) {
            state.infinity += def.reward.infinity;
            state.stats.totalInfinity += def.reward.infinity;
          }
          unlocked.push(def);
          changed = true;
        }
      }
      passes++;
      if (!changed) break;
    } while (passes < 4);

    if (unlocked.length) {
      unlocked.forEach(def => {
        document.dispatchEvent(new CustomEvent('uc:achievement', { detail: { def } }));
      });
    }

    if (Object.keys(state.achievements).length >= UC.ACHIEVEMENTS.length && !state.flags.allAwards) {
      state.flags.allAwards = true;
      state.infinity += 10;
      state.stats.totalInfinity += 10;
      document.dispatchEvent(new CustomEvent('uc:allachievements', { detail: {} }));
    }
    return unlocked;
  }

  function evolveInfo() {
    const max = state.evolution >= 9;
    const nextIndex = Math.min(9, state.evolution + 1);
    const reqLevel = max ? UC.MAX_LEVEL : nextIndex * 10;
    const cost = max ? 0 : UC.EVOLVE_COSTS[nextIndex];
    return {
      max,
      nextIndex,
      nextStage: UC.STAGES[nextIndex],
      reqLevel,
      cost,
      levelOk: state.level >= reqLevel,
      crystalOk: state.crystals >= cost,
      can: !max && state.level >= reqLevel && state.crystals >= cost
    };
  }

  function evolve() {
    const info = evolveInfo();
    if (!info.can) return { ok: false, info };
    state.crystals -= info.cost;
    state.evolution = info.nextIndex;
    document.dispatchEvent(new CustomEvent('uc:evolve', {
      detail: { stage: UC.STAGES[state.evolution], index: state.evolution }
    }));
    return { ok: true, info };
  }

  function rebirthReward() {
    if (state.level < 20) return 0;
    return Math.max(1, Math.floor(Math.pow((state.level - 10) / 10, 1.8)));
  }

  function offlineEfficiency() {
    return Math.min(1, 0.5 + state.specials.warp * 0.05);
  }

  function rebirth() {
    const reward = rebirthReward();
    if (reward <= 0) return { ok: false, reward: 0 };

    state.infinity += reward;
    state.stats.totalInfinity += reward;
    state.rebirths += 1;

    const legacyTap = state.perm.legacy * 2;
    state.energy = 0;
    state.level = 1;
    state.levelXp = 0;
    state.evolution = 0;
    state.gold = 0;
    state.diamonds = 0;
    state.crystals = 0;
    state.upgrades = { click: legacyTap, auto: 0, overclock: 0, crit: 0, combo: 0 };
    state.tech = { solar: 0, plasma: 0, quantum: 0, drone: 0 };
    state.specials = { prism: 0, warp: 0, fortune: 0 };
    combo = 0;
    comboTimer = 0;

    document.dispatchEvent(new CustomEvent('uc:rebirth', { detail: { reward, legacyTap } }));
    return { ok: true, reward, legacyTap };
  }

  function applyOffline() {
    const now = Date.now();
    const elapsed = Math.min(UC.MAX_OFFLINE_SECONDS, Math.max(0, (now - state.lastSaved) / 1000));
    if (elapsed < 30) return null;
    const rate = autoRate();
    if (rate <= 0) return null;
    const efficiency = offlineEfficiency();
    const gain = rate * elapsed * efficiency;
    if (gain < 1) return null;
    gainEnergy(gain, 'offline', true);
    return { elapsed, gain, efficiency };
  }

  function resetSave() {
    saveDisabled = true;
    try { localStorage.removeItem(UC.SAVE_KEY); } catch (error) { /* noop */ }
  }

  function format(value, decimals = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '∞';
    if (n < 0) return `-${format(-n, decimals)}`;
    if (n < 1000) return Math.floor(n).toLocaleString('en-US');
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc'];
    let index = -1;
    let scaled = n;
    while (scaled >= 1000 && index < units.length - 1) {
      scaled /= 1000;
      index++;
    }
    if (index >= units.length - 1 && scaled >= 1000) return scaled.toExponential(2);
    const fixed = scaled >= 100 ? 0 : scaled >= 10 ? Math.min(1, decimals) : Math.min(2, decimals);
    return `${scaled.toFixed(fixed)}${units[index]}`;
  }

  function formatExact(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '∞';
    return Math.floor(n).toLocaleString('en-US');
  }

  function formatDuration(seconds) {
    const sec = Math.max(0, Math.floor(seconds));
    if (sec < 60) return `${sec}s`;
    const minutes = Math.floor(sec / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours < 24) return `${hours}h ${rest}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  function setAudioHooks(hooks) {
    audioHooks = hooks;
  }

  function sound(name, payload) {
    if (!audioHooks || !state.settings.sound) return;
    try { audioHooks[name]?.(payload); } catch (error) { /* audio is optional */ }
  }

  UC.Engine = {
    state,
    defaultState,
    load,
    save,
    resetSave,
    levelNeed,
    stage,
    stageMult,
    levelMult,
    permMult,
    specialMult,
    clickPower,
    autoRate,
    critChance,
    comboMultiplier,
    tiltBonus,
    getCombo,
    getComboTimer,
    registerCombo,
    tickCombo,
    click,
    gainEnergy,
    checkLevelUp,
    getAchievementProgress,
    checkAchievements,
    getLevel,
    setLevel,
    costAt,
    balanceFor,
    upgradeQuantity,
    buyUpgrade,
    evolveInfo,
    evolve,
    rebirthReward,
    offlineEfficiency,
    rebirth,
    applyOffline,
    format,
    formatExact,
    formatDuration,
    setAudioHooks,
    sound,
    tilt,
    clone
  };
})();
