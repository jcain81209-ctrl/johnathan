// Initialize sound effects
const audio = {
    background: new Audio('background.mp3'),
    jump: new Audio('jump.mp3'),
    coin: new Audio('coin.mp3'),
    collision: new Audio('collision.mp3'),
    powerup: new Audio('powerup.mp3')
};

// Set volume for all sounds (optional, adjust for balance)
audio.background.volume = 0.3;
audio.jump.volume = 0.5;
audio.coin.volume = 0.7;
audio.collision.volume = 0.6;
audio.powerup.volume = 0.6;

// Start background music (looped)
function startBackgroundMusic() {
    audio.background.loop = true;
    audio.background.play();
}

// Stop background music (for game over or pause)
function stopBackgroundMusic() {
    audio.background.pause();
    audio.background.currentTime = 0;
}

// Trigger jump sound
function playJumpSound() {
    audio.jump.play();
}

// Trigger coin collection sound
function playCoinSound() {
    audio.coin.play();
}

// Trigger collision sound
function playCollisionSound() {
    audio.collision.play();
}

// Trigger power-up collection sound
function playPowerUpSound() {
    audio.powerup.play();
}

// ======================
// Updated Game Loop
// ======================

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue color

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 1, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 7);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);

    createGround();
    createPlayer();

    document.getElementById("startBtn").onclick = startGame;
    document.getElementById("pauseBtn").onclick = togglePause;

    document.addEventListener("keydown", handleKey);
    document.addEventListener("touchstart", handleTouch);

    document.getElementById("highScore").innerText = highScore;
    document.getElementById("score").innerText = score;

    // Start background music
    startBackgroundMusic();
}

// ======================
// Game Events Triggering Sounds
// ======================

function spawnCoin() {
    if (!gameRunning) return;

    const geo = new THREE.TorusGeometry(0.7, 0.3, 16, 100);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    const coin = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    coin.position.x = randomLane * 4;
    coin.position.y = 2;
    coin.position.z = -250;

    scene.add(coin);
    coins.push(coin);

    // Play coin collection sound when coin is collected
    coin.collection = function () {
        playCoinSound();
        score += 10;
    };

    setTimeout(spawnCoin, 1000);
}

function spawnObstacle() {
    if (!gameRunning) return;

    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x552200 });
    const obstacle = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    obstacle.position.x = randomLane * 4;
    obstacle.position.y = 1;
    obstacle.position.z = -300;

    scene.add(obstacle);
    obstacles.push(obstacle);

    // Trigger collision sound on obstacle hit
    obstacle.collide = function () {
        playCollisionSound();
        endGame();
    };

    setTimeout(spawnObstacle, 1500);
}

function spawnPowerUp() {
    if (!gameRunning) return;

    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const powerUp = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    powerUp.position.x = randomLane * 4;
    powerUp.position.y = 2;
    powerUp.position.z = -300;

    scene.add(powerUp);
    powerUps.push(powerUp);

    // Play power-up sound when collected
    powerUp.collect = function () {
        playPowerUpSound();
        speed += 0.5;
    };

    setTimeout(spawnPowerUp, 5000);
}

// ======================
// Main Game Loop: Handling Sounds and Animations
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
                o.collide();
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
                c.collection();
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
                p.collect();
                scene.remove(p);
                powerUps.splice(i, 1);
            }

            if (p.position.z > 10) {
                scene.remove(p);
                powerUps.splice(i, 1);
            }
        });

        document.getElementById("score").innerText = score;
    }

    renderer.render(scene, camera);
}

function endGame() {
    gameRunning = false;
    stopBackgroundMusic(); // Stop background music on game over
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
    }
    document.getElementById("highScore").innerText = highScore;
    alert("Game Over! Score: " + score);
    document.getElementById("startScreen").style.display = "flex"; // Restart game
    document.getElementById("pauseBtn").style.display = "none";
}
