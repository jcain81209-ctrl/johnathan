// =====================================
// JOHNATHAN ULTIMATE - PLAYER SYSTEM
// =====================================

const Player = {

    x: 0,
    y: 0,
    targetX: 0,
    width: 60,
    height: 90,
    velocityY: 0,
    isJumping: false,
    isSliding: false,
    slideTimer: 0,
    shield: false,
    shieldTimer: 0,
    magnet: false,
    magnetTimer: 0,
    trail: [],
    color: "#00ffff",

    init() {
        this.y = canvas.height - 180;
        this.x = LANES.getX(Game.lane);
        this.targetX = this.x;
    },

    update() {

        // Smooth lane movement
        this.targetX = LANES.getX(Game.lane);
        this.x += (this.targetX - this.x) * 0.2;

        // Jump physics
        if (this.isJumping) {
            this.velocityY += Game.gravity;
            this.y += this.velocityY;

            if (this.y >= canvas.height - 180) {
                this.y = canvas.height - 180;
                this.isJumping = false;
                this.velocityY = 0;
            }
        }

        // Slide timer
        if (this.isSliding) {
            this.slideTimer--;
            if (this.slideTimer <= 0) {
                this.isSliding = false;
            }
        }

        // Shield timer
        if (this.shield) {
            this.shieldTimer--;
            if (this.shieldTimer <= 0) this.shield = false;
        }

        // Magnet timer
        if (this.magnet) {
            this.magnetTimer--;
            if (this.magnetTimer <= 0) this.magnet = false;
        }

        // Trail particles
        this.trail.push({
            x: this.x,
            y: this.y + this.height,
            life: 20
        });

        this.trail.forEach(p => p.life--);
        this.trail = this.trail.filter(p => p.life > 0);
    },

    jump() {
        if (!this.isJumping) {
            this.isJumping = true;
            this.velocityY = -22;
        }
    },

    slide() {
        if (!this.isSliding && !this.isJumping) {
            this.isSliding = true;
            this.slideTimer = 40;
        }
    },

    activateShield() {
        this.shield = true;
        this.shieldTimer = 300;
    },

    activateMagnet() {
        this.magnet = true;
        this.magnetTimer = 400;
    },

    draw() {

        // Draw trail
        this.trail.forEach(p => {
            ctx.globalAlpha = p.life / 20;
            ctx.fillStyle = "#00ffff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;

        // Shield aura
        if (this.shield) {
            ctx.strokeStyle = "#00ffff";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 60, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Player body
        ctx.fillStyle = this.color;

        if (this.isSliding) {
            ctx.fillRect(
                this.x - this.width / 2,
                this.y + 40,
                this.width,
                this.height / 2
            );
        } else {
            ctx.fillRect(
                this.x - this.width / 2,
                this.y,
                this.width,
                this.height
            );
        }
    }
};

// ---------------------------
// TOUCH CONTROLS
// ---------------------------

let touchStartY = 0;

canvas.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
});

canvas.addEventListener("touchend", (e) => {
    let endY = e.changedTouches[0].clientY;

    if (touchStartY - endY > 50) {
        Player.jump();
    } else if (endY - touchStartY > 50) {
        Player.slide();
    }
});

// Initialize player
Player.init();
