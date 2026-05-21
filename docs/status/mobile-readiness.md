# Mobile deployment readiness

Phase E: static deploy and phone browser play without DAT, pipeline, or dev middleware.

## Target

```bash
npm run ms:extract    # once, on your machine (CHIPS.EXE)
npm run sync:ms-pack  # copy tiles (+ optional SFX) into game pack; commit
npm run build         # tsc + Vite only
npm run preview:lan   # test on phone over Wi‑Fi
```

Upload `apps/chips-challenge-web/dist/` to any static host (Netlify, S3, GitHub Pages, etc.).

## What ships in `dist/`

| Path | Source |
|------|--------|
| `/games/chips-challenge-1/**` | Committed game pack (levels, HUD, window sheet, **ms-tiles.png**, optional `audio/`) |
| `manifest.webmanifest` | Add-to-home-screen metadata |

Dev falls back to `vendor/.../generated/tiles.png` when pack tiles are not committed; production uses only files under `public/` → `dist/`.

## Controls on phone

- **D-pad** — shown when `(pointer: coarse)` or viewport ≤ 720px; large touch targets
- **Swipe** on the playfield — one step per swipe (engine `DirectionInput.bindSwipe`)
- **Keyboard** — unchanged on desktop

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run sync:ms-pack` | Copy tiles (+ audio) into `public/games/chips-challenge-1/` |
| `npm run build` | `tsc` + Vite (no asset copy) |
| `npm run dev:lan` | Dev server on `0.0.0.0` for phone testing |
| `npm run preview:lan` | Preview build on LAN (`preview.host: true`) |

Set `CC1_SYNC_STRICT=1` before `sync:ms-pack` to fail if `tiles.png` is missing.

## Phone test checklist

1. `npm run build` && `npm run preview:lan`
2. On phone: `http://<PC-LAN-IP>:4173/`
3. Level 1: move (D-pad + swipe), pick up key, open door
4. Level 8: teeth / fire still behave
5. Optional: Add to Home Screen (manifest)

## Not in v1

- Service worker / offline cache (manifest only)
- Capacitor / native store build

## CI without vendor

Commit `public/games/chips-challenge-1/sprites/ms-tiles.png` (derived bitmap, not EXE) after one local `ms:extract` + `sync:ms-pack`.

Netlify and committed tiles — see [deployment.md](../deployment.md).
