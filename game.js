const WEMOS_IP = "192.168.1.198"; // CHANGE THIS

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let player = {
    x: canvas.width / 2,
    y: canvas.height - 150,
    size: 40
};

let currentTilt = 0;

async function updateTilt() {
    try {
        const response = await fetch(`http://${WEMOS_IP}/tilt`);
        const data = await response.text();
        currentTilt = parseFloat(data);
    } catch {
        currentTilt = 0;
    }
}

setInterval(updateTilt, 50);

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.x += currentTilt * 10;

    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.size)
        player.x = canvas.width - player.size;

    ctx.fillStyle = "white";
    ctx.fillRect(player.x, player.y, player.size, player.size);

    requestAnimationFrame(gameLoop);
}

gameLoop();
