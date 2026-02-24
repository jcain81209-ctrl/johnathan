# Temple Sprint (Nightmare Skill Mode)

A Temple Run-inspired endless runner for browser (GitHub Pages-ready) with a heavier horror art direction.

## What changed

- Infernal nightmare visual theme (moon haze, fog layers, ember particles, ruins, skulls, ravens)
- Stylized pseudo-3D brick road with abyss gaps
- Expanded HUD with combo and streak tracking
- FX quality toggle (`FX: HIGH/LOW`) for performance flexibility
- Mobile-friendly controls with swipe handling that blocks browser scroll
- iOS-compatible tilt permission flow

## Controls

### Desktop

- `←` / `A`: move left
- `→` / `D`: move right
- `↑` / `Space`: jump
- `↓` / `S`: slide
- `P`: pause/resume

### Mobile

- Swipe left/right: change lane
- Swipe up: jump
- Swipe down: slide
- Tap **Enable Tilt** for accelerometer lane steering on supported devices

## Run locally

```bash
python3 -m http.server 8000
```

Open: <http://localhost:8000>

## Deploy to GitHub Pages

1. Push files to repo root.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save.
