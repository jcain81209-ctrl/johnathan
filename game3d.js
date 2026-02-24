 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/game3d.js b/game3d.js
index f0b7aa6fb9ed63cc53f190764f9d7dabe65c3bf3..5357d5761891ecd5e7a3dab3cc7cd409b9c60809 100644
--- a/game3d.js
+++ b/game3d.js
@@ -1,287 +1,669 @@
-// Set up global variables
-let scene, camera, renderer;
-let player, ground;
-let obstacles = [];
-let coins = [];
-let powerUps = [];
-
-let lane = 0;
-let targetX = 0;
-let speed = 0.8;
-let score = 0;
-let highScore = localStorage.getItem("highScore") || 0;
-
-let gameRunning = false;
-let paused = false;
-
-let velocityY = 0;
-let gravity = -0.02;
-let jumping = false;
-let sliding = false;
-
-let powerUpTimer = 0;
-let currentPowerUp = null;
-
-let combo = 1;
-let maxCombo = 1;
-
-let isShaking = false;
-let shakeAmount = 0;
-
-let jumpAnimation = 0;
-
-// Initialize the scene
-function init() {
-    scene = new THREE.Scene();
-    scene.background = new THREE.Color(0x87ceeb);  // Light sky blue color for the sky
-
-    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
-    camera.position.set(0, 6, 10);
-    camera.lookAt(0, 1, 0);
-
-    renderer = new THREE.WebGLRenderer({ antialias: true });
-    renderer.setSize(window.innerWidth, window.innerHeight);
-    document.body.appendChild(renderer.domElement);
-
-    // Lighting
-    const light = new THREE.DirectionalLight(0xffffff, 1);
-    light.position.set(5, 10, 7);
-    scene.add(light);
-
-    const ambient = new THREE.AmbientLight(0x404040);
-    scene.add(ambient);
-
-    // Create the path, player, and environment
-    createGround();
-    createPlayer();
-    spawnTerrain();
-    spawnObstacles();
-    spawnCoins();
-    spawnPowerUps();
-
-    // Event listeners
-    document.getElementById("startBtn").onclick = function() {
-        startGame();
+(() => {
+  const STORAGE_KEY = 'templeRunFrameworkSave';
+
+  const CONFIG = {
+    lanes: [-1, 0, 1],
+    laneWidth: 130,
+    baseSpeed: 290,
+    maxSpeed: 620,
+    speedRampPerSecond: 2.8,
+    gravity: 1700,
+    jumpVelocity: 750,
+    slideDuration: 0.72,
+    segmentLength: 220,
+    visibleDepth: 2300,
+    spawnStep: 55,
+    reviveGraceSeconds: 2,
+    difficultyPaceMeters: 150,
+    chaseDamageCooldown: 1.5,
+    powerDurations: {
+      magnet: 8,
+      shield: 6,
+      boost: 4,
+      doubleScore: 10,
+      coinRush: 6
+    }
+  };
+
+  const CONTENT = {
+    obstacles: [
+      { id: 'low_barrier', laneLock: false, requires: 'jump', color: '#f15d5d' },
+      { id: 'high_arch', laneLock: false, requires: 'slide', color: '#ff9d3d' },
+      { id: 'wide_block', laneLock: true, requires: 'none', color: '#d35dff' }
+    ],
+    powerups: [
+      { id: 'magnet', color: '#4ce6d1' },
+      { id: 'shield', color: '#5d8bff' },
+      { id: 'boost', color: '#ff5d9e' },
+      { id: 'doubleScore', color: '#ffe26f' },
+      { id: 'coinRush', color: '#87ff5f' }
+    ],
+    turns: ['left', 'right']
+  };
+
+  const canvas = document.getElementById('gameCanvas');
+  const ctx = canvas.getContext('2d');
+
+  const ui = {
+    startScreen: document.getElementById('startScreen'),
+    gameOverScreen: document.getElementById('gameOverScreen'),
+    startBtn: document.getElementById('startBtn'),
+    restartBtn: document.getElementById('restartBtn'),
+    menuBtn: document.getElementById('menuBtn'),
+    runSummary: document.getElementById('runSummary'),
+    hud: document.getElementById('hud'),
+    powerList: document.getElementById('powerList'),
+    score: document.getElementById('hudScore'),
+    coins: document.getElementById('hudCoins'),
+    multiplier: document.getElementById('hudMultiplier'),
+    distance: document.getElementById('hudDistance'),
+    highScore: document.getElementById('hudHighScore'),
+    status: document.getElementById('hudStatus')
+  };
+
+  const input = {
+    left: false,
+    right: false,
+    jump: false,
+    slide: false,
+    turnLeft: false,
+    turnRight: false,
+    pause: false,
+    resetFrameFlags() {
+      this.left = this.right = this.jump = this.slide = this.turnLeft = this.turnRight = this.pause = false;
+    }
+  };
+
+  const state = {
+    mode: 'intro',
+    elapsed: 0,
+    score: 0,
+    coins: 0,
+    distance: 0,
+    speed: CONFIG.baseSpeed,
+    multiplier: 1,
+    combo: 0,
+    nextDifficultyGate: CONFIG.difficultyPaceMeters,
+    highScore: 0,
+    bankedCoins: 0,
+    reviveTokens: 1,
+    pendingReviveUntil: 0,
+    player: null,
+    entities: [],
+    segments: [],
+    nextSegmentZ: 0,
+    activePowers: new Map(),
+    worldTurnPreview: null,
+    chasePressure: 0,
+    chaseCooldown: 0
+  };
+
+  function loadSave() {
+    try {
+      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
+      state.highScore = Number(saved.highScore) || 0;
+      state.bankedCoins = Number(saved.coins) || 0;
+      state.reviveTokens = Math.max(1, Number(saved.reviveTokens) || 1);
+    } catch {
+      state.highScore = 0;
+      state.bankedCoins = 0;
+      state.reviveTokens = 1;
+    }
+  }
+
+  function saveProgress() {
+    localStorage.setItem(
+      STORAGE_KEY,
+      JSON.stringify({
+        highScore: Math.max(state.highScore, Math.floor(state.score)),
+        coins: state.bankedCoins,
+        reviveTokens: state.reviveTokens
+      })
+    );
+  }
+
+  function resize() {
+    canvas.width = window.innerWidth;
+    canvas.height = window.innerHeight;
+  }
+
+  function laneToX(laneIndex) {
+    return CONFIG.lanes[laneIndex] * CONFIG.laneWidth;
+  }
+
+  function createPlayer() {
+    return {
+      lane: 1,
+      laneVisualX: 0,
+      y: 0,
+      vy: 0,
+      jumpLocked: false,
+      slideTimer: 0,
+      crashedFlash: 0
     };
-    document.getElementById("pauseBtn").onclick = togglePause;
-    document.addEventListener("keydown", handleKey);
-    document.addEventListener("touchstart", handleTouch);
-
-    document.getElementById("highScore").innerText = highScore;
-    document.getElementById("score").innerText = score;
-    document.getElementById("combo").innerText = `Combo: x${combo}`;
-}
-
-// Start the game
-function startGame() {
-    gameRunning = true;
-    document.getElementById("startScreen").style.display = "none";
-    document.getElementById("pauseBtn").style.display = "block";
-    animate();
-}
-
-// Pause functionality
-function togglePause() {
-    paused = !paused;
-}
-
-// Handle player movement
-function handleKey(e) {
-    if (!gameRunning) return;
-
-    if (e.key === "ArrowLeft") lane = Math.max(-1, lane - 1);
-    if (e.key === "ArrowRight") lane = Math.min(1, lane + 1);
-    if (e.key === "ArrowUp" && !jumping) {
-        velocityY = 0.35;
-        jumping = true;
-    }
-    if (e.key === "ArrowDown" && !sliding) {
-        sliding = true;
-        setTimeout(() => { sliding = false; }, 500); // Slide duration
-    }
-}
-
-// Handle touch controls for mobile
-function handleTouch(e) {
-    if (!gameRunning) return;
+  }
+
+  function spawnSegment() {
+    const z = state.nextSegmentZ;
+    const difficulty = Math.min(1, state.distance / 2000);
+    const turnChance = 0.08 + difficulty * 0.18;
+    const segment = {
+      zStart: z,
+      zEnd: z + CONFIG.segmentLength,
+      turn: Math.random() < turnChance ? CONTENT.turns[(Math.random() * CONTENT.turns.length) | 0] : null
+    };
+
+    for (let zPos = segment.zStart + CONFIG.spawnStep; zPos < segment.zEnd; zPos += CONFIG.spawnStep) {
+      const roll = Math.random();
+      if (roll < 0.26) {
+        const obstacle = CONTENT.obstacles[(Math.random() * CONTENT.obstacles.length) | 0];
+        const lane = (Math.random() * 3) | 0;
+        state.entities.push({ type: 'obstacle', lane, z: zPos, ...obstacle });
+      } else if (roll < 0.58) {
+        const lane = (Math.random() * 3) | 0;
+        state.entities.push({ type: 'coin', lane, z: zPos, collected: false });
+      } else if (roll < 0.63) {
+        const lane = (Math.random() * 3) | 0;
+        const power = CONTENT.powerups[(Math.random() * CONTENT.powerups.length) | 0];
+        state.entities.push({ type: 'powerup', lane, z: zPos, id: power.id, color: power.color });
+      }
+    }
+
+    if (segment.turn) {
+      state.entities.push({ type: 'turnGate', z: segment.zEnd - CONFIG.spawnStep, direction: segment.turn });
+    }
+
+    state.segments.push(segment);
+    state.nextSegmentZ += CONFIG.segmentLength;
+  }
+
+  function ensureWorld() {
+    while (state.nextSegmentZ < state.distance + CONFIG.visibleDepth + CONFIG.segmentLength) {
+      spawnSegment();
+    }
+
+    state.segments = state.segments.filter((seg) => seg.zEnd >= state.distance - CONFIG.segmentLength);
+    state.entities = state.entities.filter((entity) => entity.z >= state.distance - 120);
+  }
+
+  function activatePower(id, bonusSeconds = 0) {
+    const duration = (CONFIG.powerDurations[id] || 6) + bonusSeconds;
+    state.activePowers.set(id, duration);
+    if (id === 'boost') {
+      state.speed = Math.min(CONFIG.maxSpeed + 140, state.speed + 120);
+    }
+  }
+
+  function hasPower(id) {
+    return state.activePowers.has(id);
+  }
+
+  function applyInput() {
+    const p = state.player;
+    if (input.left && p.lane > 0) p.lane -= 1;
+    if (input.right && p.lane < 2) p.lane += 1;
+
+    if (input.jump && p.y <= 0.01) {
+      p.vy = CONFIG.jumpVelocity;
+      p.jumpLocked = true;
+    }
+
+    if (input.slide && p.y <= 0.01 && p.slideTimer <= 0) {
+      p.slideTimer = CONFIG.slideDuration;
+    }
+
+    if (input.pause && state.mode === 'running') {
+      state.mode = 'paused';
+      ui.status.textContent = 'Status: Paused';
+    } else if (input.pause && state.mode === 'paused') {
+      state.mode = 'running';
+      ui.status.textContent = 'Status: Running';
+    }
+  }
+
+  function updatePlayer(dt) {
+    const p = state.player;
+    p.vy -= CONFIG.gravity * dt;
+    p.y += p.vy * dt;
+
+    if (p.y <= 0) {
+      p.y = 0;
+      p.vy = 0;
+      p.jumpLocked = false;
+    }
+
+    p.slideTimer = Math.max(0, p.slideTimer - dt);
+    p.laneVisualX += (laneToX(p.lane) - p.laneVisualX) * Math.min(1, dt * 16);
+    p.crashedFlash = Math.max(0, p.crashedFlash - dt * 2);
+  }
+
+  function pickupCoin() {
+    state.coins += 1;
+    state.combo = Math.min(state.combo + 1, 50);
+  }
+
+  function doCrash() {
+    const p = state.player;
+    if (hasPower('shield')) {
+      state.activePowers.delete('shield');
+      p.crashedFlash = 1;
+      state.chasePressure = Math.max(0, state.chasePressure - 0.35);
+      return;
+    }
+
+    if (state.reviveTokens > 0 && state.pendingReviveUntil <= 0) {
+      state.pendingReviveUntil = CONFIG.reviveGraceSeconds;
+      state.mode = 'revivePrompt';
+      ui.status.textContent = 'Status: Revive Available';
+      return;
+    }
+
+    endRun();
+  }
+
+  function evaluateEntityCollision(entity) {
+    const p = state.player;
+    const laneHit = entity.lane == null || entity.lane === p.lane;
+    const close = Math.abs(entity.z - state.distance) < 20;
+    if (!laneHit || !close) return;
+
+    if (entity.type === 'coin' && !entity.collected) {
+      entity.collected = true;
+      pickupCoin();
+    }
+
+    if (entity.type === 'powerup') {
+      entity.collected = true;
+      activatePower(entity.id);
+    }
+
+    if (entity.type === 'obstacle') {
+      if (entity.requires === 'jump' && p.y > 35) return;
+      if (entity.requires === 'slide' && p.slideTimer > 0) return;
+      doCrash();
+    }
+
+    if (entity.type === 'turnGate') {
+      const insideWindow = entity.z - state.distance < 15 && entity.z - state.distance > -15;
+      if (!insideWindow) return;
+      const valid =
+        (entity.direction === 'left' && input.turnLeft) ||
+        (entity.direction === 'right' && input.turnRight);
+      if (valid) {
+        state.worldTurnPreview = entity.direction;
+      } else {
+        doCrash();
+      }
+    }
+  }
+
+  function updatePowers(dt) {
+    for (const [id, remaining] of state.activePowers.entries()) {
+      const next = remaining - dt;
+      if (next <= 0) {
+        state.activePowers.delete(id);
+      } else {
+        state.activePowers.set(id, next);
+      }
+    }
+
+    if (hasPower('doubleScore')) {
+      state.multiplier = 2 + state.combo * 0.02;
+    } else {
+      state.multiplier = 1 + state.combo * 0.015;
+    }
+  }
+
+  function updateChase(dt) {
+    if (state.chaseCooldown > 0) {
+      state.chaseCooldown -= dt;
+      return;
+    }
+
+    state.chasePressure = Math.min(1, state.chasePressure + dt * 0.018);
+    if (state.chasePressure > 0.87) {
+      doCrash();
+      state.chaseCooldown = CONFIG.chaseDamageCooldown;
+    }
+  }
+
+  function updateDifficulty() {
+    if (state.distance >= state.nextDifficultyGate) {
+      state.nextDifficultyGate += CONFIG.difficultyPaceMeters;
+      state.speed = Math.min(CONFIG.maxSpeed, state.speed + 14);
+    }
+  }
+
+  function update(dt) {
+    if (state.mode === 'intro' || state.mode === 'gameover') return;
+
+    applyInput();
+
+    if (state.mode === 'paused') return;
+
+    if (state.mode === 'revivePrompt') {
+      state.pendingReviveUntil -= dt;
+      if (state.pendingReviveUntil <= 0) {
+        state.reviveTokens -= 1;
+        state.pendingReviveUntil = 0;
+        state.mode = 'running';
+        state.chasePressure = Math.max(0.22, state.chasePressure - 0.24);
+        ui.status.textContent = 'Status: Revived';
+      }
+      return;
+    }
+
+    state.mode = 'running';
+
+    updatePowers(dt);
+
+    const speedBonus = hasPower('boost') ? 200 : 0;
+    state.speed = Math.min(CONFIG.maxSpeed + 100, state.speed + CONFIG.speedRampPerSecond * dt);
+    const effectiveSpeed = state.speed + speedBonus;
+
+    state.elapsed += dt;
+    state.distance += effectiveSpeed * dt;
+
+    if (hasPower('coinRush')) {
+      state.coins += Math.floor(25 * dt);
+    }
+
+    updatePlayer(dt);
+    ensureWorld();
+
+    for (const entity of state.entities) {
+      if (entity.collected) continue;
+      if (hasPower('magnet') && entity.type === 'coin' && Math.abs(entity.z - state.distance) < 130 && Math.abs(entity.lane - state.player.lane) <= 1) {
+        entity.collected = true;
+        pickupCoin();
+      }
+      evaluateEntityCollision(entity);
+    }
 
-    const x = e.touches[0].clientX;
-    if (x < window.innerWidth / 3) lane = Math.max(-1, lane - 1);
-    else if (x > window.innerWidth * 2 / 3) lane = Math.min(1, lane + 1);
-    else if (!jumping) {
-        velocityY = 0.35;
-        jumping = true;
-    }
-}
-
-// ======================
-// Dynamic Power-ups
-// ======================
-
-function spawnPowerUp() {
-    if (!gameRunning) return;
-
-    const powerUpType = Math.floor(Math.random() * 4);  // Randomize power-up
-    let geo, mat;
-
-    if (powerUpType === 0) {  // Speed Boost
-        geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
-        mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });  // Green for speed
-    } else if (powerUpType === 1) {  // Shield
-        geo = new THREE.SphereGeometry(0.5, 16, 16);
-        mat = new THREE.MeshStandardMaterial({ color: 0x0000ff });  // Blue for shield
-    } else if (powerUpType === 2) {  // Magnet
-        geo = new THREE.SphereGeometry(0.6, 16, 16);
-        mat = new THREE.MeshStandardMaterial({ color: 0xffd700 });  // Yellow for magnet
-    } else {  // Double Points
-        geo = new THREE.TorusGeometry(0.7, 0.3, 16, 100);
-        mat = new THREE.MeshStandardMaterial({ color: 0xff6347 });  // Red for double points
-    }
-
-    const powerUp = new THREE.Mesh(geo, mat);
-    const randomLane = Math.floor(Math.random() * 3) - 1;
-    powerUp.position.x = randomLane * 4;
-    powerUp.position.y = 2;
-    powerUp.position.z = -300;
-    powerUp.type = powerUpType;
-
-    scene.add(powerUp);
-    powerUps.push(powerUp);
-
-    setTimeout(spawnPowerUp, 5000 + Math.random() * 5000);
-}
-
-// ======================
-// Obstacles & Terrain
-// ======================
-
-function spawnObstacle() {
-    if (!gameRunning) return;
-
-    const geo = new THREE.BoxGeometry(2, 2, 2);
-    const mat = new THREE.MeshStandardMaterial({ color: 0x552200 });  // Obstacles in brown
-    const obstacle = new THREE.Mesh(geo, mat);
-
-    const randomLane = Math.floor(Math.random() * 3) - 1;
-    obstacle.position.x = randomLane * 4;
-    obstacle.position.y = 1;
-    obstacle.position.z = -300;
-
-    scene.add(obstacle);
-    obstacles.push(obstacle);
-
-    setTimeout(spawnObstacle, 1500);
-}
-
-function spawnCoin() {
-    if (!gameRunning) return;
-
-    const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 100);
-    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700 });  // Golden coins
-    const coin = new THREE.Mesh(geo, mat);
-
-    const randomLane = Math.floor(Math.random() * 3) - 1;
-    coin.position.x = randomLane * 4;
-    coin.position.y = 2;
-    coin.position.z = -250;
-
-    scene.add(coin);
-    coins.push(coin);
-
-    setTimeout(spawnCoin, 1000);  // Spawn coins over time
-}
-
-// ======================
-// Animate Game
-// ======================
-
-function animate() {
-    requestAnimationFrame(animate);
-
-    if (gameRunning && !paused) {
-
-        speed += 0.0002;
-
-        targetX = lane * 4;
-        player.position.x += (targetX - player.position.x) * 0.2;
-
-        if (jumping) {
-            velocityY += gravity;
-            player.position.y += velocityY;
-
-            if (player.position.y <= 1) {
-                player.position.y = 1;
-                jumping = false;
-            }
-        }
-
-        if (sliding) {
-            player.scale.y = 0.5;
-            setTimeout(() => { sliding = false; player.scale.y = 2; }, 500);
-        }
-
-        obstacles.forEach((o, i) => {
-            o.position.z += speed;
-
-            if (Math.abs(o.position.z) < 1 &&
-                Math.abs(o.position.x - player.position.x) < 1 &&
-                player.position.y < 2) {
-                endGame();
-            }
-
-            if (o.position.z > 10) {
-                scene.remove(o);
-                obstacles.splice(i, 1);
-            }
-        });
+    state.entities = state.entities.filter((entity) => !entity.collected);
 
-        coins.forEach((c, i) => {
-            c.rotation.y += 0.1;
-            c.position.z += speed;
-
-            if (Math.abs(c.position.z) < 1 &&
-                Math.abs(c.position.x - player.position.x) < 1) {
-                score += 10;
-                scene.remove(c);
-                coins.splice(i, 1);
-            }
-
-            if (c.position.z > 10) {
-                scene.remove(c);
-                coins.splice(i, 1);
-            }
-        });
-
-        powerUps.forEach((p, i) => {
-            p.position.z += speed;
+    updateDifficulty();
+    updateChase(dt);
 
-            if (Math.abs(p.position.z) < 1 &&
-                Math.abs(p.position.x - player.position.x) < 1) {
-                activatePowerUp(p);
-                scene.remove(p);
-                powerUps.splice(i, 1);
-            }
-
-            if (p.position.z > 10) {
-                scene.remove(p);
-                powerUps.splice(i, 1);
-            }
-        });
-
-        document.getElementById("score").innerText = score;
-        document.getElementById("combo").innerText = `Combo: x${combo}`;
-    }
-
-    renderer.render(scene, camera);
-}
-
-function endGame() {
-    gameRunning = false;
-    if (score > highScore) {
-        highScore = score;
-        localStorage.setItem("highScore", highScore);
-    }
-    alert("Game Over! Score: " + score);
-    document.getElementById("startScreen").style.display = "flex";  // Restart the game
-    document.getElementById("pauseBtn").style.display = "none";
-}
+    state.score += dt * (effectiveSpeed * 0.5) * state.multiplier;
+
+    if (Math.floor(state.score) > state.highScore) {
+      state.highScore = Math.floor(state.score);
+    }
+
+    if (state.worldTurnPreview) {
+      state.worldTurnPreview = null;
+      state.chasePressure = Math.max(0, state.chasePressure - 0.1);
+    }
+
+    if (state.combo > 0 && Math.random() < 0.012) {
+      state.combo -= 1;
+    }
+  }
+
+  function project(lane, z, y = 0) {
+    const depth = z - state.distance;
+    const normalized = Math.max(0.04, 1 - depth / CONFIG.visibleDepth);
+    const horizon = canvas.height * 0.24;
+    const roadBaseWidth = canvas.width * 0.85;
+    const roadWidth = roadBaseWidth * normalized;
+    const x = canvas.width / 2 + (laneToX(lane) / (CONFIG.laneWidth * 1.6)) * roadWidth * 0.48;
+    const screenY = horizon + (1 - normalized) * canvas.height * 0.72 - y * normalized;
+    return { x, y: screenY, scale: normalized, depth };
+  }
+
+  function drawRoad() {
+    const horizon = canvas.height * 0.24;
+    const grad = ctx.createLinearGradient(0, horizon, 0, canvas.height);
+    grad.addColorStop(0, '#24384f');
+    grad.addColorStop(1, '#0b1017');
+    ctx.fillStyle = grad;
+    ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);
+
+    for (let z = state.distance % 60; z < CONFIG.visibleDepth; z += 60) {
+      const a = project(0, state.distance + z);
+      const b = project(0, state.distance + z + 60);
+      const alpha = 0.12 + (1 - z / CONFIG.visibleDepth) * 0.14;
+      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
+      ctx.fillRect(0, b.y, canvas.width, Math.max(1, a.y - b.y));
+    }
+
+    for (let lane = 0; lane < 3; lane++) {
+      for (let z = 0; z < CONFIG.visibleDepth; z += 70) {
+        const p = project(lane, state.distance + z);
+        ctx.fillStyle = 'rgba(255,255,255,0.14)';
+        ctx.fillRect(p.x - 2, p.y, 4, Math.max(2, 8 * p.scale));
+      }
+    }
+  }
+
+  function drawEntity(entity) {
+    const p = project(entity.lane ?? 1, entity.z, 0);
+    if (p.depth < 0 || p.depth > CONFIG.visibleDepth) return;
+
+    if (entity.type === 'coin') {
+      ctx.fillStyle = '#ffd24c';
+      ctx.beginPath();
+      ctx.arc(p.x, p.y - 22 * p.scale, 8 + 8 * p.scale, 0, Math.PI * 2);
+      ctx.fill();
+      return;
+    }
+
+    if (entity.type === 'powerup') {
+      ctx.fillStyle = entity.color;
+      ctx.fillRect(p.x - 12 * p.scale, p.y - 30 * p.scale, 24 * p.scale, 24 * p.scale);
+      return;
+    }
+
+    if (entity.type === 'turnGate') {
+      ctx.strokeStyle = entity.direction === 'left' ? '#7cd8ff' : '#f89cff';
+      ctx.lineWidth = 2 + 3 * p.scale;
+      ctx.strokeRect(p.x - 32 * p.scale, p.y - 54 * p.scale, 64 * p.scale, 48 * p.scale);
+      ctx.fillStyle = 'rgba(255,255,255,0.9)';
+      ctx.font = `${10 + 14 * p.scale}px sans-serif`;
+      ctx.textAlign = 'center';
+      ctx.fillText(entity.direction === 'left' ? 'A' : 'D', p.x, p.y - 26 * p.scale);
+      return;
+    }
+
+    if (entity.type === 'obstacle') {
+      ctx.fillStyle = entity.color || '#f15d5d';
+      const h = entity.requires === 'slide' ? 80 : 42;
+      const yOffset = entity.requires === 'slide' ? 80 : 34;
+      ctx.fillRect(p.x - 18 * p.scale, p.y - yOffset * p.scale, 36 * p.scale, h * p.scale);
+    }
+  }
+
+  function drawPlayer() {
+    const p = state.player;
+    const baseY = canvas.height * 0.84 - p.y * 0.26;
+
+    ctx.save();
+    ctx.translate(canvas.width / 2 + p.laneVisualX, baseY);
+    const flash = p.crashedFlash > 0 ? Math.floor((Math.sin(performance.now() * 0.06) + 1) * 100) : 0;
+    ctx.fillStyle = `rgb(${40 + flash}, ${220 - flash * 0.5}, 185)`;
+    const bodyH = p.slideTimer > 0 ? 30 : 58;
+    ctx.fillRect(-20, -bodyH, 40, bodyH);
+    ctx.fillStyle = '#102330';
+    ctx.fillRect(-11, -bodyH - 18, 22, 18);
+
+    if (hasPower('shield')) {
+      ctx.strokeStyle = 'rgba(93,139,255,0.85)';
+      ctx.lineWidth = 4;
+      ctx.beginPath();
+      ctx.arc(0, -24, 34, 0, Math.PI * 2);
+      ctx.stroke();
+    }
+    ctx.restore();
+
+    const chaseWidth = 220;
+    const chaseX = canvas.width / 2 - chaseWidth / 2;
+    const chaseY = canvas.height - 30;
+    ctx.fillStyle = 'rgba(255,255,255,0.15)';
+    ctx.fillRect(chaseX, chaseY, chaseWidth, 8);
+    ctx.fillStyle = '#ff5d73';
+    ctx.fillRect(chaseX, chaseY, chaseWidth * state.chasePressure, 8);
+  }
+
+  function render() {
+    ctx.clearRect(0, 0, canvas.width, canvas.height);
+
+    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.55);
+    sky.addColorStop(0, '#375e84');
+    sky.addColorStop(1, '#182636');
+    ctx.fillStyle = sky;
+    ctx.fillRect(0, 0, canvas.width, canvas.height);
+
+    drawRoad();
+    state.entities.forEach(drawEntity);
+    drawPlayer();
+  }
+
+  function updateHud() {
+    ui.score.textContent = `Score: ${Math.floor(state.score)}`;
+    ui.coins.textContent = `Coins: ${state.bankedCoins + state.coins}`;
+    ui.multiplier.textContent = `Multiplier: x${state.multiplier.toFixed(2)}`;
+    ui.distance.textContent = `Distance: ${Math.floor(state.distance / 3)}m`;
+    ui.highScore.textContent = `Best: ${state.highScore}`;
+
+    if (state.mode === 'revivePrompt') {
+      ui.status.textContent = `Status: Reviving in ${state.pendingReviveUntil.toFixed(1)}s`;
+    }
+
+    ui.powerList.innerHTML = '';
+    [...state.activePowers.entries()].forEach(([id, seconds]) => {
+      const el = document.createElement('div');
+      el.className = 'pill';
+      el.textContent = `${id}: ${seconds.toFixed(1)}s`;
+      ui.powerList.appendChild(el);
+    });
+  }
+
+  function resetRun() {
+    state.mode = 'running';
+    state.elapsed = 0;
+    state.score = 0;
+    state.coins = 0;
+    state.distance = 0;
+    state.speed = CONFIG.baseSpeed;
+    state.multiplier = 1;
+    state.combo = 0;
+    state.nextDifficultyGate = CONFIG.difficultyPaceMeters;
+    state.pendingReviveUntil = 0;
+    state.player = createPlayer();
+    state.entities = [];
+    state.segments = [];
+    state.nextSegmentZ = 0;
+    state.worldTurnPreview = null;
+    state.activePowers.clear();
+    state.chasePressure = 0;
+    state.chaseCooldown = 0;
+    ensureWorld();
+  }
+
+  function endRun() {
+    state.mode = 'gameover';
+    state.bankedCoins += state.coins;
+    state.highScore = Math.max(state.highScore, Math.floor(state.score));
+    saveProgress();
+
+    ui.runSummary.textContent = `Score ${Math.floor(state.score)} • Distance ${Math.floor(
+      state.distance / 3
+    )}m • Coins +${state.coins} • Lifetime Coins ${state.bankedCoins}`;
+
+    ui.gameOverScreen.classList.remove('hidden');
+    ui.hud.classList.add('hidden');
+    ui.powerList.classList.add('hidden');
+  }
+
+  let lastFrame = performance.now();
+  function loop(now) {
+    const dt = Math.min(0.05, (now - lastFrame) / 1000);
+    lastFrame = now;
+
+    update(dt);
+    render();
+    updateHud();
+
+    input.resetFrameFlags();
+    requestAnimationFrame(loop);
+  }
+
+  function onKeyDown(e) {
+    if (e.repeat) return;
+    const key = e.key.toLowerCase();
+    if (key === 'arrowleft') input.left = true;
+    else if (key === 'arrowright') input.right = true;
+    else if (key === 'arrowup') input.jump = true;
+    else if (key === 'arrowdown') input.slide = true;
+    else if (key === 'a') input.turnLeft = true;
+    else if (key === 'd') input.turnRight = true;
+    else if (key === 'p') input.pause = true;
+  }
+
+  let touchStart = null;
+  function onTouchStart(ev) {
+    const t = ev.changedTouches[0];
+    touchStart = { x: t.clientX, y: t.clientY };
+  }
+  function onTouchEnd(ev) {
+    if (!touchStart) return;
+    const t = ev.changedTouches[0];
+    const dx = t.clientX - touchStart.x;
+    const dy = t.clientY - touchStart.y;
+
+    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
+      if (dx > 0) input.right = true;
+      else input.left = true;
+    } else if (Math.abs(dy) > 24) {
+      if (dy < 0) input.jump = true;
+      else input.slide = true;
+    }
+    touchStart = null;
+  }
+
+  function bindUi() {
+    ui.startBtn.addEventListener('click', () => {
+      resetRun();
+      ui.startScreen.classList.add('hidden');
+      ui.gameOverScreen.classList.add('hidden');
+      ui.hud.classList.remove('hidden');
+      ui.powerList.classList.remove('hidden');
+      ui.status.textContent = 'Status: Running';
+    });
+
+    ui.restartBtn.addEventListener('click', () => {
+      resetRun();
+      ui.gameOverScreen.classList.add('hidden');
+      ui.hud.classList.remove('hidden');
+      ui.powerList.classList.remove('hidden');
+      ui.status.textContent = 'Status: Running';
+    });
+
+    ui.menuBtn.addEventListener('click', () => {
+      state.mode = 'intro';
+      ui.gameOverScreen.classList.add('hidden');
+      ui.startScreen.classList.remove('hidden');
+      ui.hud.classList.add('hidden');
+      ui.powerList.classList.add('hidden');
+      ui.status.textContent = 'Status: Ready';
+    });
+
+    window.addEventListener('keydown', onKeyDown);
+    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
+    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
+    window.addEventListener('resize', resize);
+  }
+
+  function init() {
+    loadSave();
+    resize();
+    state.player = createPlayer();
+    ensureWorld();
+    bindUi();
+    updateHud();
+    requestAnimationFrame(loop);
+  }
+
+  init();
+})();
 
EOF
)
