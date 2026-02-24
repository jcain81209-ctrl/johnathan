const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  coins: document.getElementById('coins'),
  best: document.getElementById('best'),
  speed: document.getElementById('speed'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  tiltBtn: document.getElementById('tiltBtn'),
  over: document.getElementById('gameOver'),
  finalScore: document.getElementById('finalScore'),
  finalCoins: document.getElementById('finalCoins'),
  restartBtn: document.getElementById('restartBtn'),
  menuBtn: document.getElementById('menuBtn'),
  startMenu: document.getElementById('startMenu')
};

const LANE_X = [-1, 0, 1];
const MAX_Z = 58;
const PLAYER_Z = 3;

let state;
let lastTs = 0;
let touchStart = null;
let tiltEnabled = false;
let lastTiltMove = 0;

function resetState() {
  state = {
    inMenu: true,
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    coins: 0,
    speed: 16,
    lane: 0,
    laneTarget: 0,
    laneOffset: 0,
    jumpT: 0,
    slideT: 0,
    gapTimer: 0,
    coinTimer: 0,
    gaps: [],
    coinsField: []
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

function project(x, z, y = 0) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const zn = Math.max(0.22, z / MAX_Z);
  const s = 1 / zn;
  return {
    x: w * 0.5 + x * s * w * 0.15,
    y: h * 0.83 - y * s * h * 0.17,
    scale: s
  };
}

function runnerY() {
  if (state.jumpT <= 0) return 0;
  return Math.sin(Math.PI * (1 - state.jumpT)) * 1.8;
}

function drawJungleBackground() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#000000');
  sky.addColorStop(0.42, '#040b08');
  sky.addColorStop(1, '#07130f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Cold moon glow
  ctx.fillStyle = 'rgba(188, 255, 223, 0.12)';
  ctx.beginPath();
  ctx.arc(w * 0.79, h * 0.15, Math.min(w, h) * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Silhouette layers
  for (let layer = 0; layer < 4; layer += 1) {
    const yBase = h * (0.38 + layer * 0.13);
    for (let i = 0; i < 17; i += 1) {
      const x = (i / 16) * w + ((layer * 23) % 44) - 20;
      const ht = 92 + layer * 42 + (i % 4) * 18;
      ctx.fillStyle = ['#08160f', '#0a1e14', '#0d2619', '#102a1c'][layer];
      ctx.beginPath();
      ctx.moveTo(x - 28, h);
      ctx.lineTo(x + 26, h);
      ctx.lineTo(x + 9, yBase - ht);
      ctx.lineTo(x - 11, yBase - ht + 24);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Creepy glowing eyes in distance
  for (let i = 0; i < 9; i += 1) {
    const ex = (i + 1) * (w / 10) + (i % 2 ? 20 : -14);
    const ey = h * (0.48 + (i % 3) * 0.03);
    const glow = 0.2 + (i % 3) * 0.08;
    ctx.fillStyle = `rgba(123, 255, 170, ${glow})`;
    ctx.beginPath();
    ctx.arc(ex - 5, ey, 2.2, 0, Math.PI * 2);
    ctx.arc(ex + 5, ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground mist
  for (let m = 0; m < 6; m += 1) {
    const y = h * (0.55 + m * 0.06);
    const mist = ctx.createLinearGradient(0, y, w, y);
    mist.addColorStop(0, 'rgba(20, 70, 45, 0)');
    mist.addColorStop(0.5, 'rgba(24, 85, 55, 0.12)');
    mist.addColorStop(1, 'rgba(20, 70, 45, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, y, w, 24);
  }
}

function drawSideTrees() {
  for (let z = MAX_Z; z >= 6; z -= 3.1) {
    const left = project(-2.2, z, 0);
    const right = project(2.2, z, 0);
    [left, right].forEach((p, idx) => {
      const trunkW = p.scale * 17;
      const trunkH = p.scale * 76;
      ctx.fillStyle = '#2f2317';
      ctx.fillRect(p.x - trunkW / 2, p.y - trunkH, trunkW, trunkH);
      ctx.fillStyle = idx ? 'rgba(16,55,33,0.95)' : 'rgba(22,66,40,0.95)';
      ctx.beginPath();
      ctx.arc(p.x, p.y - trunkH - p.scale * 16, p.scale * 24, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function isGapAt(z) {
  return state.gaps.some((g) => z >= g.z && z <= g.z + g.length);
}

function drawRoad() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (let z = MAX_Z; z >= 1; z -= 1) {
    const near = project(0, z);
    const far = project(0, z + 1);
    const wn = near.scale * 140;
    const wf = far.scale * 140;

    if (isGapAt(z + 0.2)) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.beginPath();
      ctx.moveTo(near.x - wn, near.y);
      ctx.lineTo(near.x + wn, near.y);
      ctx.lineTo(far.x + wf, far.y);
      ctx.lineTo(far.x - wf, far.y);
      ctx.closePath();
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(near.x - wn, near.y);
    ctx.lineTo(near.x + wn, near.y);
    ctx.lineTo(far.x + wf, far.y);
    ctx.lineTo(far.x - wf, far.y);
    ctx.closePath();
    ctx.fillStyle = z % 2 === 0 ? '#5b4a37' : '#4f3f2f';
    ctx.fill();

    if (z % 2 === 0) {
      ctx.strokeStyle = 'rgba(16, 12, 9, 0.7)';
      ctx.lineWidth = Math.max(1, near.scale * 2.2);
      ctx.stroke();
    }

    if (z % 4 === 0) {
      const seamL = project(-0.33, z);
      const seamR = project(-0.33, z + 1);
      const seamL2 = project(0.33, z);
      const seamR2 = project(0.33, z + 1);
      ctx.strokeStyle = 'rgba(11, 9, 7, 0.75)';
      ctx.lineWidth = Math.max(1, near.scale * 1.8);
      ctx.beginPath();
      ctx.moveTo(seamL.x, seamL.y);
      ctx.lineTo(seamR.x, seamR.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(seamL2.x, seamL2.y);
      ctx.lineTo(seamR2.x, seamR2.y);
      ctx.stroke();
    }

    if (z < 12) {
      ctx.fillStyle = 'rgba(4, 8, 7, 0.75)';
      ctx.fillRect(0, near.y, w, h - near.y);
    }
  }
}

function drawCoins() {
  state.coinsField.sort((a, b) => b.z - a.z).forEach((c) => {
    const pos = project(LANE_X[c.lane + 1], c.z, 0.64);
    ctx.fillStyle = '#edcc46';
    ctx.strokeStyle = '#9e7619';
    ctx.lineWidth = Math.max(1, pos.scale * 2);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - pos.scale * 12, pos.scale * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

function drawRunner() {
  const p = project(state.laneOffset, PLAYER_Z, runnerY());
  const s = p.scale * 24;

  if (state.slideT > 0) {
    ctx.fillStyle = '#d9d5c7';
    ctx.fillRect(p.x - s * 0.7, p.y - s * 0.53, s * 1.4, s * 0.58);
    ctx.fillStyle = '#905838';
    ctx.fillRect(p.x + s * 0.38, p.y - s * 0.42, s * 0.34, s * 0.33);
    return;
  }

  ctx.fillStyle = '#ded9cb';
  ctx.fillRect(p.x - s * 0.34, p.y - s * 0.96, s * 0.68, s * 1.28);
  ctx.fillStyle = '#885638';
  ctx.fillRect(p.x - s * 0.16, p.y - s * 1.3, s * 0.32, s * 0.34);
  ctx.fillStyle = '#4f3026';
  ctx.fillRect(p.x - s * 0.52, p.y - s * 0.79, s * 0.16, s * 0.74);
  ctx.fillRect(p.x + s * 0.36, p.y - s * 0.79, s * 0.16, s * 0.74);
  ctx.fillStyle = '#2c313a';
  ctx.fillRect(p.x - s * 0.31, p.y + s * 0.25, s * 0.24, s * 0.78);
  ctx.fillRect(p.x + s * 0.07, p.y + s * 0.25, s * 0.24, s * 0.78);
  ctx.fillStyle = '#7a4d2f';
  ctx.fillRect(p.x - s * 0.11, p.y - s * 0.58, s * 0.22, s * 0.2);
}

function spawnGap() {
  state.gaps.push({ z: MAX_Z + Math.random() * 5, length: 1.8 + Math.random() * 1.1 });
}

function spawnCoins() {
  const lane = Math.floor(Math.random() * 3) - 1;
  const count = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i += 1) state.coinsField.push({ lane, z: MAX_Z + i * 2.2 });
}

function moveLane(delta) {
  state.laneTarget = Math.max(-1, Math.min(1, state.laneTarget + delta));
}

function jump() {
  if (state.jumpT <= 0 && state.slideT <= 0) state.jumpT = 1;
}

function slide() {
  if (state.slideT <= 0 && state.jumpT <= 0) state.slideT = 0.68;
}

function triggerGameOver() {
  state.running = false;
  state.gameOver = true;
  ui.pauseBtn.disabled = true;

  const total = Math.floor(state.score + state.coins * 10);
  const best = Number(localStorage.getItem('templeSprintBest') || 0);
  if (total > best) localStorage.setItem('templeSprintBest', String(total));

  ui.finalScore.textContent = String(total);
  ui.finalCoins.textContent = String(state.coins);
  ui.over.classList.remove('hidden');
  updateHud();
}

function updateHud() {
  ui.score.textContent = String(Math.floor(state.score + state.coins * 10));
  ui.coins.textContent = String(state.coins);
  ui.speed.textContent = `${(state.speed / 16).toFixed(1)}x`;
  ui.best.textContent = localStorage.getItem('templeSprintBest') || '0';
}

function update(dt) {
  if (!state.running || state.paused || state.gameOver) return;

  state.speed = Math.min(35, state.speed + dt * 0.26);
  state.score += dt * state.speed * 6;
  state.jumpT = Math.max(0, state.jumpT - dt * 1.65);
  state.slideT = Math.max(0, state.slideT - dt);

  const tx = LANE_X[state.laneTarget + 1];
  state.laneOffset += (tx - state.laneOffset) * Math.min(1, dt * 13);
  if (Math.abs(tx - state.laneOffset) < 0.02) {
    state.laneOffset = tx;
    state.lane = state.laneTarget;
  }

  state.gapTimer -= dt;
  state.coinTimer -= dt;
  if (state.gapTimer <= 0) {
    spawnGap();
    state.gapTimer = Math.max(0.55, 1.5 - state.speed * 0.017);
  }
  if (state.coinTimer <= 0) {
    spawnCoins();
    state.coinTimer = 1.4 + Math.random() * 1.7;
  }

  state.gaps.forEach((g) => { g.z -= dt * state.speed; });
  state.coinsField.forEach((c) => { c.z -= dt * state.speed; });

  state.coinsField = state.coinsField.filter((c) => {
    const collected = Math.abs(c.z - PLAYER_Z) < 0.85 && c.lane === state.lane;
    if (collected) {
      state.coins += 1;
      return false;
    }
    return c.z > 0;
  });

  state.gaps = state.gaps.filter((g) => {
    const atGap = PLAYER_Z >= g.z && PLAYER_Z <= g.z + g.length;
    if (atGap && state.jumpT <= 0.2) {
      triggerGameOver();
      return false;
    }
    return g.z + g.length > 0;
  });

  updateHud();
}

function draw() {
  drawJungleBackground();
  drawSideTrees();
  drawRoad();
  drawCoins();
  drawRunner();
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
  ui.over.classList.add('hidden');
  ui.pauseBtn.disabled = false;
  ui.pauseBtn.textContent = 'Pause';
}

function restart() {
  resetState();
  startRun();
  updateHud();
}

function backToMenu() {
  resetState();
  ui.over.classList.add('hidden');
  ui.startMenu.classList.remove('hidden');
  ui.pauseBtn.disabled = true;
  updateHud();
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
}

ui.startBtn.addEventListener('click', restart);
ui.restartBtn.addEventListener('click', restart);
ui.menuBtn.addEventListener('click', backToMenu);
ui.pauseBtn.addEventListener('click', togglePause);

window.addEventListener('keydown', (e) => {
  if (!state.running || state.gameOver) return;
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveLane(-1);
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveLane(1);
  if (e.key === 'ArrowUp' || e.key === ' ') jump();
  if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') slide();
  if (e.key.toLowerCase() === 'p') togglePause();
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!touchStart || !state.running || state.gameOver) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const elapsed = performance.now() - touchStart.time;
  if (elapsed < 600 && Math.max(Math.abs(dx), Math.abs(dy)) > 25) {
    if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) jump();
    else slide();
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
  if (now - lastTiltMove < 250) return;
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
requestAnimationFrame(loop);
