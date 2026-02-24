const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  coins: document.getElementById('coins'),
  best: document.getElementById('best'),
  speed: document.getElementById('speed'),
  combo: document.getElementById('combo'),
  streak: document.getElementById('streak'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  tiltBtn: document.getElementById('tiltBtn'),
  fxBtn: document.getElementById('fxBtn'),
  over: document.getElementById('gameOver'),
  finalScore: document.getElementById('finalScore'),
  finalCoins: document.getElementById('finalCoins'),
  finalCombo: document.getElementById('finalCombo'),
  restartBtn: document.getElementById('restartBtn'),
  menuBtn: document.getElementById('menuBtn'),
  startMenu: document.getElementById('startMenu'),
  gameShell: document.getElementById('gameShell')
};

const LANE_X = [-1, 0, 1];
const MAX_Z = 68;
const PLAYER_Z = 3.2;
const BEST_KEY = 'templeSprintNightmareBest';

const FX_LEVEL = {
  HIGH: 'HIGH',
  LOW: 'LOW'
};

const DIFFICULTY_STEPS = [
  { at: 0, speedBoost: 0.18, gapMin: 1.4, gapMax: 2.2, fog: 0.14 },
  { at: 1300, speedBoost: 0.24, gapMin: 1.2, gapMax: 2, fog: 0.18 },
  { at: 2500, speedBoost: 0.28, gapMin: 1.05, gapMax: 1.8, fog: 0.22 },
  { at: 4000, speedBoost: 0.31, gapMin: 0.92, gapMax: 1.55, fog: 0.27 }
];

let state;
let lastTs = 0;
let touchStart = null;
let tiltEnabled = false;
let lastTiltMove = 0;

function rng(a, b) {
  return Math.random() * (b - a) + a;
}

function clamp(v, mn, mx) {
  return Math.max(mn, Math.min(mx, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resetState() {
  state = {
    inMenu: true,
    running: false,
    paused: false,
    gameOver: false,
    fx: FX_LEVEL.HIGH,
    score: 0,
    coins: 0,
    speed: 16,
    lane: 0,
    laneTarget: 0,
    laneOffset: 0,
    jumpT: 0,
    slideT: 0,
    combo: 0,
    bestCombo: 0,
    streak: 0,
    gapTimer: 0,
    coinTimer: 0,
    shardTimer: 0,
    pulse: 0,
    shake: 0,
    fogAmount: 0.14,
    danger: 0,
    gaps: [],
    coinsField: [],
    embers: [],
    fogBands: [],
    trees: [],
    ruins: [],
    ravens: [],
    skulls: []
  };

  bootstrapDecor();
}

function bootstrapDecor() {
  state.embers = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: rng(0.5, 2),
    drift: rng(0.06, 0.24),
    alpha: rng(0.08, 0.3)
  }));

  state.fogBands = Array.from({ length: 14 }, (_, i) => ({
    y: 0.4 + i * 0.04,
    speed: rng(0.02, 0.08),
    phase: Math.random() * Math.PI * 2,
    amp: rng(0.01, 0.05),
    width: rng(0.18, 0.4),
    alpha: rng(0.03, 0.11)
  }));

  state.trees = Array.from({ length: 68 }, (_, i) => ({
    side: i % 2 === 0 ? -1 : 1,
    z: rng(6, MAX_Z),
    height: rng(0.8, 1.5),
    width: rng(0.7, 1.3),
    twist: rng(-0.3, 0.3),
    knuckle: rng(0.2, 0.9)
  }));

  state.ruins = Array.from({ length: 30 }, (_, i) => ({
    side: i % 2 === 0 ? -1 : 1,
    z: rng(8, MAX_Z),
    h: rng(0.6, 1.6),
    w: rng(0.7, 1.2),
    broken: Math.random() < 0.45
  }));

  state.ravens = Array.from({ length: 18 }, () => ({
    x: rng(0.05, 0.95),
    y: rng(0.08, 0.3),
    z: rng(0.2, 1.3),
    speed: rng(0.02, 0.09),
    flap: rng(0, Math.PI * 2)
  }));

  state.skulls = Array.from({ length: 34 }, (_, i) => ({
    side: i % 2 === 0 ? -1 : 1,
    z: rng(7, MAX_Z),
    tilt: rng(-0.4, 0.4),
    glow: rng(0.04, 0.22)
  }));
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function project(x, z, y = 0) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const zn = Math.max(0.2, z / MAX_Z);
  const s = 1 / zn;
  return {
    x: w * 0.5 + x * s * w * 0.14,
    y: h * 0.84 - y * s * h * 0.17,
    scale: s
  };
}

function currentDifficulty() {
  let d = DIFFICULTY_STEPS[0];
  for (let i = 0; i < DIFFICULTY_STEPS.length; i += 1) {
    if (state.score >= DIFFICULTY_STEPS[i].at) d = DIFFICULTY_STEPS[i];
  }
  return d;
}

function runnerY() {
  if (state.jumpT <= 0) return 0;
  const t = 1 - state.jumpT;
  return Math.sin(Math.PI * t) * 1.95;
}

function drawSkyGradient() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#000');
  grad.addColorStop(0.34, '#08090d');
  grad.addColorStop(0.7, '#12090a');
  grad.addColorStop(1, '#140f0e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawMoonAndRift() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.fillStyle = 'rgba(220, 220, 230, 0.09)';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.14, Math.min(w, h) * 0.076, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(178, 26, 26, 0.15)';
  ctx.beginPath();
  ctx.ellipse(w * 0.18, h * 0.19, 140, 50, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(230, 70, 40, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.17);
  ctx.lineTo(w * 0.16, h * 0.16);
  ctx.lineTo(w * 0.21, h * 0.2);
  ctx.lineTo(w * 0.28, h * 0.18);
  ctx.stroke();
}

function drawParallaxSilhouettes() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const layers = [
    { color: '#08110f', y: 0.38, amp: 26, count: 18 },
    { color: '#0b1814', y: 0.47, amp: 30, count: 16 },
    { color: '#0d1f17', y: 0.56, amp: 35, count: 15 },
    { color: '#13241c', y: 0.64, amp: 40, count: 14 }
  ];

  layers.forEach((layer, layerIdx) => {
    ctx.fillStyle = layer.color;
    for (let i = 0; i < layer.count; i += 1) {
      const x = (i / (layer.count - 1)) * w + ((layerIdx * 17) % 34) - 18;
      const baseY = h * layer.y + Math.sin(i * 1.9 + layerIdx * 0.8) * 9;
      const topY = baseY - layer.amp - (i % 4) * 18;
      ctx.beginPath();
      ctx.moveTo(x - 30, h);
      ctx.lineTo(x + 26, h);
      ctx.lineTo(x + 10, topY);
      ctx.lineTo(x - 8, topY + 24);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawFog() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const t = performance.now() * 0.0003;

  state.fogBands.forEach((band, i) => {
    const x = (Math.sin(t * band.speed * 50 + band.phase) * band.amp + 0.5) * w;
    const y = h * band.y;
    const radiusX = w * band.width;
    const radiusY = h * (0.03 + band.amp * 0.15);
    const alpha = band.alpha + state.fogAmount * 0.18;

    const fog = ctx.createRadialGradient(x, y, 0, x, y, radiusX);
    fog.addColorStop(0, `rgba(145, 175, 165, ${alpha})`);
    fog.addColorStop(1, 'rgba(145, 175, 165, 0)');
    ctx.fillStyle = fog;

    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    if (i % 3 === 0 && state.fx === FX_LEVEL.HIGH) {
      const x2 = x + Math.sin(t * 2 + i) * 100;
      ctx.fillStyle = `rgba(180, 220, 210, ${alpha * 0.12})`;
      ctx.fillRect(x2 - 120, y - 8, 240, 16);
    }
  });
}

function drawEmbers() {
  if (state.fx === FX_LEVEL.LOW) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dt = 1 / 60;

  state.embers.forEach((e) => {
    e.y -= dt * e.drift;
    e.x += Math.sin((e.y + e.r) * 20) * 0.0006;
    if (e.y < -0.02) {
      e.y = 1.05;
      e.x = Math.random();
    }

    const x = e.x * w;
    const y = e.y * h;
    ctx.fillStyle = `rgba(245, 108, 47, ${e.alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, e.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawRavens() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const t = performance.now() * 0.002;

  state.ravens.forEach((r, i) => {
    r.x += r.speed * 0.002;
    if (r.x > 1.1) {
      r.x = -0.1;
      r.y = rng(0.08, 0.34);
    }

    const px = r.x * w;
    const py = r.y * h + Math.sin(t + r.flap + i) * 4;
    const wing = 9 + Math.sin(t * 8 + r.flap) * 4;

    ctx.strokeStyle = 'rgba(20, 20, 24, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - wing, py + 1);
    ctx.lineTo(px, py - 3);
    ctx.lineTo(px + wing, py + 1);
    ctx.stroke();
  });
}

function drawSideTrees() {
  state.trees.forEach((tree) => {
    const p = project(tree.side * 2.2, tree.z, 0);
    const trunkW = p.scale * 12 * tree.width;
    const trunkH = p.scale * 76 * tree.height;

    ctx.fillStyle = '#2a1e15';
    ctx.fillRect(p.x - trunkW / 2, p.y - trunkH, trunkW, trunkH);

    ctx.fillStyle = 'rgba(22, 55, 38, 0.98)';
    ctx.beginPath();
    ctx.ellipse(
      p.x + tree.twist * trunkW,
      p.y - trunkH - p.scale * 20,
      p.scale * 22 * tree.width,
      p.scale * 18,
      tree.twist,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = 'rgba(18, 30, 22, 0.8)';
    ctx.beginPath();
    ctx.arc(p.x - tree.side * p.scale * 3, p.y - trunkH * tree.knuckle, p.scale * 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawRuins() {
  state.ruins.forEach((r) => {
    const p = project(r.side * 1.82, r.z, 0);
    const w = p.scale * 20 * r.w;
    const h = p.scale * 46 * r.h;

    ctx.fillStyle = '#4d3a2e';
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);

    ctx.fillStyle = '#36291f';
    ctx.fillRect(p.x - w / 2, p.y - h, w, p.scale * 6);

    if (r.broken) {
      ctx.fillStyle = 'rgba(15, 12, 10, 0.8)';
      ctx.beginPath();
      ctx.moveTo(p.x - w * 0.2, p.y - h);
      ctx.lineTo(p.x + w * 0.4, p.y - h + p.scale * 10);
      ctx.lineTo(p.x + w * 0.12, p.y - h + p.scale * 20);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(20, 14, 10, 0.6)';
    ctx.lineWidth = Math.max(1, p.scale * 1.8);
    for (let i = 0; i < 3; i += 1) {
      const sy = p.y - h + (i + 1) * (h / 4);
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2, sy);
      ctx.lineTo(p.x + w / 2, sy);
      ctx.stroke();
    }
  });
}

function drawSkulls() {
  state.skulls.forEach((s) => {
    const p = project(s.side * 1.55, s.z, 0.04);
    if (p.scale < 0.55) return;

    const r = p.scale * 5;
    ctx.fillStyle = '#cbc2ae';
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 1.2, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(12, 13, 15, 0.86)';
    ctx.beginPath();
    ctx.arc(p.x - r * 0.33, p.y - r * 1.35, r * 0.2, 0, Math.PI * 2);
    ctx.arc(p.x + r * 0.33, p.y - r * 1.35, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

    if (state.fx === FX_LEVEL.HIGH) {
      ctx.fillStyle = `rgba(245, 80, 45, ${s.glow})`;
      ctx.beginPath();
      ctx.arc(p.x - r * 0.33, p.y - r * 1.35, r * 0.18, 0, Math.PI * 2);
      ctx.arc(p.x + r * 0.33, p.y - r * 1.35, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawGroundAbyss() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const abyss = ctx.createLinearGradient(0, h * 0.64, 0, h);
  abyss.addColorStop(0, 'rgba(11, 12, 16, 0.2)');
  abyss.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = abyss;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);

  if (state.fx === FX_LEVEL.HIGH) {
    for (let i = 0; i < 10; i += 1) {
      const x = (i / 9) * w + Math.sin(performance.now() * 0.001 + i) * 18;
      const y = h * (0.73 + (i % 3) * 0.06);
      ctx.fillStyle = 'rgba(245, 108, 47, 0.07)';
      ctx.beginPath();
      ctx.ellipse(x, y, 80, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function isGapAt(z) {
  return state.gaps.some((g) => z >= g.z && z <= g.z + g.length);
}

function drawRoadSegment(near, far, wn, wf, color) {
  ctx.beginPath();
  ctx.moveTo(near.x - wn, near.y);
  ctx.lineTo(near.x + wn, near.y);
  ctx.lineTo(far.x + wf, far.y);
  ctx.lineTo(far.x - wf, far.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawGapSegment(near, far, wn, wf) {
  const grad = ctx.createLinearGradient(0, far.y, 0, near.y);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
  grad.addColorStop(1, 'rgba(22, 5, 6, 0.75)');
  drawRoadSegment(near, far, wn, wf, grad);

  if (state.fx === FX_LEVEL.HIGH) {
    ctx.strokeStyle = 'rgba(245, 90, 42, 0.18)';
    ctx.lineWidth = Math.max(1, near.scale * 1.8);
    ctx.beginPath();
    ctx.moveTo(near.x - wn, near.y);
    ctx.lineTo(far.x - wf, far.y);
    ctx.moveTo(near.x + wn, near.y);
    ctx.lineTo(far.x + wf, far.y);
    ctx.stroke();
  }
}

function drawRoad() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (let z = MAX_Z; z >= 1; z -= 1) {
    const near = project(0, z);
    const far = project(0, z + 1);
    const wn = near.scale * 146;
    const wf = far.scale * 146;

    if (isGapAt(z + 0.2)) {
      drawGapSegment(near, far, wn, wf);
      continue;
    }

    const base = z % 2 === 0 ? '#5e4a3a' : '#4f3d31';
    drawRoadSegment(near, far, wn, wf, base);

    ctx.strokeStyle = 'rgba(16, 12, 10, 0.66)';
    ctx.lineWidth = Math.max(1, near.scale * 2.2);
    ctx.stroke();

    if (z % 3 === 0) {
      const seamL = project(-0.34, z);
      const seamR = project(-0.34, z + 1);
      const seamL2 = project(0.34, z);
      const seamR2 = project(0.34, z + 1);
      ctx.strokeStyle = 'rgba(11, 9, 7, 0.72)';
      ctx.lineWidth = Math.max(1, near.scale * 1.6);
      ctx.beginPath();
      ctx.moveTo(seamL.x, seamL.y);
      ctx.lineTo(seamR.x, seamR.y);
      ctx.moveTo(seamL2.x, seamL2.y);
      ctx.lineTo(seamR2.x, seamR2.y);
      ctx.stroke();
    }

    if (z % 6 === 0) {
      ctx.fillStyle = 'rgba(245, 90, 42, 0.08)';
      ctx.fillRect(near.x - wn * 0.6, near.y - near.scale * 4, wn * 1.2, near.scale * 2.4);
    }

    if (z < 12) {
      ctx.fillStyle = 'rgba(4, 6, 7, 0.72)';
      ctx.fillRect(0, near.y, w, h - near.y);
    }
  }
}

function drawCoin(c) {
  const p = project(LANE_X[c.lane + 1], c.z, 0.7 + Math.sin(c.spin) * 0.08);
  const r = p.scale * 8;

  ctx.fillStyle = '#edcb4f';
  ctx.strokeStyle = '#936e18';
  ctx.lineWidth = Math.max(1, p.scale * 2);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - p.scale * 12, r, r * (0.75 + Math.sin(c.spin) * 0.25), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (state.fx === FX_LEVEL.HIGH) {
    ctx.fillStyle = 'rgba(250, 205, 80, 0.16)';
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.scale * 12, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoins() {
  state.coinsField.sort((a, b) => b.z - a.z).forEach(drawCoin);
}

function drawRunnerShadow(p, s) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + s * 1.05, s * 0.45, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRunnerBody(p, s) {
  if (state.slideT > 0) {
    ctx.fillStyle = '#d7d2c4';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s * 0.32, s * 0.78, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9d6140';
    ctx.beginPath();
    ctx.arc(p.x + s * 0.5, p.y - s * 0.42, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // torso
  ctx.fillStyle = '#dbd6c8';
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.28, p.y - s * 0.1);
  ctx.quadraticCurveTo(p.x - s * 0.38, p.y - s * 0.72, p.x, p.y - s * 1.0);
  ctx.quadraticCurveTo(p.x + s * 0.38, p.y - s * 0.72, p.x + s * 0.28, p.y - s * 0.1);
  ctx.quadraticCurveTo(p.x, p.y + s * 0.18, p.x - s * 0.28, p.y - s * 0.1);
  ctx.fill();

  // head
  ctx.fillStyle = '#8f5a3a';
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 1.18, s * 0.19, 0, Math.PI * 2);
  ctx.fill();

  // arms
  ctx.strokeStyle = '#4f3026';
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.18, p.y - s * 0.6);
  ctx.lineTo(p.x - s * 0.46, p.y - s * 0.35);
  ctx.moveTo(p.x + s * 0.18, p.y - s * 0.6);
  ctx.lineTo(p.x + s * 0.46, p.y - s * 0.3);
  ctx.stroke();

  // legs
  ctx.strokeStyle = '#2b3038';
  ctx.lineWidth = Math.max(2, s * 0.14);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.08, p.y + s * 0.1);
  ctx.lineTo(p.x - s * 0.18, p.y + s * 0.95);
  ctx.moveTo(p.x + s * 0.08, p.y + s * 0.1);
  ctx.lineTo(p.x + s * 0.2, p.y + s * 0.95);
  ctx.stroke();

  // chest sash
  ctx.strokeStyle = '#b74130';
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(p.x - s * 0.2, p.y - s * 0.76);
  ctx.lineTo(p.x + s * 0.2, p.y - s * 0.24);
  ctx.stroke();
}

function drawRunnerAura(p, s) {
  if (state.fx === FX_LEVEL.LOW) return;
  const pulse = 0.08 + Math.sin(state.pulse * 3) * 0.03;
  ctx.fillStyle = `rgba(245, 90, 45, ${pulse})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - s * 0.3, s * 0.85, s * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRunner() {
  const p = project(state.laneOffset, PLAYER_Z, runnerY());
  const s = p.scale * 24;
  drawRunnerShadow(p, s);
  drawRunnerAura(p, s);
  drawRunnerBody(p, s);
}

function drawDangerVeil() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const alpha = clamp(state.danger * 0.2, 0, 0.22);
  if (alpha <= 0.001) return;

  ctx.fillStyle = `rgba(180, 18, 18, ${alpha})`;
  ctx.fillRect(0, 0, w, h);

  if (state.fx === FX_LEVEL.HIGH) {
    ctx.strokeStyle = `rgba(245, 88, 48, ${alpha * 1.3})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, w, h);
  }
}

function drawPursuerSilhouette() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const t = performance.now() * 0.002;
  const y = h * 0.82 + Math.sin(t * 4) * 3;
  const x = w * 0.5 + Math.sin(t) * 5;

  const size = 34 + clamp(state.speed - 16, 0, 20) * 0.5;
  ctx.fillStyle = 'rgba(20, 12, 12, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.fx === FX_LEVEL.HIGH) {
    ctx.fillStyle = `rgba(245, 70, 42, ${0.07 + state.danger * 0.09})`;
    ctx.beginPath();
    ctx.arc(x - size * 0.2, y - size * 0.1, 3, 0, Math.PI * 2);
    ctx.arc(x + size * 0.2, y - size * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLightningFlash() {
  if (state.fx === FX_LEVEL.LOW) return;
  if (Math.random() > 0.004) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const x0 = rng(w * 0.05, w * 0.95);
  let x = x0;
  let y = 0;

  ctx.strokeStyle = 'rgba(212, 230, 255, 0.26)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  while (y < h * 0.42) {
    x += rng(-20, 20);
    y += rng(10, 24);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(204, 225, 255, 0.06)';
  ctx.fillRect(0, 0, w, h * 0.5);
}

function spawnGap() {
  const d = currentDifficulty();
  state.gaps.push({
    z: MAX_Z + Math.random() * 6,
    length: rng(1.7, 2.6),
    intensity: rng(0.3, 1)
  });
  state.gapTimer = rng(d.gapMin, d.gapMax);
}

function spawnCoins() {
  const lane = Math.floor(Math.random() * 3) - 1;
  const count = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i += 1) {
    state.coinsField.push({ lane, z: MAX_Z + i * 2.25, spin: rng(0, Math.PI * 2) });
  }
  state.coinTimer = rng(1.2, 2.2);
}

function moveLane(delta) {
  state.laneTarget = clamp(state.laneTarget + delta, -1, 1);
}

function jump() {
  if (state.jumpT <= 0 && state.slideT <= 0) state.jumpT = 1;
}

function slide() {
  if (state.slideT <= 0 && state.jumpT <= 0) state.slideT = 0.68;
}

function addCombo(amount = 1) {
  state.combo += amount;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.streak += amount;
}

function breakCombo() {
  state.combo = 0;
  state.streak = 0;
}

function updateDifficulty(dt) {
  const d = currentDifficulty();
  state.speed = Math.min(38, state.speed + dt * d.speedBoost);
  state.fogAmount = lerp(state.fogAmount, d.fog, dt * 2.2);
}

function updateMovement(dt) {
  state.jumpT = Math.max(0, state.jumpT - dt * 1.66);
  state.slideT = Math.max(0, state.slideT - dt);

  const target = LANE_X[state.laneTarget + 1];
  state.laneOffset += (target - state.laneOffset) * Math.min(1, dt * 13.5);
  if (Math.abs(target - state.laneOffset) < 0.02) {
    state.laneOffset = target;
    state.lane = state.laneTarget;
  }
}

function updateSpawners(dt) {
  state.gapTimer -= dt;
  state.coinTimer -= dt;

  if (state.gapTimer <= 0) spawnGap();
  if (state.coinTimer <= 0) spawnCoins();
}

function updateWorld(dt) {
  state.gaps.forEach((g) => { g.z -= dt * state.speed; });
  state.coinsField.forEach((c) => {
    c.z -= dt * state.speed;
    c.spin += dt * 6;
  });

  state.trees.forEach((t) => {
    t.z -= dt * state.speed;
    if (t.z <= 0) t.z = MAX_Z + rng(0, 8);
  });

  state.ruins.forEach((r) => {
    r.z -= dt * state.speed;
    if (r.z <= 0) r.z = MAX_Z + rng(4, 12);
  });

  state.skulls.forEach((s) => {
    s.z -= dt * state.speed;
    if (s.z <= 0) s.z = MAX_Z + rng(6, 14);
  });

  state.gaps = state.gaps.filter((g) => g.z + g.length > 0);
}

function collectCoins() {
  state.coinsField = state.coinsField.filter((c) => {
    const got = Math.abs(c.z - PLAYER_Z) < 0.9 && c.lane === state.lane;
    if (got) {
      state.coins += 1;
      addCombo(1);
      return false;
    }
    return c.z > 0;
  });
}

function detectGapCollision() {
  for (let i = 0; i < state.gaps.length; i += 1) {
    const g = state.gaps[i];
    const inGap = PLAYER_Z >= g.z && PLAYER_Z <= g.z + g.length;
    if (inGap) {
      if (state.jumpT <= 0.23) {
        triggerGameOver();
        return;
      }
      addCombo(2);
      state.gaps.splice(i, 1);
      i -= 1;
    }
  }
}

function updateScoring(dt) {
  const comboMul = 1 + Math.floor(state.combo / 10) * 0.2;
  state.score += dt * state.speed * 6 * comboMul;
}

function updateDanger(dt) {
  const nearGap = state.gaps.some((g) => g.z < 8 && g.z > 2.4);
  const targetDanger = nearGap ? 1 : 0;
  state.danger = lerp(state.danger, targetDanger, dt * 4.2);
}

function updateAtmosphere(dt) {
  state.pulse += dt;
  state.shake = Math.max(0, state.shake - dt * 2.8);
  if (Math.random() < 0.0025 && state.fx === FX_LEVEL.HIGH) state.shake = 0.5;
}

function updateHud() {
  const total = Math.floor(state.score + state.coins * 11 + state.bestCombo * 5);
  ui.score.textContent = String(total);
  ui.coins.textContent = String(state.coins);
  ui.speed.textContent = `${(state.speed / 16).toFixed(1)}x`;
  ui.combo.textContent = String(state.combo);
  ui.streak.textContent = String(state.streak);
  ui.best.textContent = localStorage.getItem(BEST_KEY) || '0';
}

function triggerGameOver() {
  state.running = false;
  state.gameOver = true;
  ui.pauseBtn.disabled = true;

  const total = Math.floor(state.score + state.coins * 11 + state.bestCombo * 5);
  const best = Number(localStorage.getItem(BEST_KEY) || 0);
  if (total > best) localStorage.setItem(BEST_KEY, String(total));

  ui.finalScore.textContent = String(total);
  ui.finalCoins.textContent = String(state.coins);
  ui.finalCombo.textContent = String(state.bestCombo);
  ui.over.classList.remove('hidden');
  updateHud();
}

function update(dt) {
  if (!state.running || state.paused || state.gameOver) return;

  updateDifficulty(dt);
  updateMovement(dt);
  updateSpawners(dt);
  updateWorld(dt);
  collectCoins();
  detectGapCollision();
  if (state.gameOver) return;
  updateScoring(dt);
  updateDanger(dt);
  updateAtmosphere(dt);
  updateHud();
}

function withCameraShake(drawFn) {
  if (state.shake <= 0 || state.fx === FX_LEVEL.LOW) {
    drawFn();
    return;
  }

  const magnitude = state.shake * 5;
  const ox = rng(-magnitude, magnitude);
  const oy = rng(-magnitude * 0.6, magnitude * 0.6);

  ctx.save();
  ctx.translate(ox, oy);
  drawFn();
  ctx.restore();
}

function renderScene() {
  drawSkyGradient();
  drawMoonAndRift();
  drawParallaxSilhouettes();
  drawRavens();
  drawFog();
  drawGroundAbyss();
  drawSideTrees();
  drawRuins();
  drawSkulls();
  drawRoad();
  drawCoins();
  drawRunner();
  drawPursuerSilhouette();
  drawDangerVeil();
  drawLightningFlash();
  drawEmbers();
}

function draw() {
  withCameraShake(renderScene);
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function startRun() {
  state.running = true;
  state.inMenu = false;
  state.gameOver = false;
  state.paused = false;
  ui.startMenu.classList.add('hidden');
  ui.gameShell.classList.remove('hidden');
  ui.over.classList.add('hidden');
  ui.pauseBtn.disabled = false;
  ui.pauseBtn.textContent = 'Pause';
}

function restart() {
  const fx = state.fx;
  resetState();
  state.fx = fx;
  ui.fxBtn.textContent = `FX: ${state.fx}`;
  startRun();
  updateHud();
}

function backToMenu() {
  const fx = state.fx;
  resetState();
  state.fx = fx;
  ui.fxBtn.textContent = `FX: ${state.fx}`;
  ui.over.classList.add('hidden');
  ui.gameShell.classList.add('hidden');
  ui.startMenu.classList.remove('hidden');
  ui.pauseBtn.disabled = true;
  updateHud();
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
}

function toggleFx() {
  state.fx = state.fx === FX_LEVEL.HIGH ? FX_LEVEL.LOW : FX_LEVEL.HIGH;
  ui.fxBtn.textContent = `FX: ${state.fx}`;
}

ui.startBtn.addEventListener('click', restart);
ui.restartBtn.addEventListener('click', restart);
ui.menuBtn.addEventListener('click', backToMenu);
ui.pauseBtn.addEventListener('click', togglePause);
ui.fxBtn.addEventListener('click', toggleFx);

window.addEventListener('keydown', (e) => {
  if (!state.running || state.gameOver) return;

  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveLane(-1);
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveLane(1);
  if (e.key === 'ArrowUp' || e.key === ' ') jump();
  if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') slide();
  if (e.key.toLowerCase() === 'p') togglePause();
});

window.addEventListener('touchstart', (e) => {
  if (!state.running || state.gameOver) return;
  const target = e.target;
  if (target && target.closest && target.closest('button')) return;
  e.preventDefault();
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!state.running || state.gameOver) return;
  e.preventDefault();
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (!state.running || state.gameOver) return;
  const target = e.target;
  if (target && target.closest && target.closest('button')) return;
  e.preventDefault();
  if (!touchStart) return;

  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const elapsed = performance.now() - touchStart.time;

  if (elapsed < 650 && Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
    if (Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      jump();
    } else {
      slide();
    }
  }

  touchStart = null;
}, { passive: false });

async function enableTilt() {
  if (typeof DeviceOrientationEvent === 'undefined') {
    ui.tiltBtn.textContent = 'Tilt unavailable';
    ui.tiltBtn.disabled = true;
    return;
  }

  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') {
        ui.tiltBtn.textContent = 'Tilt denied';
        return;
      }
    }
    tiltEnabled = true;
    ui.tiltBtn.textContent = 'Tilt enabled';
  } catch {
    ui.tiltBtn.textContent = 'Tilt blocked';
  }
}

ui.tiltBtn.addEventListener('click', enableTilt);

window.addEventListener('deviceorientation', (e) => {
  if (!tiltEnabled || !state.running || state.paused || state.gameOver) return;

  const now = performance.now();
  if (now - lastTiltMove < 240) return;

  const gamma = e.gamma || 0;
  if (gamma > 10) {
    moveLane(1);
    lastTiltMove = now;
  } else if (gamma < -10) {
    moveLane(-1);
    lastTiltMove = now;
  }
});

window.addEventListener('resize', resize);

resetState();
resize();
updateHud();
ui.gameShell.classList.add('hidden');
requestAnimationFrame(loop);
