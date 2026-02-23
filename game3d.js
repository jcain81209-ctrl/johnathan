// =====================================
// JOHNATHAN 3D TEMPLE STYLE ENGINE
// =====================================

let scene, camera, renderer;
let player, ground;
let obstacles = [];
let speed = 0.6;
let lane = 0;
let targetX = 0;
let gameStarted = false;

function startGame() {
    document.getElementById("startScreen").style.display = "none";
    init();
    animate();
    gameStarted = true;
}

function init() {

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 10, 60);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 6, 10);
    camera.rotation.x = -0.4;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 20, 10);
    light.castShadow = true;
    scene.add(light);

    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);

    // Ground
    const groundGeo = new THREE.BoxGeometry(12, 1, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    ground.position.z = -90;
    scene.add(ground);

    // Player
    const playerGeo = new THREE.BoxGeometry(1.2, 2, 1.2);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.y = 1;
    player.castShadow = true;
    scene.add(player);

    spawnObstacle();

    window.addEventListener("keydown", handleKeys);
    window.addEventListener("resize", onResize);
}

function handleKeys(e) {
    if (!gameStarted) return;

    if (e.key === "ArrowLeft" && lane > -1) lane--;
    if (e.key === "ArrowRight" && lane < 1) lane++;
}

function spawnObstacle() {
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const obstacle = new THREE.Mesh(geo, mat);

    const randomLane = Math.floor(Math.random() * 3) - 1;
    obstacle.position.x = randomLane * 4;
    obstacle.position.y = 1;
    obstacle.position.z = -120;

    obstacle.castShadow = true;

    scene.add(obstacle);
    obstacles.push(obstacle);

    setTimeout(spawnObstacle, 1200);
}

function animate() {
    requestAnimationFrame(animate);

    if (gameStarted) {

        targetX = lane * 4;
        player.position.x += (targetX - player.position.x) * 0.2;

        obstacles.forEach((o, index) => {
            o.position.z += speed;

            if (o.position.z > 5) {
                scene.remove(o);
                obstacles.splice(index, 1);
            }

            // Collision
            if (
                Math.abs(o.position.x - player.position.x) < 1.5 &&
                Math.abs(o.position.z - player.position.z) < 1.5
            ) {
                alert("Game Over");
                location.reload();
            }
        });
    }

    renderer.render(scene, camera);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
