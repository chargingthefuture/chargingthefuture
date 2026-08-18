# Wallpaper sources

Each `.html` file here is the source for one phone wallpaper carrying the Skills Economy
"Stack" logo (the three ascending bars, teal-to-purple gradient). The vector path and colors
are copied from the brand mark in
`ctf/packages/web/components/shared/se-mark.tsx` — if the brand mark ever changes, update the
path here to match and re-render.

The rendered PNGs are committed at `ctf/packages/web/public/brand/wallpapers/` (so the web app
serves them) and are attached to a GitHub Release by the
`.github/workflows/wallpapers-release.yml` workflow, which is where members download them —
the same Releases page that carries the Android APK.

## Sizes

| Source file | Output | Fits |
|---|---|---|
| `se-wallpaper-iphone-16e.html` | 1170 × 2532 | iPhone 16e / 14 / 13 (native resolution) |
| `se-wallpaper-android.html` | 1080 × 2400 | Most current Android phones (FHD+ 20:9) |

## Re-rendering

Render with headless Chromium (any recent Chrome/Chromium works; no other tools needed).
The window size must match the page size set in the file's CSS:

```bash
chromium --headless --no-sandbox --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1170,2532 \
  --screenshot=se-wallpaper-iphone-16e-1170x2532.png \
  "file://$PWD/se-wallpaper-iphone-16e.html"
```

To add a new size, copy one of the sources, change the `html, body` width/height and nudge the
layout values (glow positions, logo width, `top` of `.center`) proportionally, then render with
the matching `--window-size`.

Design notes: background and text colors come from the brand lockup
(`ctf/packages/web/public/brand/se-lockup.svg` — background `#0F0E17`, muted text `#9B9490`).
The logo sits in the lower middle so the phone lock-screen clock stays clear, and the glows are
kept dim so notification text stays readable.
