+# Temple Run Clone Framework Base
+
+This project is a runnable Temple Run-style foundation intended for expansion into a full game.
+
+## Included Systems
+
+- Infinite forward runner loop with speed ramp and difficulty gates.
+- Lane switching (3 lanes), jump, slide, keyboard + touch controls.
+- Procedural segment generator with:
+  - Obstacle placement
+  - Coin placement
+  - Power-up placement
+  - Turn-gates (left/right decision checks)
+- Core obstacles:
+  - `low_barrier` (jump required)
+  - `high_arch` (slide required)
+  - `wide_block` (lane checks + collision pressure)
+- Core power-ups:
+  - `magnet`
+  - `shield`
+  - `boost`
+  - `doubleScore`
+  - `coinRush`
+- Chase-pressure bar (acts like pursuing threat pressure).
+- Revive token flow.
+- HUD + active power timers + pause support.
+- Save data (`localStorage`): high score, total coins, revive token count.
+
+## Architecture
+
+All runtime logic is in `game3d.js`, organized around data and systems:
+
+- `CONFIG`: tuning constants and default values.
+- `CONTENT`: content tables for obstacles, power-ups, and turns.
+- `state`: central runtime model.
+- `spawnSegment()`: procedural content factory.
+- `update()` pipeline:
+  1. input
+  2. powers
+  3. movement
+  4. world spawn/cleanup
+  5. collisions
+  6. score + difficulty + chase pressure
+- `render()` pipeline:
+  1. sky
+  2. road + lanes
+  3. entities
+  4. player + chase bar
+- `updateHud()`: view-model sync.
+
+## Feature Expansion Roadmap (Temple Run parity targets)
+
+Use these extension points to add more Temple Run-complete features:
+
+1. **Missions / Objectives**
+   - Add `missions` table with counters and rewards.
+   - Hook into `pickupCoin`, obstacle dodges, distance milestones.
+2. **Character Unlocks + Upgrade Tree**
+   - Add `meta.characters` + modifiers (e.g. base multiplier, power duration bonuses).
+3. **Permanent Currency Economy**
+   - Add spend flows for revives, boosts, and starter consumables.
+4. **Special Sections / Set Pieces**
+   - Extend segment metadata with unique biome and hazard logic.
+5. **Enemy AI Entities**
+   - Add explicit chaser actor with attack animation states.
+6. **Camera/Animation polish**
+   - Add camera lean on turns, jump squash/stretch, VFX particles.
+7. **Audio System**
+   - Centralized music/SFX mixer with ducking and event cues.
+8. **Daily Challenges**
+   - Seeded runs + challenge objectives + bonus rewards.
+
+## Controls
+
+- `← / →`: change lane
+- `↑`: jump
+- `↓`: slide
+- `A / D`: take turn at turn-gates
+- `P`: pause/resume
+- Touch: swipe left/right/up/down
+
+## Run
+
+Open `index.html` directly or serve with a static server.
+
+Example:
+
+```bash
+python3 -m http.server 4173
+```
+
+Then visit `http://localhost:4173`.
+
+
+## Troubleshooting: page shows raw diff text and buttons do nothing
+
+If the browser shows content like `diff --git ...`, `@@`, `+`, or `-` at the top of the page, your `index.html` was accidentally overwritten with patch text (usually from a bad copy/paste around `git apply`).
+
+### Fix quickly
+
+```bash
+git restore index.html game3d.js
+```
+
+If needed, restore everything to the latest commit:
+
+```bash
+git reset --hard HEAD
+```
+
+Then run again with a local server:
+
+```bash
+python3 -m http.server 4173
+```
+
+Open `http://localhost:4173`.
 
EOF
)
