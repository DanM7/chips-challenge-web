# Deployment (static web / Netlify / mobile browser)

Players only open a URL in the browser. **No npm, DAT, or pipeline on the phone.** All build steps run on your machine or on the host (e.g. Netlify) when you deploy.

## What gets published

After `npm run build`, upload **`apps/chips-challenge-web/dist/`** (or let Netlify publish it).

| URL path | Source | In git? |
|----------|--------|---------|
| `/` | Vite bundle (`index.html`, JS, CSS) | Built |
| `/games/chips-challenge-1/**` | Game pack: levels, HUD sprites, window sheet, **MS tile sheet**, optional SFX | Yes (tiles after `sync:ms-pack`) |
| `/manifest.webmanifest` | PWA metadata | Yes |

MS tiles and audio live under the game pack:

- `/games/chips-challenge-1/sprites/ms-tiles.png` (+ `ms-tiles.json`)
- `/games/chips-challenge-1/audio/*.WAV` (optional)

`npm run build` is only TypeScript check + Vite — **no** asset copy step. Netlify needs the tile sheet **committed** in `public/games/chips-challenge-1/sprites/`.

Dev (`npm run dev`) falls back to gitignored `vendor/.../generated/tiles.png` when committed tiles are missing (Vite middleware in `vite.config.ts`). **Production has no middleware** — commit tiles or the game shows “tile sheet missing”.

## Netlify

Repo root includes [`netlify.toml`](../netlify.toml):

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Publish directory | `apps/chips-challenge-web/dist` |
| Node version | 20 |

You do **not** add separate Netlify steps for mobile (D-pad, swipe, manifest are already in the build).

### Private `2d-tile-engine` repo

If the engine repo is private, configure Netlify so `npm install` can read GitHub (build token / Netlify–GitHub integration). See [Netlify env docs](https://docs.netlify.com/environment-variables/get-started/).

## Engine dependency (GitHub, not sibling folder)

Web `package.json` pins the engine from GitHub:

```json
"@danm7/2d-tile-engine": "github:danm7/2d-tile-engine#d59a26a"
```

Netlify runs `npm install` and clones that commit. **Push engine changes to GitHub**, then bump the hash, run `npm install`, commit `package-lock.json`.

**Local engine work (optional):** clone `2d-tile-engine` beside this repo. `apps/chips-challenge-web/scripts/engineRoot.mjs` falls back to the sibling if needed for Vite; TypeScript paths use `node_modules` from the GitHub install.

## `npm run sync:ms-pack`

**When:** after `npm run ms:extract` when the EXE-derived tile sheet or install WAVs change (infrequent).

**What it does:** copies into the committed game pack:

- `public/games/chips-challenge-1/sprites/ms-tiles.png` (+ `ms-tiles.json`)
- `public/games/chips-challenge-1/audio/` — seven WAVs referenced by `assets.json`

Sources: `vendor/chips-challenge-ms/generated/` (from extract), legacy `public/ms-assets/` / `public/ms-audio/` if present, or your MS install folder for audio.

**What it does *not* do:** run `ms:extract`. Run extract first, then sync, then commit.

Set `CC1_SYNC_STRICT=1` to fail if `tiles.png` is missing.

### Why tiles are in the game pack

| Concern | Reason |
|---------|--------|
| **Legal** | `CHIPS.EXE` / install folder stay local and gitignored |
| **Netlify** | Build servers have no game install; cannot extract on deploy |
| **Simplicity** | One folder for all shipped content; `build` does not copy assets |

### When you must run sync + commit

| Situation | Action |
|-----------|--------|
| First Netlify deploy | `ms:extract` → `sync:ms-pack` → **commit** `sprites/ms-tiles.*` |
| Re-extracted tiles (palette fix) | `sync:ms-pack` and commit updated files |
| Only changed TS/levels (tiles unchanged) | No — committed tiles are enough |
| Fresh clone for local `npm run build` | Committed tiles **or** local vendor + dev middleware |

### One-time publish checklist

```bash
# 1. Licensed files configured (cc1-install.local.json or CC1_MS_INSTALL)
npm run ms:extract

# 2. Copy into game pack and commit
npm run sync:ms-pack
git add apps/chips-challenge-web/public/games/chips-challenge-1/sprites/ms-tiles.*
# optional: git add apps/chips-challenge-web/public/games/chips-challenge-1/audio/

# 3. Commit web + lockfile + netlify.toml as usual
git add package.json package-lock.json
git commit -m "Add MS tiles to game pack and Netlify config"
git push
```

Netlify: connect repo → deploy. Test on phone over HTTPS.

### Local preview (same artifact as production)

```bash
npm run build
npm run preview:lan
# Phone: http://<your-pc-lan-ip>:4173
```

## Related scripts (not required on Netlify)

| Script | Purpose |
|--------|---------|
| `npm run dev` / `dev:lan` | Local play; dev fallback serves vendor tiles if pack tiles missing |
| `npm run ms:extract` | Regenerate `vendor/.../generated/tiles.png` from CHIPS.EXE |
| `npm run dat:levels` | Re-export level JSON from CHIPS.DAT (dev machine only) |
| `npm run preview` | Serve `dist/` locally |

## See also

- [status/mobile-readiness.md](./status/mobile-readiness.md) — touch UX and scope
- [architecture.md](./architecture.md) — build vs runtime data flow
- [VENDOR_SETUP.md](../VENDOR_SETUP.md) — licensed file layout
