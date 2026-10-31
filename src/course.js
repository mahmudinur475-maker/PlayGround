import { mulberry32, shuffle, clamp } from './util.js';

export const RACE_LENGTH = 320;
export const LANE_COUNT = 4;
export const LANE_WIDTH = 1.22;
export const LANES = [-1.83, -0.61, 0.61, 1.83];
export const TRACK_EDGE = 4.8;

export const START_LANE = 1;

export const HAZARD = Object.freeze({
  HURDLE: 'hurdle',
  BARRIER: 'barrier',
  CONE: 'cone',
});

export const RIVAL_BLUEPRINTS = [
  {
    id: 'bima',
    name: 'BIMA',
    jersey: '#ffc857',
    accent: '#ff8a3d',
    skin: '#8c5236',
    hair: '#1d1210',
    shorts: '#152238',
    shoe: '#f7f1e3',
    lane: 0,
    style: 'short',
    base: 12.42,
    wobble: 0.24,
    surge: 0.42,
    phase: 0.6,
  },
  {
    id: 'sari',
    name: 'SARI',
    jersey: '#58e6ff',
    accent: '#2c9dff',
    skin: '#c88457',
    hair: '#20140f',
    shorts: '#101c35',
    shoe: '#f7f1e3',
    lane: 2,
    style: 'ponytail',
    base: 12.62,
    wobble: 0.28,
    surge: 0.52,
    phase: 2.4,
  },
  {
    id: 'raka',
    name: 'RAKA',
    jersey: '#ff5d8f',
    accent: '#ff2f6c',
    skin: '#e0a077',
    hair: '#3a2114',
    shorts: '#141b2c',
    shoe: '#f7f1e3',
    lane: 3,
    style: 'bun',
    base: 12.82,
    wobble: 0.3,
    surge: 0.58,
    phase: 4.7,
  },
];

const HAZARD_WEIGHTS = [
  { type: HAZARD.HURDLE, weight: 0.4 },
  { type: HAZARD.BARRIER, weight: 0.28 },
  { type: HAZARD.CONE, weight: 0.32 },
];

function weightedType(random, progress) {
  const barrierBias = progress > 0.45 ? 0.12 : 0;
  const hurdleBias = progress > 0.7 ? 0.06 : 0;
  const table = [
    { type: HAZARD.HURDLE, weight: 0.4 + hurdleBias },
    { type: HAZARD.BARRIER, weight: 0.28 + barrierBias },
    { type: HAZARD.CONE, weight: 0.32 - barrierBias / 2 },
  ];
  const total = table.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of table) {
    roll -= item.weight;
    if (roll <= 0) return item.type;
  }
  return HAZARD_WEIGHTS[0].type;
}

function laneFreeAt(obstacles, lane, distance, padding = 2.2) {
  return !obstacles.some(
    (obstacle) => obstacle.lane === lane && Math.abs(obstacle.d - distance) < padding,
  );
}

export function generateCourse(seed) {
  const random = mulberry32(seed);
  const obstacles = [];
  const orbs = [];
  let distance = 52;
  let row = 0;

  while (distance < RACE_LENGTH - 32) {
    const progress = distance / RACE_LENGTH;
    const type = weightedType(random, progress);

    let blocked = 1;
    const pairChance = 0.26 + progress * 0.28;
    if (random() < pairChance) blocked = 2;
    if (type !== HAZARD.CONE && distance > 190 && random() < 0.2) blocked = 3;
    blocked = Math.min(blocked, LANE_COUNT - 1);

    const order = shuffle([0, 1, 2, 3], random);
    const lanes = order.slice(0, blocked);
    const free = order.slice(blocked);

    for (const lane of lanes) {
      obstacles.push({
        d: distance,
        lane,
        type,
        hit: false,
        cleared: false,
        phase: random() * Math.PI * 2,
        seed: random(),
      });
    }

    if (row % 2 === 0 || progress > 0.6) {
      const lane = free[Math.floor(random() * free.length)];
      const first = distance + 4.6 + random() * 1.3;
      orbs.push({ d: first, lane, y: 1.02, taken: false, phase: random() * Math.PI * 2 });
      if (random() < 0.72) {
        orbs.push({ d: first + 3.6, lane, y: 1.02, taken: false, phase: random() * Math.PI * 2 });
      }
    }

    distance += 23 + random() * 14;
    row += 1;
  }

  // A small energy oasis before the final push.
  for (const d of [RACE_LENGTH - 24, RACE_LENGTH - 17, RACE_LENGTH - 10]) {
    if (laneFreeAt(obstacles, START_LANE, d, 2.4)) {
      orbs.push({ d, lane: START_LANE, y: 1.02, taken: false, phase: random() * Math.PI * 2 });
    }
  }

  // Keep the course fair: no wall of cones blocking every lane.
  const removed = new Set();
  for (const lane of [0, 1, 2, 3]) {
    for (const obstacle of obstacles) {
      if (obstacle.lane !== lane || obstacle.type === HAZARD.HURDLE || obstacle.type === HAZARD.BARRIER) continue;
      const sameRow = obstacles.filter(
        (other) => other.type === HAZARD.CONE && Math.abs(other.d - obstacle.d) < 1.2,
      );
      if (sameRow.length >= 3) removed.add(obstacle);
    }
  }
  const fairObstacles = obstacles.filter((obstacle) => !removed.has(obstacle));

  fairObstacles.sort((a, b) => a.d - b.d);
  orbs.sort((a, b) => a.d - b.d);

  return { seed, obstacles: fairObstacles, orbs };
}

export function createRivals(seed) {
  const random = mulberry32(seed ^ 0x9e3779b9);
  return RIVAL_BLUEPRINTS.map((blueprint) => ({
    ...blueprint,
    base: blueprint.base + (random() - 0.5) * 0.24,
    speed: 0,
    dist: 0,
    lane: blueprint.lane,
    targetLane: blueprint.lane,
    x: LANES[blueprint.lane],
    jumpY: 0,
    jumpV: 0,
    slide: 0,
    stride: random() * 10,
    think: random() * 0.4,
    finished: false,
    finishTime: null,
    place: null,
    hitFlash: 0,
  }));
}

export function ordinal(place) {
  return place;
}

export const PLACE_LABEL = ['', 'Pertama', 'Kedua', 'Ketiga', 'Keempat'];

export function medalClass(place) {
  if (place === 1) return '';
  if (place === 2) return 'silver';
  if (place === 3) return 'bronze';
  return 'loss';
}

export function courseLengthLabel() {
  return `${Math.round(RACE_LENGTH)} M`;
}

export { clamp };
