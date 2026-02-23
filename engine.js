// =====================================
// JOHNATHAN ULTIMATE - ENGINE CORE
// =====================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ---------------------------
// GLOBAL GAME STATE
// ---------------------------

const Game = {
    state: "menu", // menu | playing | gameover | shop
    score: 0,
    highScore: localStorage.getItem("johnathanHighScore") || 0,
    coins: parseInt(localStorage.getItem("johnathanCoins")) || 0,
    speed: 12,
    gravity: 1,
    lane: 1,
    tiltX: 0,
    combo: 1,
    screenShake: 0,
    bossMode: false,
    bossTimer: 0
};

// ---------------------------
// LANES
// ---------------------------

const LANES = {
    count: 3,
    width: canvas.width / 3,
    getX(lane) {
        return lane * this.width + this.width / 2;
    }
};

// ---------------------------
// INPUT (Tilt + Touch)
// ---------------------------

async function enableMotion() {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
        await DeviceMotionEvent.requestPermission();
    }

    window.addEventListener("devicemotion", (e) => {
        Game.tiltX = e.accelerationIncludingGravity.x;
    });
}

// Lane switching via tilt
function handleTilt() {
    if (Game.tiltX > 6 && Game.lane > 0) Game.lane--;
    if (Game.tiltX < -6 && Game.lane < 2) Game.lane++;
}

// ---------------------------
// START BUTTON
// ---------------------------

document.getElementById("startBtn").addEventListener("click", async () => {
    await enableMotion();
    document.getElementById("menuScreen").style.display = "none";
    Game.state = "playing";
});

// ---------------------------
// GAME LOOP
// ---------------------------

function update() {

    if (Game.state !== "playing") return;

    handleTilt();

    if (typeof Player !== "undefined") Player.update();
    if (typeof World !== "undefined") World.update();
    if (typeof UI !== "undefined") UI.update();

    Game.score += 1 * Game.combo;
    Game.speed += 0.002;

    if (Game.score % 1500 === 0 && Game.score !== 0 && !Game.bossMode) {
        Game.bossMode = true;
        Game.bossTimer = 600;
    }

    if (Game.bossMode) {
        Game.bossTimer--;
        if (Game.bossTimer <= 0) Game.bossMode = false;
    }
}

function draw() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (typeof World !== "undefined") World.draw();
    if (typeof Player !== "undefined") Player.draw();
    if (typeof UI !== "undefined") UI.draw();
}

function gameLoop() {

    if (Game.screenShake > 0) {
        canvas.style.transform =
            `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`;
        Game.screenShake--;
    } else {
        canvas.style.transform = "translate(0,0)";
    }

    update();
    draw();

    requestAnimationFrame(gameLoop);
}

gameLoop();
