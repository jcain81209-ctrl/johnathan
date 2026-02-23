// =====================================
// JOHNATHAN 3D MOBILE RUNNER
// =====================================

let scene, camera, renderer;
let player, ground;
let obstacles = [];

let lane = 0;
let targetX = 0;
let speed = 0.9;

let gameStarted = false;
let velocityY = 0;
let gravity = -0.02;
let isJumping = false;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("startBtn").addEventListener("click", startGame);
});

function startGame() {
    document.getElementById("startScreen").style.display = "none";
    init();
    animate();
    gameStarted = true;
}

function init() {

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 15, 90);

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
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 20, 10);
    light.castShadow = true;
    scene.add(light);

    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);

    // Ground
    const groundGeo = new THREE.BoxGeometry(12, 1, 400);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.z = -180;
    ground.receiveShadow = true;
    scene.add(ground);

    // Player
    const playerGeo = new THREE.BoxGeometry(1.5, 2, 1.5);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.y = 1;
    player.castShadow = true;
    scene.add(player);

    spawnObstacle();

    window.addEventListener("resize", onResize);
}

// ===========================
// SPAWN OBSTACLES
// ===========================

function spawnObstacle() {

    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const obstacle = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    obstacle.position.x = randomLane * 4;
    obstacle.position.y = 1;
    obstacle.position.z = -250;

    obstacle.castShadow = true;

    scene.add(obstacle);
    obstacles.push(obstacle);

    setTimeout(spawnObstacle, 1200);
}

// ===========================
// ANIMATION LOOP
// ===========================

function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {

        // Smooth lane movement
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

            // Collision
            if (
                Math.abs(o.position.x - player.position.x) < 1.5 &&
                Math.abs(o.position.z - player.position.z) < 1.5 &&
                player.position.y < 2
            ) {
                alert("Game Over");
                location.reload();
            }
        });
    }

    renderer.render(scene, camera);
}

// ===========================
// MOBILE SWIPE CONTROLS
// ===========================

let touchStartX = 0;
let touchStartY = 0;

window.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

window.addEventListener("touchend", (e) => {

    if (!gameStarted) return;

    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;

    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;

    // Horizontal swipe = lane switch
    if (Math.abs(dx) > Math.abs(dy)) {

        if (dx > 50) lane++;
        if (dx < -50) lane--;

        lane = Math.max(-1, Math.min(1, lane));
    }

    // Swipe up = jump
    if (dy < -50 && !isJumping) {
        isJumping = true;
        velocityY = 0.4;
    }
});

// ===========================
// RESIZE
// ===========================

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
