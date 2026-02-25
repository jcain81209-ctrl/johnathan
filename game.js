const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  coins: document.getElementById('coins'),
  best: document.getElementById('best'),
  speed: document.getElementById('speed'),
  combo: document.getElementById('combo'),
  streak: document.getElementById('streak'),
  buffs: document.getElementById('buffs'),
  fear: document.getElementById('fear'),
  pauseBtn: document.getElementById('pauseBtn'),
  tiltBtn: document.getElementById('tiltBtn'),
  fxBtn: document.getElementById('fxBtn'),
  spriteBtn: document.getElementById('spriteBtn'),
  over: document.getElementById('gameOver'),
  finalScore: document.getElementById('finalScore'),
  finalCoins: document.getElementById('finalCoins'),
  finalCombo: document.getElementById('finalCombo'),
  restartBtn: document.getElementById('restartBtn')
};

const LANE_X = [-0.6, 0, 0.6];
const MAX_Z = 72;
const PLAYER_Z = 5;
const BEST_KEY = 'templeSprintNightmareBest';
const FX = { HIGH: 'HIGH', LOW: 'LOW' };
const SPRITE_THEMES = ['HERO', 'WRAITH', 'GOLD'];

const POWERUPS = {
  MAGNET: 'magnet',
  SPEED: 'speed',
  INVINCIBLE: 'invincible'
};

const DIFFICULTY = [
  { at: 0, speedAdd: 0.16, gapEvery: [1.6, 2.4], coinEvery: [1.2, 2.0], powerEvery: [8, 12], fog: 0.1 },
  { at: 1800, speedAdd: 0.22, gapEvery: [1.35, 2.05], coinEvery: [1.0, 1.8], powerEvery: [7, 11], fog: 0.15 },
  { at: 3400, speedAdd: 0.27, gapEvery: [1.1, 1.8], coinEvery: [0.9, 1.55], powerEvery: [6, 9], fog: 0.2 },
  { at: 5200, speedAdd: 0.31, gapEvery: [0.92, 1.5], coinEvery: [0.8, 1.3], powerEvery: [5, 8], fog: 0.24 }
];

let state;
let lastTs = 0;
let touchStart = null;
let tiltEnabled = false;
let lastTilt = 0;

const rand = (a, b) => Math.random() * (b - a) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function currentDiff() {
  let d = DIFFICULTY[0];
  for (let i = 0; i < DIFFICULTY.length; i += 1) {
    if (state.score >= DIFFICULTY[i].at) d = DIFFICULTY[i];
  }
  return d;
}

function resetState() {
  state = {
    running: false,
    paused: false,
    gameOver: false,
    speed: 15,
    score: 0,
    coins: 0,
    lane: 0,
    laneTarget: 0,
    laneOffset: 0,
    jumpT: 0,
    combo: 0,
    streak: 0,
    bestCombo: 0,
    graceT: 1.2,

    fx: FX.HIGH,
    fog: 0.1,
    bgScroll: 0,
    pulse: 0,
    shake: 0,
    camBob: 0,
    camYaw: 0,
    roadCurve: 0.0,
    worldTick: 0,
    terror: 0,
    eventTimer: rand(6, 11),
    bloodRainT: 0,

    gapTimer: 0,
    coinTimer: 0,
    powerTimer: 0,

    gaps: [],
    coinsField: [],
    powerups: [],

    magnetT: 0,
    speedBoostT: 0,
    invincibleT: 0,

    spriteTheme: 'HERO',
    spriteClock: 0,
    spriteFrames: null,

    particles: Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random(), r: rand(0.4, 2), drift: rand(0.04, 0.2), a: rand(0.08, 0.28)
    })),
    fogBands: Array.from({ length: 12 }, (_, i) => ({
      y: 0.46 + i * 0.04, phase: Math.random() * 6.28, amp: rand(0.015, 0.05), width: rand(0.2, 0.45), a: rand(0.03, 0.11)
    })),
    trees: Array.from({ length: 64 }, (_, i) => ({ side: i % 2 ? 1 : -1, z: rand(6, MAX_Z), h: rand(0.8, 1.5), w: rand(0.7, 1.3) }))
  };
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Overhead-ish projection (requested "view from above")
function project(x, z, y = 0) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const curveX = Math.sin((z + state.worldTick * 8) * 0.11) * state.roadCurve;
  const depth = z * 0.12 + 0.55;
  const persp = 1 / depth;
  const worldX = x + curveX + state.camYaw;
  return {
    x: w * 0.5 + worldX * persp * w * 0.42,
    y: h * 0.88 - (1.15 + y - state.camBob) * persp * h * 0.55,
    scale: persp * 1.8
  };
}

function runnerY() {
  if (state.jumpT <= 0) return 0;
  const t = 1 - state.jumpT;
  return Math.sin(Math.PI * t) * 1.8;
}

function buildRunnerSpriteSet(theme = 'HERO') {
  const base = document.createElement('canvas');
  base.width = 64;
  base.height = 96;
  const c = base.getContext('2d');

  const palettes = {
    HERO: { hair: '#ca5f34', skin: '#efcfac', shirt: '#d8c89f', pants: '#2f4d53', belt: '#6d4b36' },
    WRAITH: { hair: '#dfe8ee', skin: '#c8d0d6', shirt: '#6a7a82', pants: '#24363b', belt: '#324044' },
    GOLD: { hair: '#b85b2d', skin: '#f0d1b5', shirt: '#e0c971', pants: '#4f5036', belt: '#8d6f37' }
  };
  const P = palettes[theme] || palettes.HERO;

  function drawFrame(armSwing = 0, legSwing = 0, jump = 0) {
    c.clearRect(0, 0, 64, 96);
    const cy = 62 - jump * 10;

    c.strokeStyle = P.pants;
    c.lineWidth = 8;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(30, cy);
    c.lineTo(26 + legSwing, 88);
    c.moveTo(34, cy);
    c.lineTo(39 - legSwing, 87);
    c.stroke();

    c.fillStyle = P.shirt;
    c.beginPath();
    c.moveTo(20, cy - 2);
    c.quadraticCurveTo(16, cy - 28, 32, cy - 42);
    c.quadraticCurveTo(48, cy - 28, 44, cy - 2);
    c.quadraticCurveTo(32, cy + 8, 20, cy - 2);
    c.fill();

    c.fillStyle = P.belt;
    c.fillRect(21, cy - 2, 22, 4);

    c.strokeStyle = P.skin;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(24, cy - 22);
    c.lineTo(12 + armSwing, cy - 12);
    c.moveTo(40, cy - 22);
    c.lineTo(52 - armSwing, cy - 13);
    c.stroke();

    c.fillStyle = P.skin;
    c.beginPath();
    c.ellipse(32, cy - 50, 8, 9, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = P.hair;
    c.beginPath();
    c.arc(32, cy - 54, 8, Math.PI, Math.PI * 2);
    c.fill();

    const frame = document.createElement('canvas');
    frame.width = 64;
    frame.height = 96;
    frame.getContext('2d').drawImage(base, 0, 0);
    return frame;
  }

  return {
    idle: [drawFrame(0, 0, 0)],
    run: [drawFrame(-3, 2, 0), drawFrame(2, -2, 0), drawFrame(-1, 1, 0), drawFrame(3, -1, 0)],
    jump: [drawFrame(1, 0, 1)]
  };
}

function drawBg() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  state.bgScroll += state.speed * 0.00035;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#010103');
  g.addColorStop(0.4, '#061015');
  g.addColorStop(1, '#180f0d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Scrolling parallax silhouettes
  for (let layer = 0; layer < 4; layer += 1) {
    const color = ['#07110f', '#0a1714', '#0d1e18', '#12251d'][layer];
    const offset = ((state.bgScroll * (30 + layer * 20)) % w);
    ctx.fillStyle = color;
    for (let i = -1; i < 16; i += 1) {
      const x = i * (w / 12) - offset;
      const base = h * (0.36 + layer * 0.11) + Math.sin(i + layer) * 8;
      ctx.beginPath();
      ctx.moveTo(x - 30, h);
      ctx.lineTo(x + 24, h);
      ctx.lineTo(x + 10, base - (42 + layer * 25 + (i % 3) * 12));
      ctx.lineTo(x - 12, base - 12);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawFogLighting() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const t = performance.now() * 0.0003;

  state.fogBands.forEach((b, i) => {
    const x = (Math.sin(t * (40 + i) + b.phase) * b.amp + 0.5) * w;
    const y = h * b.y;
    const rx = w * b.width;
    const ry = h * 0.035;
    const a = b.a + state.fog * 0.2;

    const rg = ctx.createRadialGradient(x, y, 0, x, y, rx);
    rg.addColorStop(0, `rgba(160,190,182,${a})`);
    rg.addColorStop(1, 'rgba(160,190,182,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // pseudo-shader lighting pass
  ctx.fillStyle = `rgba(255, 88, 42, ${0.03 + Math.sin(state.pulse * 2) * 0.015})`;
  ctx.fillRect(0, h * 0.63, w, h * 0.37);
}

function drawParticles() {
  if (state.fx === FX.LOW) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (const p of state.particles) {
    p.y -= p.drift * 0.003;
    if (p.y < -0.02) { p.y = 1.05; p.x = Math.random(); }
    ctx.fillStyle = `rgba(245, 110, 55, ${p.a})`;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}


function drawDepthWalls() {
  for (let z = MAX_Z; z >= 2; z -= 1) {
    const l1 = project(-1.45, z, -0.15);
    const l2 = project(-1.75, z + 1, 0.05);
    const r1 = project(1.45, z, -0.15);
    const r2 = project(1.75, z + 1, 0.05);

    ctx.fillStyle = z % 2 ? 'rgba(34,20,18,0.6)' : 'rgba(24,14,14,0.6)';
    ctx.beginPath();
    ctx.moveTo(l1.x, l1.y);
    ctx.lineTo(l1.x - l1.scale * 20, l1.y + l1.scale * 24);
    ctx.lineTo(l2.x - l2.scale * 24, l2.y + l2.scale * 20);
    ctx.lineTo(l2.x, l2.y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(r1.x, r1.y);
    ctx.lineTo(r1.x + r1.scale * 20, r1.y + r1.scale * 24);
    ctx.lineTo(r2.x + r2.scale * 24, r2.y + r2.scale * 20);
    ctx.lineTo(r2.x, r2.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawVolumetricLights() {
  if (state.fx === FX.LOW) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < 4; i += 1) {
    const x = w * (0.15 + i * 0.23) + Math.sin(state.worldTick * 1.2 + i) * 30;
    const y = h * 0.16;
    const beam = ctx.createLinearGradient(x, y, x, h);
    beam.addColorStop(0, 'rgba(255,145,95,0.11)');
    beam.addColorStop(1, 'rgba(255,145,95,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x + 16, y);
    ctx.lineTo(x + 130, h);
    ctx.lineTo(x - 130, h);
    ctx.closePath();
    ctx.fill();
  }

  if (state.bloodRainT > 0) {
    ctx.fillStyle = 'rgba(180,20,20,0.09)';
    ctx.fillRect(0, 0, w, h);
  }
}

function drawBloodRain() {
  if (state.fx === FX.LOW || state.bloodRainT <= 0) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < 45; i += 1) {
    const x = (i / 45) * w + Math.sin(state.worldTick * 6 + i) * 18;
    const y = ((state.worldTick * 380 + i * 37) % (h + 80)) - 40;
    ctx.strokeStyle = 'rgba(165,25,25,0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 16);
    ctx.stroke();
  }
}

function updateAdaptiveDirector(dt) {
  state.eventTimer -= dt;
  state.worldTick += dt;
  const targetCurve = 0.08 + Math.sin(state.worldTick * 0.35) * 0.04;
  state.roadCurve = lerp(state.roadCurve, targetCurve, dt * 0.7);

  const danger = state.gaps.some((g) => g.z < 9 && g.z > 2) ? 1 : 0;
  state.terror = lerp(state.terror, danger + (state.speed / 40), dt * 1.2);
  state.camBob = Math.sin(state.worldTick * (7 + state.speed * 0.12)) * 0.03;
  state.camYaw = Math.sin(state.worldTick * 0.8) * 0.06;

  if (state.eventTimer <= 0) {
    state.bloodRainT = rand(2.2, 4.5);
    state.shake = 0.18;
    state.eventTimer = rand(7, 13);
  }
  state.bloodRainT = Math.max(0, state.bloodRainT - dt);
  state.shake = Math.max(0, state.shake - dt * 0.5);
}

function drawTrees() {
  for (const tr of state.trees) {
    const p = project(tr.side * 1.7, tr.z, 0);
    const tw = p.scale * 10 * tr.w;
    const th = p.scale * 56 * tr.h;
    ctx.fillStyle = '#2a1f17';
    ctx.fillRect(p.x - tw / 2, p.y - th, tw, th);
    ctx.fillStyle = 'rgba(20,60,40,0.95)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - th - p.scale * 10, p.scale * 18, p.scale * 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoad() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (let z = MAX_Z; z >= 1; z -= 1) {
    const near = project(0, z);
    const far = project(0, z + 1);
    const wn = near.scale * 128;
    const wf = far.scale * 128;

    const inGap = state.gaps.some((g) => z >= g.z && z <= g.z + g.length);
    ctx.beginPath();
    ctx.moveTo(near.x - wn, near.y);
    ctx.lineTo(near.x + wn, near.y);
    ctx.lineTo(far.x + wf, far.y);
    ctx.lineTo(far.x - wf, far.y);
    ctx.closePath();

    if (inGap) {
      const gg = ctx.createLinearGradient(0, far.y, 0, near.y);
      gg.addColorStop(0, 'rgba(0,0,0,0.95)');
      gg.addColorStop(1, 'rgba(23,7,8,0.8)');
      ctx.fillStyle = gg;
      ctx.fill();
      continue;
    }

    ctx.fillStyle = z % 2 ? '#4f3f32' : '#5c4b3c';
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 11, 9, 0.65)';
    ctx.lineWidth = Math.max(1, near.scale * 1.7);
    ctx.stroke();

    if (z % 3 === 0) {
      const l1 = project(-0.3, z), l2 = project(-0.3, z + 1);
      const r1 = project(0.3, z), r2 = project(0.3, z + 1);
      ctx.strokeStyle = 'rgba(10,8,7,0.65)';
      ctx.beginPath();
      ctx.moveTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y);
      ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y);
      ctx.stroke();
    }

    if (z < 12) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, near.y, w, h - near.y);
    }
  }
}

function drawCoin(c) {
  const p = project(LANE_X[c.lane + 1], c.z, 0.65 + Math.sin(c.spin) * 0.05);
  const r = p.scale * 7;
  ctx.fillStyle = '#efcd52';
  ctx.strokeStyle = '#8e6c17';
  ctx.lineWidth = Math.max(1, p.scale * 1.6);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - p.scale * 10, r, r * (0.7 + Math.sin(c.spin) * 0.3), 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
}

function drawPowerUp(pu) {
  const p = project(LANE_X[pu.lane + 1], pu.z, 0.75);
  const r = p.scale * 8;
  const color = pu.kind === POWERUPS.MAGNET ? '#7ea0ff' : pu.kind === POWERUPS.SPEED ? '#ff8f4d' : '#a7ffd2';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - p.scale * 12, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.font = `${Math.max(9, p.scale * 8)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letter = pu.kind === POWERUPS.MAGNET ? 'M' : pu.kind === POWERUPS.SPEED ? 'S' : 'I';
  ctx.fillText(letter, p.x, p.y - p.scale * 12);
}

function drawCollectibles() {
  state.coinsField.sort((a, b) => b.z - a.z).forEach(drawCoin);
  state.powerups.sort((a, b) => b.z - a.z).forEach(drawPowerUp);
}

function drawRunner() {
  const p = project(state.laneOffset, PLAYER_Z, runnerY());
  const s = p.scale * 20;
  const x = clamp(p.x, 28, window.innerWidth - 28);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, p.y + s * 0.85, s * 0.45, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!state.spriteFrames) state.spriteFrames = buildRunnerSpriteSet(state.spriteTheme);
  state.spriteClock += 0.016 * (state.speed / 12);

  const set = state.spriteFrames;
  const frames = state.jumpT > 0.05 ? set.jump : set.run;
  const frame = frames[Math.floor(state.spriteClock) % frames.length] || set.idle[0];

  const w = s * 1.6;
  const h = s * 2.4;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frame, x - w / 2, p.y - h * 1.05, w, h);
  ctx.imageSmoothingEnabled = true;

  if (state.invincibleT > 0) {
    ctx.strokeStyle = 'rgba(180,255,225,0.6)';
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.beginPath();
    ctx.ellipse(x, p.y - s * 0.25, s * 0.88, s * 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function spawnGap() {
  const d = currentDiff();
  state.gaps.push({ z: MAX_Z + rand(2, 8), length: rand(1.8, 2.8), cleared: false });
  state.gapTimer = rand(d.gapEvery[0], d.gapEvery[1]);
}

function spawnCoins() {
  const lane = Math.floor(Math.random() * 3) - 1;
  const count = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i += 1) {
    state.coinsField.push({ lane, z: MAX_Z + i * 2.1, spin: rand(0, Math.PI * 2) });
  }
  const d = currentDiff();
  state.coinTimer = rand(d.coinEvery[0], d.coinEvery[1]);
}

function spawnPower() {
  const kinds = [POWERUPS.MAGNET, POWERUPS.SPEED, POWERUPS.INVINCIBLE];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const lane = Math.floor(Math.random() * 3) - 1;
  state.powerups.push({ kind, lane, z: MAX_Z + rand(4, 10) });
  const d = currentDiff();
  state.powerTimer = rand(d.powerEvery[0], d.powerEvery[1]);
}

function moveLane(delta) {
  state.laneTarget = clamp(state.laneTarget + delta, -1, 1);
}

function jump() {
  if (state.jumpT <= 0) state.jumpT = 1;
}

function applyPower(kind) {
  if (kind === POWERUPS.MAGNET) state.magnetT = 6;
  if (kind === POWERUPS.SPEED) state.speedBoostT = 4.5;
  if (kind === POWERUPS.INVINCIBLE) state.invincibleT = 5;
}

function animateHud(el, text) {
  if (!el) return;
  if (el.textContent !== text) {
    el.textContent = text;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 180 });
  }
}

function updateHud() {
  const total = Math.floor(state.score + state.coins * 11 + state.bestCombo * 5);
  animateHud(ui.score, String(total));
  animateHud(ui.coins, String(state.coins));
  animateHud(ui.speed, `${(state.speed / 15).toFixed(1)}x`);
  animateHud(ui.combo, String(state.combo));
  animateHud(ui.streak, String(state.streak));
  animateHud(ui.best, localStorage.getItem(BEST_KEY) || '0');

  if (ui.fear) animateHud(ui.fear, `${Math.round(state.terror * 100)}%`);

  if (ui.buffs) {
    const buffs = [];
    if (state.magnetT > 0) buffs.push(`Magnet ${state.magnetT.toFixed(1)}s`);
    if (state.speedBoostT > 0) buffs.push(`Speed ${state.speedBoostT.toFixed(1)}s`);
    if (state.invincibleT > 0) buffs.push(`Invincible ${state.invincibleT.toFixed(1)}s`);
    ui.buffs.textContent = buffs.join(' • ') || 'None';
  }
}

function killPlayer() {
  if (state.invincibleT > 0) return;
  state.running = false;
  state.gameOver = true;
  if (ui.pauseBtn) ui.pauseBtn.disabled = true;

  const total = Math.floor(state.score + state.coins * 11 + state.bestCombo * 5);
  const best = Number(localStorage.getItem(BEST_KEY) || 0);
  if (total > best) localStorage.setItem(BEST_KEY, String(total));

  if (ui.finalScore) ui.finalScore.textContent = String(total);
  if (ui.finalCoins) ui.finalCoins.textContent = String(state.coins);
  if (ui.finalCombo) ui.finalCombo.textContent = String(state.bestCombo);
  if (ui.over) ui.over.classList.remove('hidden');
}

function update(dt) {
  if (!state.running || state.paused || state.gameOver) return;

  state.pulse += dt;
  state.graceT = Math.max(0, state.graceT - dt);
  updateAdaptiveDirector(dt);

  state.magnetT = Math.max(0, state.magnetT - dt);
  state.speedBoostT = Math.max(0, state.speedBoostT - dt);
  state.invincibleT = Math.max(0, state.invincibleT - dt);

  const d = currentDiff();
  const boost = state.speedBoostT > 0 ? 1.42 : 1;
  state.speed = Math.min(39, state.speed + dt * d.speedAdd);
  const worldSpeed = state.speed * boost;
  state.fog = lerp(state.fog, d.fog, dt * 2);

  state.jumpT = Math.max(0, state.jumpT - dt * 1.6);
  const tx = LANE_X[state.laneTarget + 1];
  state.laneOffset += (tx - state.laneOffset) * Math.min(1, dt * 13.5);
  if (Math.abs(tx - state.laneOffset) < 0.01) {
    state.laneOffset = tx;
    state.lane = state.laneTarget;
  }

  state.gapTimer -= dt;
  state.coinTimer -= dt;
  state.powerTimer -= dt;

  if (state.gapTimer <= 0) spawnGap();
  if (state.coinTimer <= 0) spawnCoins();
  if (state.powerTimer <= 0) spawnPower();

  for (const g of state.gaps) g.z -= dt * worldSpeed;
  for (const c of state.coinsField) { c.z -= dt * worldSpeed; c.spin += dt * 6; }
  for (const p of state.powerups) p.z -= dt * worldSpeed;
  for (const t of state.trees) {
    t.z -= dt * worldSpeed;
    if (t.z <= 0) t.z = MAX_Z + rand(3, 12);
  }

  // Magnet pull coins from nearby lanes
  if (state.magnetT > 0) {
    for (const c of state.coinsField) {
      if (Math.abs(c.z - PLAYER_Z) < 8) {
        const laneX = LANE_X[c.lane + 1];
        const targetX = LANE_X[state.lane + 1];
        const nx = lerp(laneX, targetX, 0.22);
        c.lane = nx < -0.2 ? -1 : nx > 0.2 ? 1 : 0;
      }
    }
  }

  state.coinsField = state.coinsField.filter((c) => {
    const hit = Math.abs(c.z - PLAYER_Z) < 0.9 && c.lane === state.lane;
    if (hit) {
      state.coins += 1;
      state.combo += 1;
      state.streak += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      return false;
    }
    return c.z > 0;
  });

  state.powerups = state.powerups.filter((p) => {
    const hit = Math.abs(p.z - PLAYER_Z) < 0.9 && p.lane === state.lane;
    if (hit) {
      applyPower(p.kind);
      state.combo += 2;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      return false;
    }
    return p.z > 0;
  });

  // Fair gap check: only kill if feet are low while crossing center region.
  const footHeight = runnerY();
  for (const g of state.gaps) {
    const crossing = PLAYER_Z > g.z + 0.1 && PLAYER_Z < g.z + g.length - 0.1;
    if (crossing) {
      if (state.graceT <= 0 && footHeight < 0.58) {
        killPlayer();
      } else {
        g.cleared = true;
      }
    }
  }

  state.gaps = state.gaps.filter((g) => g.z + g.length > 0);

  // Adaptive scoring
  const comboMul = 1 + Math.floor(state.combo / 12) * 0.2;
  state.score += dt * worldSpeed * 6 * comboMul;

  if (state.gameOver) return;
  updateHud();
}

function drawPostFx() {
  if (state.fx === FX.LOW) return;
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (state.invincibleT > 0) {
    ctx.fillStyle = `rgba(170, 255, 220, ${0.06 + Math.sin(state.pulse * 8) * 0.03})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (state.speedBoostT > 0) {
    ctx.strokeStyle = 'rgba(255,150,80,0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }
}

function draw() {
  if (state.shake > 0 && state.fx === FX.HIGH) {
    const mag = state.shake * 14;
    ctx.save();
    ctx.translate(rand(-mag, mag), rand(-mag * 0.6, mag * 0.6));
    drawBg();
    drawFogLighting();
    drawVolumetricLights();
    drawDepthWalls();
    drawTrees();
    drawRoad();
    drawCollectibles();
    drawRunner();
    drawBloodRain();
    drawParticles();
    drawPostFx();
    ctx.restore();
    return;
  }

  drawBg();
  drawFogLighting();
  drawVolumetricLights();
  drawDepthWalls();
  drawTrees();
  drawRoad();
  drawCollectibles();
  drawRunner();
  drawBloodRain();
  drawParticles();
  drawPostFx();
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function restart() {
  const keepFx = state.fx;
  resetState();
  state.fx = keepFx;
  if (ui.fxBtn) ui.fxBtn.textContent = `FX: ${state.fx}`;
  state.running = true;
  state.spriteFrames = buildRunnerSpriteSet(state.spriteTheme);
  if (ui.over) ui.over.classList.add('hidden');
  if (ui.pauseBtn) { ui.pauseBtn.disabled = false; ui.pauseBtn.textContent = 'Pause'; }
  updateHud();
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (ui.pauseBtn) ui.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
}

function toggleFx() {
  state.fx = state.fx === FX.HIGH ? FX.LOW : FX.HIGH;
  if (ui.fxBtn) ui.fxBtn.textContent = `FX: ${state.fx}`;
}

function cycleSpriteTheme() {
  const idx = (SPRITE_THEMES.indexOf(state.spriteTheme) + 1) % SPRITE_THEMES.length;
  state.spriteTheme = SPRITE_THEMES[idx];
  state.spriteFrames = buildRunnerSpriteSet(state.spriteTheme);
  if (ui.spriteBtn) ui.spriteBtn.textContent = `Sprite: ${state.spriteTheme}`;
}

if (ui.restartBtn) ui.restartBtn.addEventListener('click', restart);
if (ui.pauseBtn) ui.pauseBtn.addEventListener('click', togglePause);
if (ui.fxBtn) ui.fxBtn.addEventListener('click', toggleFx);
if (ui.spriteBtn) ui.spriteBtn.addEventListener('click', cycleSpriteTheme);

window.addEventListener('keydown', (e) => {
  if (!state.running || state.gameOver) return;
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveLane(-1);
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveLane(1);
  if (e.key === 'ArrowUp' || e.key === ' ') jump();
  if (e.key.toLowerCase() === 'p') togglePause();
});

window.addEventListener('touchstart', (e) => {
  if (!state.running || state.gameOver) return;
  const target = e.target;
  if (target && target.closest && target.closest('button,a')) return;
  e.preventDefault();
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!state.running || state.gameOver) return;
  e.preventDefault();
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (!state.running || state.gameOver || !touchStart) return;
  const target = e.target;
  if (target && target.closest && target.closest('button,a')) return;
  e.preventDefault();
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const elapsed = performance.now() - touchStart.time;

  if (elapsed < 650 && Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
    if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) jump();
  }
  touchStart = null;
}, { passive: false });

async function enableTilt() {
  if (!ui.tiltBtn) return;
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
if (ui.tiltBtn) ui.tiltBtn.addEventListener('click', enableTilt);

window.addEventListener('deviceorientation', (e) => {
  if (!tiltEnabled || !state.running || state.paused || state.gameOver) return;
  const now = performance.now();
  if (now - lastTilt < 240) return;
  const gamma = e.gamma || 0;
  if (gamma > 10) { moveLane(1); lastTilt = now; }
  if (gamma < -10) { moveLane(-1); lastTilt = now; }
});

window.addEventListener('resize', resize);

resetState();
resize();
restart();
if (ui.spriteBtn) ui.spriteBtn.textContent = `Sprite: ${state.spriteTheme}`;
requestAnimationFrame(loop);
