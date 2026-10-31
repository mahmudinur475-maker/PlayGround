/* =========================================================
   UPGRADE CLICKER — game data
   ©2026 Nur Mahmudi
   ========================================================= */
(() => {
  'use strict';

  const UC = window.UC = window.UC || {};

  UC.MAX_LEVEL = 100;
  UC.LEVEL_BASE = 40;
  UC.LEVEL_GROWTH = 1.14;
  UC.SAVE_KEY = 'upgradeClicker.save.v2';
  UC.SAVE_INTERVAL = 5000;
  UC.MAX_OFFLINE_SECONDS = 8 * 60 * 60;

  UC.STAGES = [
    { name: 'Beginner',  title: 'BEGINNER CORE',  band: 'LV. 1–10',   power: '1×–10×',     mult: 1 },
    { name: 'Advanced',  title: 'ADVANCED CORE',  band: 'LV. 11–20',  power: '20×–100×',   mult: 3 },
    { name: 'Super',     title: 'SUPER CORE',     band: 'LV. 21–30',  power: '200×–1K×',   mult: 9 },
    { name: 'Ultra',     title: 'ULTRA CORE',     band: 'LV. 31–40',  power: '2K×–10K×',   mult: 27 },
    { name: 'Master',    title: 'MASTER CORE',    band: 'LV. 41–50',  power: '20K×–100K×', mult: 81 },
    { name: 'Legendary', title: 'LEGENDARY CORE', band: 'LV. 51–60',  power: '200K×–1M×',  mult: 243 },
    { name: 'Mythical',  title: 'MYTHICAL CORE',  band: 'LV. 61–70',  power: '2M×–10M×',   mult: 729 },
    { name: 'Cosmic',    title: 'COSMIC CORE',    band: 'LV. 71–80',  power: '20M×–100M×', mult: 2187 },
    { name: 'Universal', title: 'UNIVERSAL CORE', band: 'LV. 81–90',  power: '200M×–1B×',  mult: 6561 },
    { name: 'Ultimate',  title: 'ULTIMATE CORE',  band: 'LV. 91–100', power: '2B×–10B×',   mult: 19683 }
  ];

  UC.EVOLVE_COSTS = [0, 8, 16, 28, 44, 64, 88, 116, 148, 184];

  UC.CURRENCY_META = {
    energy:   { name: 'Energy',   glyph: '⚡', color: '#61f3ff' },
    gold:     { name: 'Gold',     glyph: '⬡', color: '#ffd36a' },
    diamond:  { name: 'Diamond',  glyph: '◆', color: '#77d9ff' },
    crystal:  { name: 'Crystal',  glyph: '✧', color: '#d58cff' },
    infinity: { name: 'Infinity', glyph: '∞', color: '#ff77d1' }
  };

  UC.ICONS = {
    tap: '<svg viewBox="0 0 24 24"><path d="M13.4 2 5 13h5.2L9 22l9-12h-5.3l.7-8Z" fill="currentColor"/></svg>',
    auto: '<svg viewBox="0 0 24 24"><path d="M12 4a8 8 0 0 1 7.7 5.9l2-.6A10 10 0 0 0 4 8.3V4H2v7h7V9H5.1A8 8 0 0 1 12 4Zm0 16a8 8 0 0 1-7.7-5.9l-2 .6A10 10 0 0 0 20 15.7V20h2v-7h-7v2h3.9A8 8 0 0 1 12 20Z" fill="currentColor"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-9 9v7h2v-7a7 7 0 1 1 14 0v7h2v-7a9 9 0 0 0-9-9Zm0 4a5 5 0 0 0-5 5v5h2v-5a3 3 0 0 1 6 0v5h2v-5a5 5 0 0 0-5-5Zm0 4a1 1 0 0 0-1 1v6h2v-6a1 1 0 0 0-1-1Z" fill="currentColor"/></svg>',
    crit: '<svg viewBox="0 0 24 24"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l2.8 2.8m8.4 8.4L19 19M19 5l-2.8 2.8M7.8 16.2 5 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    combo: '<svg viewBox="0 0 24 24"><circle cx="5" cy="17" r="2.4" fill="currentColor"/><circle cx="12" cy="7" r="2.4" fill="currentColor"/><circle cx="19" cy="17" r="2.4" fill="currentColor"/><path d="m6.6 14.9 3.8-5.9m3.2 0 3.8 5.9M7.4 17h9.2" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
    solar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    plasma: '<svg viewBox="0 0 24 24"><path d="M13.8 2 5.4 13.2h5.1L9.2 22l8.7-12.2h-5.2L13.8 2Z" fill="currentColor"/></svg>',
    quantum: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.1" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="currentColor" stroke-width="1.3" transform="rotate(120 12 12)"/></svg>',
    drone: '<svg viewBox="0 0 24 24"><path d="M9 8h6l2.5 4-2.5 4H9l-2.5-4L9 8Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 8 3 4.5M17.5 8 21 4.5M6.5 16 3 19.5M17.5 16l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>',
    prism: '<svg viewBox="0 0 24 24"><path d="m12 2 7 7-7 13L5 9l7-7Zm0 3.2L8 9l4 9 4-9-4-3.8Z" fill="currentColor"/></svg>',
    warp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6.5V12l4 2.5M5.5 5.5 8 8m10.5-2.5L16 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    fortune: '<svg viewBox="0 0 24 24"><path d="M12 21c-4.4 0-8-3.6-8-8 0-4.6 4-9 8-11 4 2 8 6.4 8 11 0 4.4-3.6 8-8 8Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v10m-3.5-7h5.5a2 2 0 0 1 0 4H9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
    singularity: '<svg viewBox="0 0 24 24"><path d="M7.2 6C3.8 6 1 8.7 1 12s2.8 6 6.2 6c2.5 0 4.2-1.6 5.8-3.5C14.6 16.4 16.3 18 18.8 18 22.2 18 23 15.3 23 12s-.8-6-4.2-6c-2.5 0-4.2 1.6-5.8 3.5C11.4 7.6 9.7 6 7.2 6Zm0 2.5c1.3 0 2.5.9 4.1 2.6l.7.9-.7.9c-1.6 1.7-2.8 2.6-4.1 2.6C5.1 15.5 3.5 14 3.5 12S5.1 8.5 7.2 8.5Zm9.6 0c2.1 0 3.7 1.5 3.7 3.5s-1.6 3.5-3.7 3.5c-1.3 0-2.5-.9-4.1-2.6l-.7-.9.7-.9c1.6-1.7 2.8-2.6 4.1-2.6Z" fill="currentColor"/></svg>',
    legacy: '<svg viewBox="0 0 24 24"><path d="m12 2 9 5-9 5-9-5 9-5Zm0 3.1L7.4 7 12 9.1 16.6 7 12 5.1ZM3 12l9 5 9-5v2.5l-9 5-9-5V12Zm0 5 9 5 9-5v2.5l-9 5-9-5V17Z" fill="currentColor"/></svg>',
    oracle: '<svg viewBox="0 0 24 24"><path d="M12 5c5 0 9 4.3 10 7-1 2.7-5 7-10 7S3 14.7 2 12c1-2.7 5-7 10-7Zm0 2c-3.6 0-6.8 3-7.8 5 1 2 4.2 5 7.8 5s6.8-3 7.8-5c-1-2-4.2-5-7.8-5Zm0 1.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z" fill="currentColor"/></svg>',
    energy: '<svg viewBox="0 0 24 24"><path d="M13.4 2 5 13h5.2L9 22l9-12h-5.3l.7-8Z" fill="currentColor"/></svg>',
    gold: '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 3.2L17.8 8 12 11.2 6.2 8 12 5.2ZM5.5 10.1l5.5 3v5.4l-5.5-3v-5.4Zm7.5 8.4v-5.4l5.5-3v5.4l-5.5 3Z" fill="currentColor"/></svg>',
    diamond: '<svg viewBox="0 0 24 24"><path d="m12 2 7 7-7 13L5 9l7-7Zm0 3.2L8 9l4 9 4-9-4-3.8Z" fill="currentColor"/></svg>',
    crystal: '<svg viewBox="0 0 24 24"><path d="M12 2 4 8l8 14 8-14-8-6Zm0 3.3L17 8l-5 10-5-10 5-2.7Z" fill="currentColor"/></svg>',
    infinity: '<svg viewBox="0 0 24 24"><path d="M7.2 6C3.8 6 1 8.7 1 12s2.8 6 6.2 6c2.5 0 4.2-1.6 5.8-3.5C14.6 16.4 16.3 18 18.8 18 22.2 18 23 15.3 23 12s-.8-6-4.2-6c-2.5 0-4.2 1.6-5.8 3.5C11.4 7.6 9.7 6 7.2 6Zm0 2.5c1.3 0 2.5.9 4.1 2.6l.7.9-.7.9c-1.6 1.7-2.8 2.6-4.1 2.6C5.1 15.5 3.5 14 3.5 12S5.1 8.5 7.2 8.5Zm9.6 0c2.1 0 3.7 1.5 3.7 3.5s-1.6 3.5-3.7 3.5c-1.3 0-2.5-.9-4.1-2.6l-.7-.9.7-.9c1.6-1.7 2.8-2.6 4.1-2.6Z" fill="currentColor"/></svg>',
    award: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-3.5 11.8L7 22l5-2.3L17 22l-1.5-6.2A9 9 0 0 1 12 17a9 9 0 0 1-3.5-1.2Z" fill="currentColor"/></svg>'
  };

  const energyUpgrades = [
    {
      id: 'click', kind: 'energy', currency: 'energy', name: 'Kinetic Tap', icon: 'tap',
      base: 12, growth: 1.16, max: 300,
      desc: 'Tambah energy dasar setiap tap.',
      effect: l => `+${l * 2} / tap`
    },
    {
      id: 'auto', kind: 'energy', currency: 'energy', name: 'Auto Reactor', icon: 'auto',
      base: 35, growth: 1.17, max: 300,
      desc: 'Produksi energy otomatis per detik.',
      effect: l => `+${(l * 1.2).toFixed(1)} / sec`
    },
    {
      id: 'overclock', kind: 'energy', currency: 'energy', name: 'Overclock', icon: 'gauge',
      base: 250, growth: 1.28, max: 200,
      desc: 'Lipatgandakan kekuatan setiap tap.',
      effect: l => `+${l * 15}% click`
    },
    {
      id: 'crit', kind: 'energy', currency: 'energy', name: 'Critical Core', icon: 'crit',
      base: 800, growth: 1.34, max: 40,
      desc: 'Peluang critical hit ×5 energy.',
      effect: l => `+${l * 2}% crit`
    },
    {
      id: 'combo', kind: 'energy', currency: 'energy', name: 'Combo Matrix', icon: 'combo',
      base: 1500, growth: 1.32, max: 50,
      desc: 'Combo bertahan lebih lama dan lebih kuat.',
      effect: l => `+${l * 2}% combo`
    }
  ];

  const techUpgrades = [
    {
      id: 'solar', kind: 'tech', currency: 'gold', name: 'Solar Array', icon: 'solar',
      base: 30, growth: 1.62, max: 100,
      desc: 'Teknologi Gold untuk auto production.',
      effect: l => `+${l * 30}% auto`
    },
    {
      id: 'plasma', kind: 'tech', currency: 'gold', name: 'Plasma Cutter', icon: 'plasma',
      base: 45, growth: 1.7, max: 100,
      desc: 'Teknologi Gold untuk click power.',
      effect: l => `+${l * 25}% click`
    },
    {
      id: 'quantum', kind: 'tech', currency: 'gold', name: 'Quantum Lens', icon: 'quantum',
      base: 90, growth: 1.85, max: 60,
      desc: 'Meningkatkan peluang critical hit.',
      effect: l => `+${l}% crit`
    },
    {
      id: 'drone', kind: 'tech', currency: 'gold', name: 'AI Drone', icon: 'drone',
      base: 70, growth: 1.72, max: 100,
      desc: 'Drone menambah auto energy langsung.',
      effect: l => `+${l * 2} / sec`
    }
  ];

  const specialUpgrades = [
    {
      id: 'prism', kind: 'special', currency: 'diamond', name: 'Prism Core', icon: 'prism',
      base: 4, growth: 1.5, max: 30,
      desc: 'Upgrade Diamond untuk semua produksi.',
      effect: l => `+${l * 20}% all`
    },
    {
      id: 'warp', kind: 'special', currency: 'diamond', name: 'Time Warp', icon: 'warp',
      base: 6, growth: 1.65, max: 10,
      desc: 'Efisiensi offline saat reactor ditinggal.',
      effect: l => `+${l * 5}% offline`
    },
    {
      id: 'fortune', kind: 'special', currency: 'diamond', name: 'Fortune Field', icon: 'fortune',
      base: 5, growth: 1.55, max: 20,
      desc: 'Supply drop lebih sering dan lebih kaya.',
      effect: l => `+${l * 8}% drops`
    }
  ];

  const permUpgrades = [
    {
      id: 'singularity', kind: 'perm', currency: 'infinity', name: 'Singularity Core', icon: 'singularity',
      base: 1, growth: 1.8, max: 25,
      desc: 'Bonus permanen untuk seluruh produksi.',
      effect: l => `+${l * 50}% all`
    },
    {
      id: 'legacy', kind: 'perm', currency: 'infinity', name: 'Legacy Memory', icon: 'legacy',
      base: 2, growth: 2.05, max: 10,
      desc: 'Mulai rebirth dengan level Kinetic Tap.',
      effect: l => `start +${l * 2} tap`
    },
    {
      id: 'oracle', kind: 'perm', currency: 'infinity', name: 'Oracle Shard', icon: 'oracle',
      base: 3, growth: 2.2, max: 8,
      desc: 'Diamond tambahan di setiap level up.',
      effect: l => `+${l} ◆ / level`
    }
  ];

  UC.ENERGY_UPGRADES = energyUpgrades;
  UC.TECH_UPGRADES = techUpgrades;
  UC.SPECIAL_UPGRADES = specialUpgrades;
  UC.PERM_UPGRADES = permUpgrades;
  UC.ALL_UPGRADES = [...energyUpgrades, ...techUpgrades, ...specialUpgrades, ...permUpgrades];
  UC.UPGRADE_MAP = Object.fromEntries(UC.ALL_UPGRADES.map(def => [`${def.kind}:${def.id}`, def]));

  /* ---------------- Achievements: exactly 100 ---------------- */
  const compact = n => {
    if (n < 1000) return String(Math.round(n));
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    let i = -1;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)}${units[i]}`;
  };

  const groups = [
    {
      key: 'level', icon: '▲', stat: 'level',
      describe: t => `Capai Level ${t}.`,
      items: [
        [2, 'First Spark'], [5, 'Warm Core'], [10, 'Beginner Complete'],
        [15, 'Beyond Beginner'], [20, 'Advanced Operative'], [30, 'Supercharged'],
        [40, 'Ultra Instinct'], [50, 'Halfway to Infinity'], [60, 'Legendary Status'],
        [70, 'Mythical Presence'], [80, 'Cosmic Wanderer'], [90, 'Universal Constant'],
        [100, 'Ultimate Upgrade Master']
      ]
    },
    {
      key: 'clicks', icon: '◉', stat: 'clicks',
      describe: t => `Tekan core ${compact(t)} kali.`,
      items: [
        [10, 'Tap Apprentice'], [50, 'Finger Warmup'], [100, 'Century Tapper'],
        [500, 'Click Machine'], [1000, 'Thousand Cuts'], [5000, 'Tapstorm'],
        [10000, 'Click Deity'], [50000, 'Finger of Fate'], [100000, 'The Unstoppable']
      ]
    },
    {
      key: 'energy', icon: '⚡', stat: 'totalEnergy',
      describe: t => `Kumpulkan ${compact(t)} total energy.`,
      items: [
        [100, 'First Charge'], [1000, 'Kilowatt'], [10000, 'Mega Pulse'],
        [100000, 'Grid Breaker'], [1000000, 'Megawatt'], [10000000, 'Gigawatt'],
        [100000000, 'Terawatt'], [1000000000, 'Exawatt'], [10000000000, 'Star Battery'],
        [1000000000000, 'Galactic Grid']
      ]
    },
    {
      key: 'upgrades', icon: '⌁', stat: 'upgrades',
      describe: t => `Beli ${compact(t)} upgrade.`,
      items: [
        [1, 'First Upgrade'], [5, 'Tuned Up'], [10, 'Lab Regular'],
        [25, 'Tech Hoarder'], [50, 'Upgrade Addict'], [100, 'Mad Scientist'],
        [200, 'Prototype Collector'], [300, 'Overengineered'], [500, 'Singularity Engineer']
      ]
    },
    {
      key: 'evolution', icon: '✧', stat: 'evolution',
      describe: t => `Capai evolusi ke-${t}.`,
      items: [
        [1, 'New Form'], [2, 'Super Structure'], [3, 'Ultra Mutation'],
        [4, 'Master Class'], [5, 'Legend Born'], [6, 'Mythic Bloom'],
        [7, 'Cosmic Shift'], [8, 'Universal Form'], [9, 'Ultimate Evolution']
      ]
    },
    {
      key: 'rebirth', icon: '∞', stat: 'rebirths',
      describe: t => `Lakukan rebirth ${t} kali.`,
      items: [
        [1, 'First Life'], [3, 'Cycle Adept'], [5, 'Eternal Return'],
        [10, 'Loop Master'], [25, 'Time Traveler'], [50, 'Infinity Addict'],
        [100, 'Beyond Cycles']
      ]
    },
    {
      key: 'gold', icon: '⬡', stat: 'totalGold',
      describe: t => `Kumpulkan ${compact(t)} total Gold.`,
      items: [
        [10, 'Gold Rush'], [100, 'Midas Touch'], [1000, 'Bullion Baron'],
        [10000, 'Golden Empire'], [100000, 'Fortune Incarnate'], [1000000, 'Gold Singularity']
      ]
    },
    {
      key: 'diamonds', icon: '◆', stat: 'totalDiamonds',
      describe: t => `Kumpulkan ${compact(t)} total Diamond.`,
      items: [
        [5, 'Diamond Glint'], [25, 'Facet Finder'], [100, 'Facet Master'],
        [500, 'Diamond Mind'], [2000, 'Carbon Royalty']
      ]
    },
    {
      key: 'crystals', icon: '✧', stat: 'totalCrystals',
      describe: t => `Kumpulkan ${compact(t)} total Crystal.`,
      items: [
        [1, 'Crystal Seed'], [10, 'Prism Bloom'], [50, 'Shard Storm'],
        [200, 'Evolution Fuel'], [1000, 'Crystal Galaxy']
      ]
    },
    {
      key: 'infinity', icon: '∞', stat: 'totalInfinity',
      describe: t => `Kumpulkan ${compact(t)} total Infinity.`,
      items: [
        [1, 'Infinity Unlocked'], [10, 'Endless Echo'],
        [100, 'Forever Engine'], [1000, 'Infinity Overload']
      ]
    },
    {
      key: 'crits', icon: '✦', stat: 'crits',
      describe: t => `Dapatkan ${compact(t)} critical hit.`,
      items: [
        [1, 'Lucky Strike'], [25, 'Critical Thinker'], [100, 'Precision Core'],
        [1000, 'Weak Point'], [10000, 'Critical Mass']
      ]
    },
    {
      key: 'combo', icon: '⌘', stat: 'bestCombo',
      describe: t => `Capai combo ${t}.`,
      items: [
        [10, 'Combo Starter'], [25, 'Rhythm Tapper'], [50, 'Flow State'],
        [100, 'Perfect Pulse'], [250, 'Unbroken Chain']
      ]
    },
    {
      key: 'drops', icon: '◈', stat: 'drops',
      describe: t => `Ambil ${compact(t)} supply drop.`,
      items: [
        [1, 'Supply Run'], [10, 'Scavenger'], [50, 'Orb Hunter'],
        [100, 'Salvage Expert'], [500, 'Drop Lord']
      ]
    },
    {
      key: 'play', icon: '◷', stat: 'playMinutes',
      describe: t => `Main selama ${compact(t)} menit.`,
      items: [
        [1, 'One Minute Wonder'], [10, 'Ten Minute Break'], [30, 'Half Hour Hero'],
        [60, 'Hour One'], [120, 'Two Hour Reactor'], [240, 'Dedicated Operator'],
        [480, 'Idle Legend'], [1440, 'One Day in the Core']
      ]
    }
  ];

  const achievements = [];
  groups.forEach(group => {
    group.items.forEach(([target, name]) => {
      const index = achievements.length;
      const reward = { diamonds: (index + 1) % 10 === 0 ? 3 : 1 };
      if (index + 1 === 50) reward.infinity = 3;
      if (index + 1 === 100) reward.infinity = 10;
      achievements.push({
        id: `ach_${String(index + 1).padStart(3, '0')}`,
        index: index + 1,
        category: group.key,
        icon: group.icon,
        name,
        desc: group.describe(target),
        stat: group.stat,
        target,
        reward
      });
    });
  });

  UC.ACHIEVEMENTS = achievements;
  UC.AWARD_CATEGORIES = groups.map(group => ({ key: group.key, icon: group.icon }));
})();
