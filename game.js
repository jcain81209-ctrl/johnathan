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
  restartBtn: document.getElementById('restartBtn')
};

const LANE_X = [-1, 0, 1];
const MAX_Z = 45;
const PLAYER_ZONE = 2.4;

let state;
let lastTs = 0;
let touchStart = null;
let tiltEnabled = false;
let lastTiltMove = 0;

function resetState() {
  state = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    coins: 0,
    speed: 13,
    lane: 0,
    laneTarget: 0,
    laneOffset: 0,
    jumpT: 0,
    slideT: 0,
    obstacleTimer: 0,
    coinTimer: 0,
    obstacles: [],
    coinItems: []
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
  const zNorm = Math.max(0.2, z / MAX_Z);
  const scale = 1 / zNorm;
  const cx = w * 0.5 + x * scale * w * 0.17;
  const cy = h * 0.83 - y * scale * h * 0.15;
  return { x: cx, y: cy, scale };
}

function runnerY() {
  if (state.jumpT <= 0) return 0;
  const t = 1 - state.jumpT;
  return Math.sin(Math.PI * t) * 1.6;
}

function drawBackground() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#245a67');
  grad.addColorStop(0.62, '#153d44');
  grad.addColorStop(1, '#102f34');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#173b41';
  for (let i = 0; i < 7; i += 1) {
    const x = (i / 6) * w;
    const base = h * 0.56 + Math.sin(i * 2.4) * 25;
    ctx.beginPath();
    ctx.moveTo(x - 45, h);
    ctx.lineTo(x + 35, h);
    ctx.lineTo(x + 10, base);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTrack() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (let i = MAX_Z; i >= 2; i -= 1) {
    const near = project(0, i);
    const far = project(0, i + 1);
    const widthNear = near.scale * 130;
    const widthFar = far.scale * 130;

    ctx.beginPath();
    ctx.moveTo(near.x - widthNear, near.y);
    ctx.lineTo(near.x + widthNear, near.y);
    ctx.lineTo(far.x + widthFar, far.y);
    ctx.lineTo(far.x - widthFar, far.y);
    ctx.closePath();

    const stone = i % 2 === 0 ? '#8c7858' : '#7f6d50';
    ctx.fillStyle = stone;
    ctx.fill();

    if (i % 3 === 0) {
      ctx.strokeStyle = 'rgba(30, 25, 17, 0.45)';
      ctx.lineWidth = Math.max(1, near.scale * 2);
      ctx.stroke();
    }

    if (i < 14) {
      ctx.fillStyle = 'rgba(31, 69, 72, 0.6)';
      ctx.fillRect(0, near.y, w, h - near.y);
    }
  }
}

function drawCoinsAndObstacles() {
  const all = [
    ...state.coinItems.map((coin) => ({ ...coin, type: 'coin' })),
    ...state.obstacles
  ].sort((a, b) => b.z - a.z);

  all.forEach((item) => {
    const x = LANE_X[item.lane + 1];
    const pos = project(x, item.z, item.type === 'coin' ? 0.55 : 0);

    if (item.type === 'coin') {
      ctx.fillStyle = '#f2cf39';
      ctx.strokeStyle = '#9d7417';
      ctx.lineWidth = Math.max(1, pos.scale * 2);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - pos.scale * 10, pos.scale * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    }

    if (item.type === 'low') {
      ctx.fillStyle = '#5b4a35';
      const w = pos.scale * 36;
      const h = pos.scale * 16;
      ctx.fillRect(pos.x - w / 2, pos.y - h - pos.scale * 18, w, h);
    } else {
      ctx.fillStyle = '#635238';
      const w = pos.scale * 28;
      const h = pos.scale * 36;
      ctx.fillRect(pos.x - w / 2, pos.y - h, w, h);
    }
  });
}

function drawRunner() {
  const laneLerp = state.laneOffset;
  const pos = project(laneLerp, PLAYER_ZONE, runnerY());
  const body = pos.scale * 24;

  if (state.slideT > 0) {
    ctx.fillStyle = '#ded9c9';
    ctx.fillRect(pos.x - body * 0.65, pos.y - body * 0.5, body * 1.3, body * 0.6);
    ctx.fillStyle = '#8c5331';
    ctx.fillRect(pos.x + body * 0.35, pos.y - body * 0.45, body * 0.35, body * 0.35);
    return;
  }

  ctx.fillStyle = '#ded9c9';
  ctx.fillRect(pos.x - body * 0.35, pos.y - body * 0.95, body * 0.7, body * 1.25);
  ctx.fillStyle = '#8c5331';
  ctx.fillRect(pos.x - body * 0.18, pos.y - body * 1.28, body * 0.36, body * 0.36);
  ctx.fillStyle = '#2f2f37';
  ctx.fillRect(pos.x - body * 0.35, pos.y + body * 0.3, body * 0.25, body * 0.75);
  ctx.fillRect(pos.x + body * 0.1, pos.y + body * 0.3, body * 0.25, body * 0.75);
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3) - 1;
  const type = Math.random() < 0.27 ? 'low' : 'block';
  state.obstacles.push({ lane, z: MAX_Z, type });
}

function spawnCoinLine() {
  const lane = Math.floor(Math.random() * 3) - 1;
  const count = 4 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i += 1) {
    state.coinItems.push({ lane, z: MAX_Z + i * 2.8 });
  }
}

function moveLane(delta) {
  state.laneTarget = Math.max(-1, Math.min(1, state.laneTarget + delta));
}

function jump() {
  if (state.jumpT <= 0 && state.slideT <= 0) state.jumpT = 1;
}

function slide() {
  if (state.slideT <= 0 && state.jumpT <= 0) state.slideT = 0.72;
}

function update(dt) {
  if (!state.running || state.paused || state.gameOver) return;

  state.speed = Math.min(28, state.speed + dt * 0.23);
  state.score += dt * state.speed * 6;

  state.jumpT = Math.max(0, state.jumpT - dt * 1.8);
  state.slideT = Math.max(0, state.slideT - dt);

  const targetX = LANE_X[state.laneTarget + 1];
  state.laneOffset += (targetX - state.laneOffset) * Math.min(1, dt * 14);
  if (Math.abs(targetX - state.laneOffset) < 0.02) {
    state.laneOffset = targetX;
    state.lane = state.laneTarget;
  }

  state.obstacleTimer -= dt;
  state.coinTimer -= dt;

  if (state.obstacleTimer <= 0) {
    spawnObstacle();
    state.obstacleTimer = Math.max(0.45, 1.25 - state.speed * 0.02);
  }

  if (state.coinTimer <= 0) {
    spawnCoinLine();
    state.coinTimer = 1.8 + Math.random() * 1.8;
  }

  state.obstacles.forEach((o) => { o.z -= dt * state.speed; });
  state.coinItems.forEach((c) => { c.z -= dt * state.speed; });

  state.coinItems = state.coinItems.filter((c) => {
    const inReach = Math.abs(c.z - PLAYER_ZONE) < 0.8 && c.lane === state.lane;
    if (inReach) {
      state.coins += 1;
      return false;
    }
    return c.z > 0;
  });

  state.obstacles = state.obstacles.filter((o) => {
    const near = Math.abs(o.z - PLAYER_ZONE) < 0.8 && o.lane === state.lane;
    if (near) {
      if (o.type === 'block' && state.jumpT <= 0.18) {
        triggerGameOver();
        return false;
      }
      if (o.type === 'low' && state.slideT <= 0.14) {
        triggerGameOver();
        return false;
      }
      return false;
    }
    return o.z > 0;
  });

  updateHud();
}

function triggerGameOver() {
  state.running = false;
  state.gameOver = true;
  const finalScore = Math.floor(state.score + state.coins * 8);
  const best = Number(localStorage.getItem('templeSprintBest') || 0);
  if (finalScore > best) {
    localStorage.setItem('templeSprintBest', String(finalScore));
  }

  ui.finalScore.textContent = String(finalScore);
  ui.finalCoins.textContent = String(state.coins);
  ui.over.classList.remove('hidden');
  ui.pauseBtn.disabled = true;
  updateHud();
}

function updateHud() {
  const total = Math.floor(state.score + state.coins * 8);
  ui.score.textContent = String(total);
  ui.coins.textContent = String(state.coins);
  ui.speed.textContent = `${(state.speed / 13).toFixed(1)}x`;
  ui.best.textContent = localStorage.getItem('templeSprintBest') || '0';
}

function draw() {
  drawBackground();
  drawTrack();
  drawCoinsAndObstacles();
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
  resetState();
  ui.over.classList.add('hidden');
  state.running = true;
  ui.pauseBtn.disabled = false;
  ui.startBtn.disabled = true;
  updateHud();
}

function togglePause() {
  if (state.gameOver || !state.running) return;
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
}

ui.startBtn.addEventListener('click', startRun);
ui.restartBtn.addEventListener('click', startRun);
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
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (!touchStart || !state.running || state.gameOver) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const dt = performance.now() - touchStart.time;
  const min = 24;

  if (dt < 550 && Math.max(Math.abs(dx), Math.abs(dy)) > min) {
    if (Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      jump();
    } else {
      slide();
    }
  }

  touchStart = null;
}, { passive: true });

async function enableTilt() {
  if (typeof DeviceOrientationEvent === 'undefined') {
    ui.tiltBtn.textContent = 'Tilt unavailable';
    ui.tiltBtn.disabled = true;
    return;
  }

  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
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
  if (!tiltEnabled || !state.running || state.gameOver || state.paused) return;
  const now = performance.now();
  if (now - lastTiltMove < 260) return;

  const gamma = e.gamma || 0;
  if (gamma > 11) {
    moveLane(1);
    lastTiltMove = now;
  } else if (gamma < -11) {
    moveLane(-1);
    lastTiltMove = now;
  }
});

window.addEventListener('resize', resize);

resetState();
resize();
updateHud();
requestAnimationFrame(loop);
