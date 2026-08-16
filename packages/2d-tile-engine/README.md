# 2d-tile-engine

Grid arcade engine for MS-style tile games: level runtime, run state, input, and tile-id utilities.

This package lives in **chips-challenge-web** (`packages/2d-tile-engine`) so CC1/CC2 work can share one repo. Extract it again once a second game is a real consumer.

## Layout

| Path | Role |
|------|------|
| `engine/` | Core types, `levelRuntime`, `RunSession`, loaders, Phaser `GameEngine` |
| `tile-engine/` | MS object codes → spritesheet frame mapping |
| `engine/levelLayers.ts` | Compact layer JSON (`emptyPrefix` + `tiles`); expanded in `loadLevel()` |
| `test/` | Movement, monsters, keys, compact layers |
| `scripts/` | Solution solvers / probes (CC1-specific; not runtime) |

**Schema owner:** `LevelData`, tile ids, and collectible helpers are defined here. Phaser scenes and the DOM shell live in `apps/chips-challenge-web`. **cc1-asset-extraction-pipeline** can depend on this folder for `LevelData` and tile ids.

The web app imports via Vite/TS aliases `@engine` and `@tile-engine` (see `apps/chips-challenge-web/scripts/engineRoot.mjs`).

## Setup

From the **chips-challenge-web** repo root:

```bash
npm install
npm test
```

Engine-only:

```bash
npm run test:engine
```

## Extracting later

Keep `engine/` and `tile-engine/` game-agnostic. CC1 Auto Play JSON stays under `apps/chips-challenge-web/public/games/chips-challenge-1/`. When a second title needs the engine as its own package, copy this folder out and pin it from the game repos.
