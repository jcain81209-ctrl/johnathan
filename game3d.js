// Set up global variables
let scene, camera, renderer;
let player, ground;
let obstacles = [];
let coins = [];
let powerUps = [];

let lane = 0;
let targetX = 0;
let speed = 0.8;
let score = 0;
let highScore = localStorage.getItem("highScore") || 0;

let gameRunning = false;
let paused = false;

let velocityY = 0;
let gravity = -0.02;
let jumping = false;
let sliding = false;

let powerUpTimer = 0;
let currentPowerUp = null;

let combo = 1;
let maxCombo = 1;

let isShaking = false;
let shakeAmount = 0;

let jumpAnimation = 0;

// Initialize the scene
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);  // Light sky blue color for the sky

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);

    // Create the path, player, and environment
    createGround();
    createPlayer();
    spawnTerrain();
    spawnObstacles();
    spawnCoins();
    spawnPowerUps();

    // Event listeners
    document.getElementById("startBtn").onclick = function() {
        startGame();
    };
    document.getElementById("pauseBtn").onclick = togglePause;
    document.addEventListener("keydown", handleKey);
    document.addEventListener("touchstart", handleTouch);

    document.getElementById("highScore").innerText = highScore;
    document.getElementById("score").innerText = score;
    document.getElementById("combo").innerText = `Combo: x${combo}`;
}

// Start the game
function startGame() {
    gameRunning = true;
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("pauseBtn").style.display = "block";
    animate();
}

// Pause functionality
function togglePause() {
    paused = !paused;
}

// Handle player movement
function handleKey(e) {
    if (!gameRunning) return;

    if (e.key === "ArrowLeft") lane = Math.max(-1, lane - 1);
    if (e.key === "ArrowRight") lane = Math.min(1, lane + 1);
    if (e.key === "ArrowUp" && !jumping) {
        velocityY = 0.35;
        jumping = true;
    }
    if (e.key === "ArrowDown" && !sliding) {
        sliding = true;
        setTimeout(() => { sliding = false; }, 500); // Slide duration
    }
}

// Handle touch controls for mobile
function handleTouch(e) {
    if (!gameRunning) return;

    const x = e.touches[0].clientX;
    if (x < window.innerWidth / 3) lane = Math.max(-1, lane - 1);
    else if (x > window.innerWidth * 2 / 3) lane = Math.min(1, lane + 1);
    else if (!jumping) {
        velocityY = 0.35;
        jumping = true;
    }
}

// ======================
// Dynamic Power-ups
// ======================

function spawnPowerUp() {
    if (!gameRunning) return;

    const powerUpType = Math.floor(Math.random() * 4);  // Randomize power-up
    let geo, mat;

    if (powerUpType === 0) {  // Speed Boost
        geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
        mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });  // Green for speed
    } else if (powerUpType === 1) {  // Shield
        geo = new THREE.SphereGeometry(0.5, 16, 16);
        mat = new THREE.MeshStandardMaterial({ color: 0x0000ff });  // Blue for shield
    } else if (powerUpType === 2) {  // Magnet
        geo = new THREE.SphereGeometry(0.6, 16, 16);
        mat = new THREE.MeshStandardMaterial({ color: 0xffd700 });  // Yellow for magnet
    } else {  // Double Points
        geo = new THREE.TorusGeometry(0.7, 0.3, 16, 100);
        mat = new THREE.MeshStandardMaterial({ color: 0xff6347 });  // Red for double points
    }

    const powerUp = new THREE.Mesh(geo, mat);
    const randomLane = Math.floor(Math.random() * 3) - 1;
    powerUp.position.x = randomLane * 4;
    powerUp.position.y = 2;
    powerUp.position.z = -300;
    powerUp.type = powerUpType;

    scene.add(powerUp);
    powerUps.push(powerUp);

    setTimeout(spawnPowerUp, 5000 + Math.random() * 5000);
}

// ======================
// Obstacles & Terrain
// ======================

function spawnObstacle() {
    if (!gameRunning) return;

    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x552200 });  // Obstacles in brown
    const obstacle = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    obstacle.position.x = randomLane * 4;
    obstacle.position.y = 1;
    obstacle.position.z = -300;

    scene.add(obstacle);
    obstacles.push(obstacle);

    setTimeout(spawnObstacle, 1500);
}

function spawnCoin() {
    if (!gameRunning) return;

    const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 100);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700 });  // Golden coins
    const coin = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    coin.position.x = randomLane * 4;
    coin.position.y = 2;
    coin.position.z = -250;

    scene.add(coin);
    coins.push(coin);

    setTimeout(spawnCoin, 1000);  // Spawn coins over time
}

// ======================
// Animate Game
// ======================

function animate() {
    requestAnimationFrame(animate);

    if (gameRunning && !paused) {

        speed += 0.0002;

        targetX = lane * 4;
        player.position.x += (targetX - player.position.x) * 0.2;

        if (jumping) {
            velocityY += gravity;
            player.position.y += velocityY;

            if (player.position.y <= 1) {
                player.position.y = 1;
                jumping = false;
            }
        }

        if (sliding) {
            player.scale.y = 0.5;
            setTimeout(() => { sliding = false; player.scale.y = 2; }, 500);
        }

        obstacles.forEach((o, i) => {
            o.position.z += speed;

            if (Math.abs(o.position.z) < 1 &&
                Math.abs(o.position.x - player.position.x) < 1 &&
                player.position.y < 2) {
                endGame();
            }

            if (o.position.z > 10) {
                scene.remove(o);
                obstacles.splice(i, 1);
            }
        });

        coins.forEach((c, i) => {
            c.rotation.y += 0.1;
            c.position.z += speed;

            if (Math.abs(c.position.z) < 1 &&
                Math.abs(c.position.x - player.position.x) < 1) {
                score += 10;
                scene.remove(c);
                coins.splice(i, 1);
            }

            if (c.position.z > 10) {
                scene.remove(c);
                coins.splice(i, 1);
            }
        });

        powerUps.forEach((p, i) => {
            p.position.z += speed;

            if (Math.abs(p.position.z) < 1 &&
                Math.abs(p.position.x - player.position.x) < 1) {
                activatePowerUp(p);
                scene.remove(p);
                powerUps.splice(i, 1);
            }

            if (p.position.z > 10) {
                scene.remove(p);
                powerUps.splice(i, 1);
            }
        });

        document.getElementById("score").innerText = score;
        document.getElementById("combo").innerText = `Combo: x${combo}`;
    }

    renderer.render(scene, camera);
}

function endGame() {
    gameRunning = false;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
    }
    alert("Game Over! Score: " + score);
    document.getElementById("startScreen").style.display = "flex";  // Restart the game
    document.getElementById("pauseBtn").style.display = "none";
}
