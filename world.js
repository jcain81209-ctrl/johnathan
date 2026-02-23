// =====================================
// JOHNATHAN ULTIMATE - WORLD SYSTEM
// =====================================

const World = {

    obstacles: [],
    coins: [],
    powerups: [],
    roadOffset: 0,

    spawnTimer: 0,
    coinTimer: 0,
    powerTimer: 0,

    update() {

        this.roadOffset += Game.speed;

        // Spawn Obstacles
        this.spawnTimer--;
        if (this.spawnTimer <= 0) {
            this.spawnObstacle();
            this.spawnTimer = 60 - Math.min(Game.score / 500, 40);
        }

        // Spawn Coins
        this.coinTimer--;
        if (this.coinTimer <= 0) {
            this.spawnCoins();
            this.coinTimer = 80;
        }

        // Spawn Powerups
        this.powerTimer--;
        if (this.powerTimer <= 0) {
            this.spawnPower();
            this.powerTimer = 900;
        }

        this.updateObstacles();
        this.updateCoins();
        this.updatePowerups();
    },

    // ---------------------------
    // SPAWN SYSTEMS
    // ---------------------------

    spawnObstacle() {

        const lane = Math.floor(Math.random() * 3);
        const type = Math.random();

        let obstacle = {
            lane,
            x: LANES.getX(lane),
            y: -100,
            width: 70,
            height: 70,
            type: "normal"
        };

        if (type < 0.3) {
            obstacle.type = "low"; // must jump
        } else if (type < 0.6) {
            obstacle.type = "high"; // must slide
        } else {
            obstacle.type = "wide";
            obstacle.width = 100;
        }

        this.obstacles.push(obstacle);
    },

    spawnCoins() {

        const lane = Math.floor(Math.random() * 3);

        for (let i = 0; i < 5; i++) {
            this.coins.push({
                lane,
                x: LANES.getX(lane),
                y: -i * 60,
                size: 20
            });
        }
    },

    spawnPower() {

        const lane = Math.floor(Math.random() * 3);
        const type = Math.random() > 0.5 ? "shield" : "magnet";

        this.powerups.push({
            lane,
            x: LANES.getX(lane),
            y: -80,
            size: 30,
            type
        });
    },

    // ---------------------------
    // UPDATE SYSTEMS
    // ---------------------------

    updateObstacles() {

        this.obstacles.forEach(o => {
            o.y += Game.speed + (Game.bossMode ? 8 : 0);

            if (this.checkCollision(o)) {

                if (Player.shield) {
                    Player.shield = false;
                    Game.screenShake = 20;
                } else {
                    this.gameOver();
                }
            }
        });

        this.obstacles = this.obstacles.filter(o => o.y < canvas.height + 200);
    },

    updateCoins() {

        this.coins.forEach(c => {

            c.y += Game.speed;

            // Magnet pull
            if (Player.magnet) {
                let dx = Player.x - c.x;
                let dy = Player.y - c.y;
                c.x += dx * 0.1;
                c.y += dy * 0.1;
            }

            if (this.checkCoinPickup(c)) {
                Game.coins++;
                Game.combo++;
            }
        });

        this.coins = this.coins.filter(c => c.y < canvas.height + 50);
    },

    updatePowerups() {

        this.powerups.forEach(p => {
            p.y += Game.speed;

            if (this.checkPowerPickup(p)) {
                if (p.type === "shield") Player.activateShield();
                if (p.type === "magnet") Player.activateMagnet();
            }
        });

        this.powerups = this.powerups.filter(p => p.y < canvas.height + 50);
    },

    // ---------------------------
    // COLLISION
    // ---------------------------

    checkCollision(o) {

        let px = Player.x - Player.width / 2;
        let py = Player.y;
        let pw = Player.width;
        let ph = Player.isSliding ? Player.height / 2 : Player.height;

        return (
            px < o.x + o.width / 2 &&
            px + pw > o.x - o.width / 2 &&
            py < o.y + o.height &&
            py + ph > o.y
        );
    },

    checkCoinPickup(c) {

        let dx = Player.x - c.x;
        let dy = Player.y - c.y;

        if (Math.sqrt(dx * dx + dy * dy) < 40) {
            return true;
        }
        return false;
    },

    checkPowerPickup(p) {

        let dx = Player.x - p.x;
        let dy = Player.y - p.y;

        if (Math.sqrt(dx * dx + dy * dy) < 50) {
            return true;
        }
        return false;
    },

    gameOver() {

        Game.state = "gameover";

        if (Game.score > Game.highScore) {
            Game.highScore = Game.score;
            localStorage.setItem("johnathanHighScore", Game.highScore);
        }

        localStorage.setItem("johnathanCoins", Game.coins);

        setTimeout(() => {
            location.reload();
        }, 2000);
    },

    // ---------------------------
    // DRAW SYSTEM
    // ---------------------------

    draw() {

        // Background
        ctx.fillStyle = Game.bossMode ? "#300000" : "#000011";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Lane lines
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3;

        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(LANES.width * i, 0);
            ctx.lineTo(LANES.width * i, canvas.height);
            ctx.stroke();
        }

        // Obstacles
        this.obstacles.forEach(o => {
            ctx.fillStyle = o.type === "low" ? "#ff0044"
                            : o.type === "high" ? "#ffaa00"
                            : "#ff0000";

            ctx.fillRect(
                o.x - o.width / 2,
                o.y,
                o.width,
                o.height
            );
        });

        // Coins
        this.coins.forEach(c => {
            ctx.fillStyle = "#ffff00";
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Powerups
        this.powerups.forEach(p => {
            ctx.fillStyle = p.type === "shield" ? "#00ffff" : "#ff00ff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
};
