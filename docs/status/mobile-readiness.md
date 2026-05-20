# Mobile deployment readiness

Phase E: static deploy and phone browser play without DAT, pipeline, or dev middleware.

## Target

```bash
npm run ms:extract    # once, on your machine (CHIPS.EXE)
npm run build         # bundles tiles + optional SFX into dist/
npm run preview:lan   # test on phone over Wi‑Fi
```

Upload `apps/chips-challenge-web/dist/` to any static host (Netlify, S3, GitHub Pages, etc.).

## What ships in `dist/`

| Path | Source |
|------|--------|
| `/games/chips-challenge-1/**` | Committed game pack (levels, HUD sprites, window sheet) |
| `/ms-assets/tiles.png` | `npm run deploy:assets` ← `vendor/.../generated/` |
| `/ms-audio/*.WAV` | Same script from your MS install (optional; game works without) |
| `manifest.webmanifest` | Add-to-home-screen metadata |

Dev still serves `/ms-assets` from vendor via Vite middleware; production uses copied files under `public/` → `dist/`.

## Controls on phone

- **D-pad** — shown when `(pointer: coarse)` or viewport ≤ 720px; large touch targets
- **Swipe** on the playfield — one step per swipe (engine `DirectionInput.bindSwipe`)
- **Keyboard** — unchanged on desktop

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run deploy:assets` | Copy tiles (+ audio) into `public/ms-assets`, `public/ms-audio` |
| `npm run build` | Runs `deploy:assets`, then `tsc` + Vite |
| `npm run dev:lan` | Dev server on `0.0.0.0` for phone testing |
| `npm run preview:lan` | Preview build on LAN (`preview.host: true`) |

Set `CC1_DEPLOY_STRICT=1` before `deploy:assets` to fail if `tiles.png` is missing.

## Phone test checklist

1. `npm run build` && `npm run preview:lan`
2. On phone: `http://<PC-LAN-IP>:4173/`
3. Level 1: move (D-pad + swipe), pick up key, open door
4. Level 8: teeth / fire still behave
5. Optional: Add to Home Screen (manifest)

## Not in v1

- Service worker / offline cache (manifest only)
- Capacitor / native store build
- Committing `tiles.png` to git (optional for CI; see below)

## CI without vendor

Either run `ms:extract` in CI with a licensed install secret path, or commit `public/ms-assets/tiles.png` once (derived bitmap, not EXE) and drop `deploy:assets` from CI.
