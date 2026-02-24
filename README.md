# Temple Sprint (Browser Runner)

A Temple Run-inspired endless runner built with HTML5 Canvas and vanilla JavaScript.

## Highlights

- Stylized pseudo-3D jungle scene with a dark sky and layered trees
- Brick temple road with dynamic gaps (jump timing challenge)
- Detailed runner sprite with jump + slide states
- Coin collection + escalating speed and score
- Desktop keyboard controls
- Mobile swipe controls and iOS tilt support
- Fullscreen responsive layout for GitHub Pages
- Best-score persistence with `localStorage`

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
- Tap **Enable Tilt** to allow accelerometer lane steering (supported devices)

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>

## Deploy to GitHub Pages

1. Push these files to your GitHub repository root.
2. In **Settings → Pages**, choose **Deploy from a branch**.
3. Select `main` and `/ (root)`.
4. Save and use the generated Pages URL.
