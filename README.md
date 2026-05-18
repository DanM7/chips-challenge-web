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

Uses `@danmaguire/2d-tile-engine` via `file:../2d-tile-engine`. Level JSON and sprites ship under `public/`.

To refresh assets from DAT/EXE, run commands in **cc1-asset-extraction-pipeline** and copy outputs into `apps/chips-challenge-web/public/games/chips-challenge-100/`.

## Related repos

- **[2d-tile-engine](https://github.com/danmaguire/2d-tile-engine)** — grid engine dependency
- **[cc1-asset-extraction-pipeline](https://github.com/danmaguire/cc1-asset-extraction-pipeline)** — DAT/EXE extraction

## Remote

```bash
git remote -v
# origin → https://github.com/danmaguire/chips-challenge-web
```
