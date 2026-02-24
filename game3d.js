let scene, camera, renderer;
let player;
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

init();
animate();

function init() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 6, 10);
    camera.lookAt(0,1,0);

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5,10,7);
    scene.add(light);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    createGround();
    createPlayer();

    document.getElementById("startBtn").onclick = startGame;
    document.getElementById("pauseBtn").onclick = togglePause;

    document.addEventListener("keydown", handleKey);
    document.addEventListener("touchstart", handleTouch);

    document.getElementById("highScore").innerText = highScore;
}

function createGround() {
    const geo = new THREE.PlaneGeometry(20, 2000);
    const mat = new THREE.MeshStandardMaterial({color:0x654321});
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI/2;
    ground.position.z = -1000;
    scene.add(ground);
}

function createPlayer() {
    const geo = new THREE.BoxGeometry(1,2,1);
    const mat = new THREE.MeshStandardMaterial({color:0xff0000});
    player = new THREE.Mesh(geo, mat);
    player.position.y = 1;
    scene.add(player);
}

function startGame() {
    gameRunning = true;
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("pauseBtn").style.display = "block";
    spawnObstacle();
    spawnCoin();
    spawnPowerUp();
}

function togglePause() {
    paused = !paused;
}

function handleKey(e) {
    if (!gameRunning) return;

    if (e.key === "ArrowLeft") lane = Math.max(-1, lane-1);
    if (e.key === "ArrowRight") lane = Math.min(1, lane+1);
    if (e.key === "ArrowUp" && !jumping) {
        velocityY = 0.35;
        jumping = true;
    }
}

function handleTouch(e) {
    if (!gameRunning) return;

    const x = e.touches[0].clientX;
    if (x < window.innerWidth/3) lane = Math.max(-1, lane-1);
    else if (x > window.innerWidth*2/3) lane = Math.min(1, lane+1);
    else if (!jumping) {
        velocityY = 0.35;
        jumping = true;
    }
}

function spawnObstacle() {
    if (!gameRunning) return;

    const geo = new THREE.BoxGeometry(1.5,2,1.5);
    const mat = new THREE.MeshStandardMaterial({color:0x552200});
    const obj = new THREE.Mesh(geo, mat);

    obj.position.x = (Math.floor(Math.random()*3)-1)*4;
    obj.position.y = 1;
    obj.position.z = -200;

    scene.add(obj);
    obstacles.push(obj);

    setTimeout(spawnObstacle, 1500);
}

function spawnCoin() {
    if (!gameRunning) return;

    const geo = new THREE.TorusGeometry(0.5,0.2,16,100);
    const mat = new THREE.MeshStandardMaterial({color:0xffff00});
    const coin = new THREE.Mesh(geo, mat);

    coin.position.x = (Math.floor(Math.random()*3)-1)*4;
    coin.position.y = 2;
    coin.position.z = -200;

    scene.add(coin);
    coins.push(coin);

    setTimeout(spawnCoin, 1000);
}

function spawnPowerUp() {
    if (!gameRunning) return;

    const geo = new THREE.SphereGeometry(0.6,16,16);
    const mat = new THREE.MeshStandardMaterial({color:0x00ffff});
    const power = new THREE.Mesh(geo, mat);

    power.position.x = (Math.floor(Math.random()*3)-1)*4;
    power.position.y = 1.5;
    power.position.z = -200;

    scene.add(power);
    powerUps.push(power);

    setTimeout(spawnPowerUp, 8000);
}

function animate() {
    requestAnimationFrame(animate);

    if (gameRunning && !paused) {

        speed += 0.00005;

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

        obstacles.forEach((o,i)=>{
            o.position.z += speed;
            if (Math.abs(o.position.z) < 1 &&
                Math.abs(o.position.x-player.position.x)<1 &&
                player.position.y < 2) {
                    endGame();
            }
            if (o.position.z > 10) {
                scene.remove(o);
                obstacles.splice(i,1);
            }
        });

        coins.forEach((c,i)=>{
            c.rotation.y += 0.1;
            c.position.z += speed;
            if (Math.abs(c.position.z) < 1 &&
                Math.abs(c.position.x-player.position.x)<1) {
                    score+=10;
                    scene.remove(c);
                    coins.splice(i,1);
            }
            if (c.position.z > 10) {
                scene.remove(c);
                coins.splice(i,1);
            }
        });

        powerUps.forEach((p,i)=>{
            p.rotation.y += 0.05;
            p.position.z += speed;
            if (Math.abs(p.position.z) < 1 &&
                Math.abs(p.position.x-player.position.x)<1) {
                    speed += 1;
                    scene.remove(p);
                    powerUps.splice(i,1);
            }
            if (p.position.z > 10) {
                scene.remove(p);
                powerUps.splice(i,1);
            }
        });

        score++;
        document.getElementById("score").innerText = score;
    }

    renderer.render(scene,camera);
}

function endGame() {
    gameRunning = false;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
    }
    alert("Game Over! Score: "+score);
    location.reload();
}
