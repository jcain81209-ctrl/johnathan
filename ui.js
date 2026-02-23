// =====================================
// JOHNATHAN ULTIMATE - UI SYSTEM
// =====================================

const UI = {

    pulse: 0,
    flashAlpha: 0,

    update() {

        this.pulse += 0.1;

        // Boss warning flash
        if (Game.bossMode) {
            this.flashAlpha = Math.abs(Math.sin(Date.now() * 0.01)) * 0.4;
        } else {
            this.flashAlpha = 0;
        }
    },

    draw() {

        ctx.save();

        // =========================
        // TOP HUD PANEL
        // =========================

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, canvas.width, 90);

        ctx.fillStyle = "#00ffff";
        ctx.font = "bold 28px Arial";

        // Score
        ctx.fillText("Score: " + Math.floor(Game.score), 20, 40);

        // High Score
        ctx.fillText("High: " + Game.highScore, 20, 75);

        // Coins
        ctx.fillStyle = "#ffff00";
        ctx.fillText("Coins: " + Game.coins, canvas.width - 200, 40);

        // Speed meter
        ctx.fillStyle = "#ff00ff";
        ctx.fillText("Speed: " + Game.speed.toFixed(1), canvas.width - 200, 75);

        // =========================
        // COMBO MULTIPLIER
        // =========================

        if (Game.combo > 1) {

            ctx.fillStyle = "#ff8800";
            ctx.font = "bold 40px Arial";

            let scale = 1 + Math.sin(this.pulse) * 0.1;

            ctx.save();
            ctx.translate(canvas.width / 2, 120);
            ctx.scale(scale, scale);
            ctx.fillText("x" + Game.combo + " COMBO!", -80, 0);
            ctx.restore();
        }

        // =========================
        // POWER-UP TIMERS
        // =========================

        let barWidth = 200;
        let barHeight = 15;

        if (Player.shield) {
            ctx.fillStyle = "#00ffff";
            ctx.fillRect(
                canvas.width / 2 - barWidth / 2,
                60,
                (Player.shieldTimer / 300) * barWidth,
                barHeight
            );
        }

        if (Player.magnet) {
            ctx.fillStyle = "#ff00ff";
            ctx.fillRect(
                canvas.width / 2 - barWidth / 2,
                80,
                (Player.magnetTimer / 400) * barWidth,
                barHeight
            );
        }

        // =========================
        // BOSS WARNING
        // =========================

        if (Game.bossMode) {

            ctx.fillStyle = "rgba(255,0,0," + this.flashAlpha + ")";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#ff0000";
            ctx.font = "bold 80px Arial";
            ctx.textAlign = "center";

            ctx.fillText("BOSS MODE", canvas.width / 2, canvas.height / 2);
        }

        // =========================
        // GAME OVER OVERLAY
        // =========================

        if (Game.state === "gameover") {

            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#00ffff";
            ctx.font = "bold 60px Arial";
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 60);

            ctx.font = "bold 40px Arial";
            ctx.fillText("Final Score: " + Math.floor(Game.score),
                canvas.width / 2,
                canvas.height / 2
            );

            ctx.fillStyle = "#ffff00";
            ctx.fillText("Coins: " + Game.coins,
                canvas.width / 2,
                canvas.height / 2 + 60
            );

            ctx.font = "24px Arial";
            ctx.fillText("Reloading...",
                canvas.width / 2,
                canvas.height / 2 + 120
            );
        }

        ctx.restore();
    }
};
