// =====================================
// JUNGLE RUNNER - FULL VERSION
// =====================================

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
let combo = 1;
let isPaused = false;
let isJumping = false;
let velocityY = 0;
let gravity = -0.02;
let isSliding = false;
let currentPowerUp = null;
let powerUpTimer = 0;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("startBtn").addEventListener("click", startGame);
    document.getElementById("pauseBtn").addEventListener("click", togglePause);
});

function startGame() {
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("pauseBtn").style.display = "block";
    init();
    animate();
    gameStarted = true;
}

function togglePause() {
    if (isPaused) {
        gameStarted = true;
        isPaused = false;
        document.getElementById("pauseBtn").style.display = "none";  // Hide pause button
    } else {
        gameStarted = false;
        isPaused = true;
        document.getElementById("pauseBtn").style.display = "block";  // Show pause button
    }
}

function init() {

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b3d0b, 20, 120);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    camera.position.set(0, 6, 12);
    camera.rotation.x = -0.35;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 20, 10);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);

    // Jungle Ground (brown path)
    const groundGeo = new THREE.BoxGeometry(12, 1, 500);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4e2f1b });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.z = -200;
    scene.add(ground);

    // Player (stone idol vibe)
    const playerGeo = new THREE.BoxGeometry(1.5, 2, 1.5);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xdedede });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.y = 1;
    scene.add(player);

    spawnObstacle();
    spawnCoin();
    spawnPowerUp();
    spawnTrees();

    window.addEventListener("resize", onResize);
}

// ======================
// JUNGLE TREES
// ======================

function spawnTrees() {

    for (let i = 0; i < 10; i++) {

        const trunkGeo = new THREE.CylinderGeometry(0.5 + Math.random() * 0.5, 0.5 + Math.random() * 0.5, 8 + Math.random() * 5);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b1c });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);

        trunk.position.x = (Math.random() > 0.5 ? 10 : -10);
        trunk.position.y = 4;
        trunk.position.z = -Math.random() * 400;

        scene.add(trunk);

        const leavesGeo = new THREE.SphereGeometry(5 + Math.random() * 4);
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1e7d30 });
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);

        leaves.position.set(trunk.position.x, trunk.position.y + 6, trunk.position.z);

        scene.add(leaves);
    }
}

// ======================
// OBSTACLES
// ======================

function spawnObstacle() {

    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x552200 });
    const obstacle = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    obstacle.position.x = randomLane * 4;
    obstacle.position.y = 1;
    obstacle.position.z = -300;

    // Add a random turn
    if (Math.random() > 0.7) {
        obstacle.rotation.y = Math.random() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
    }

    scene.add(obstacle);
    obstacles.push(obstacle);

    setTimeout(spawnObstacle, 1500);
}

// ======================
// COINS
// ======================

function spawnCoin() {

    const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 50);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    const coin = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    coin.position.x = randomLane * 4;
    coin.position.y = 2;
    coin.position.z = -250;

    scene.add(coin);
    coins.push(coin);

    setTimeout(spawnCoin, 1000);
}

// ======================
// POWER-UPS
// ======================

function spawnPowerUp() {

    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const powerUp = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    powerUp.position.x = randomLane * 4;
    powerUp.position.y = 2;
    powerUp.position.z = -200;

    scene.add(powerUp);
    powerUps.push(powerUp);

    setTimeout(spawnPowerUp, 5000);
}

// ======================
// ANIMATION
// ======================

function animate() {
    requestAnimationFrame(animate);

    if (gameStarted && !isPaused) {

        speed += 0.0002;

        targetX = lane * 4;
        player.position.x += (targetX - player.position.x) * 0.2;

        // Jump physics
        if (isJumping) {
            velocityY += gravity;
            player.position.y += velocityY;

            if (player.position.y <= 1) {
                player.position.y = 1;
                isJumping = false;
                velocityY = 0;
            }
        }

        // Move obstacles
        obstacles.forEach((o, index) => {
            o.position.z += speed;

            if (o.position.z > 10) {
                scene.remove(o);
                obstacles.splice(index, 1);
            }

            if (
                Math.abs(o.position.x - player.position.x) < 1.5 &&
                Math.abs(o.position.z - player.position.z) < 1.5 &&
                player.position.y < 2
            ) {
                alert("You hit an obstacle! Final Score: " + score);
                location.reload();
            }
        });

        // Move coins
        coins.forEach((c, index) => {
            c.rotation.x += 0.1;
            c.rotation.y += 0.1;
            c.position.z += speed;

            if (
                Math.abs(c.position.x - player.position.x) < 1.5 &&
                Math.abs(c.position.z - player.position.z) < 1.5
            ) {
                scene.remove(c);
                coins.splice(index, 1);
                score += 10 * combo;
                updateScore();
            }

            if (c.position.z > 10) {
                scene.remove(c);
                coins.splice(index, 1);
            }
        });

        // Move power-ups
        powerUps.forEach((p, index) => {
            p.position.z += speed;

            if (
                Math.abs(p.position.x - player.position.x) < 1.5 &&
                Math.abs(p.position.z - player.position.z) < 1.5
            ) {
                scene.remove(p);
                powerUps.splice(index, 1);
                activatePowerUp();
            }

            if (p.position.z > 10) {
                scene.remove(p);
                powerUps.splice(index, 1);
            }
        });
    }

    renderer.render(scene, camera);
}

// ======================
// SWIPE CONTROLS
// ======================

let touchStartX = 0;
let touchStartY = 0;

window.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

window.addEventListener("touchend", (e) => {

    if (!gameStarted) return;

    let dx = e.changedTouches[0].clientX - touchStartX;
    let dy = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {

        if (dx > 50) lane++;
        if (dx < -50) lane--;

        lane = Math.max(-1, Math.min(1, lane));
    }

    if (dy < -50 && !isJumping) {
        isJumping = true;
        velocityY = 0.4;
    }

    if (dy > 50 && !isSliding) {
        isSliding = true;
    }
});

// ======================
// SCORE AND UI
// ======================

function updateScore() {
    document.getElementById("scoreText").textContent = "Score: " + score;
    document.getElementById("highScoreText").textContent = "High Score: " + highScore;
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
