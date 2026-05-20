# chips-challenge-web

Browser client for MS Chip's Challenge: Phaser 3 play window, HUD, and level playback.

## Layout

| Path | Role |
|------|------|
| `apps/chips-challenge-web/` | Vite app (`src/`, `public/games/chips-challenge-100/`) |
| `docs/` | Architecture and HUD notes |

## Prerequisites

Clone sibling repos next to this one:

```text
DanM7/
  2d-tile-engine/
  chips-challenge-web/    ← this repo
  cc1-asset-extraction-pipeline/
```

## Setup

```bash
npm install
npm run dev
```

Uses the sibling **2d-tile-engine** repo via `file:../2d-tile-engine`. Level JSON and sprites ship under `public/`.

### Licensed MS game files (your install folder)

You do **not** need to copy `CHIPS.DAT` / `CHIPS.EXE` into the repo. Point the tooling at your existing install:

1. Copy `cc1-install.local.json.example` → **`cc1-install.local.json`** at the **repo root** (gitignored). Editing only the `.example` file has no effect.
2. Set `installPath` with **forward slashes** (e.g. `C:/games/Chips_Challenge_1`). Backslashes in JSON must be doubled (`\\`).
3. From the repo root, run `npm run ms:extract` once (or restart `npm run dev` — it runs extract when tiles are missing). After editing `spritesheet_window.png`, run `npm run ms:digits` to refresh HUD digit PNGs, then hard-refresh the browser.

Levels **1–10** are exported from your `CHIPS.DAT` via `npm run dat:levels` (also runs on `npm run dev` when DAT is configured). Stepping on the **exit** after collecting all chips advances to the next level. Use **Level Select** (gear menu) or `?password=XXXX` to jump to any exported level.

The app **defaults to the level named in** `public/games/chips-challenge-100/levels/index.json` (`defaultLevelId`, currently **level 8** / `NHAG`). Override with `?password=XXXX` (passwords in `public/games/chips-challenge-100/data/original-level-reference.json`), e.g. `?password=BDHP` for level 1.

Alternatively set env `CC1_MS_INSTALL=C:\games\Chips_Challenge_1`.

**Read** from your install: `CHIPS.EXE`, `CHIPS.DAT`, `*.WAV` / `*.MID`.  
**Write** into the app only: `apps/chips-challenge-web/vendor/chips-challenge-ms/generated/tiles.png` (derived, gitignored).

Without an install path, you can still use `chips_challenge.zip` at the repo root (`npm run vendor:ensure`) or copy files into `apps/chips-challenge-web/vendor/chips-challenge-ms/`.

## Related repos

- **[2d-tile-engine](https://github.com/danm7/2d-tile-engine)** — grid engine dependency
- **[cc1-asset-extraction-pipeline](https://github.com/danm7/cc1-asset-extraction-pipeline)** — DAT/EXE extraction

## Remote

```bash
git remote -v
# origin → https://github.com/danm7/chips-challenge-web
```
