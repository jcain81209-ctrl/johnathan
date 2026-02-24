# Temple Sprint (Browser Runner)

A Temple Run-inspired endless runner built with HTML5 Canvas and vanilla JavaScript, designed to work on:

- **GitHub Pages**
- **iPhone Safari** (swipe gestures + optional accelerometer tilt)
- **Desktop browsers** (keyboard controls)

## Features

- Endless 3-lane runner gameplay
- Increasing speed and score over time
- Coins and obstacle collisions
- Jump + slide mechanics
- Mobile swipe controls (left/right/up/down)
- iOS tilt steering using `DeviceOrientationEvent` permission flow
- Pause/resume
- Local best-score persistence via `localStorage`
- Responsive full-screen layout

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
- Tap **Enable Tilt** to turn on accelerometer lane steering (when supported)

## Run locally

Because this is static HTML/CSS/JS, you can run with any local web server:

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000`

## Deploy to GitHub Pages

1. Push these files to a GitHub repository.
2. In GitHub repo settings, enable **Pages**.
3. Set source to your default branch root.
4. Visit your provided Pages URL.

