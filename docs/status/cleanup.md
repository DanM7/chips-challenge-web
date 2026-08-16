# Cleanup and reorganization plan

Portfolio-quality structure for the three-repo Chip's Challenge stack. This file is the single checklist; update status as phases complete.

## End goal

| Phase | Who | What |
|-------|-----|------|
| **Extract (local)** | You + **cc1-asset-extraction-pipeline** | Read licensed `CHIPS.DAT` / `CHIPS.EXE`; write into the web game pack |
| **Play (deployed)** | **chips-challenge-web** only | Static build + Phaser; works on phone browser without DAT or pipeline |
| **Simulate** | **packages/2d-tile-engine** | Owns `LevelData`, tile ids, MS rules; consumed by the web app (and pipeline for export) |

See [architecture.md](../architecture.md) for data flow. Mobile deployment gaps are tracked in [mobile-readiness.md](./mobile-readiness.md) (Phase A follow-up doc after cleanup).

---

## Phase A — Low risk, high clarity

**Goal:** Repo hygiene and dev ergonomics without changing gameplay logic.

| Task | Status | Notes |
|------|--------|-------|
| Delete / gitignore debug sprites (`_debug_*`, `_font*.png`) in game pack | **done** | 18 files removed; patterns in `.gitignore` |
| Remove stale `public/games/chips-challenge-100/` if present | **done** | Deleted manually |
| Fix stale paths in `architecture.md` | **done** | Three-repo layering; predev behavior |
| Expand `docs/README.md` + link this plan | **done** | Hub + `status/mobile-readiness.md` |
| `GAME_PACK_ID` in `cc1Paths.mjs`; scripts use helpers | **done** | `getGamePackDir`, `getGamePackUrl` |
| Smarter `predev.mjs` (no full DAT re-export every dev boot) | **done** | `CC1_FORCE_DAT_EXPORT=1` to force |
| Remove empty `2d-tile-engine/runtime/` placeholder | **done** | README table updated |

**Verification (manual):** Play levels 1–8 after Phase A; confirm intro, monsters, teeth, fire clocks unchanged.

---

## Phase B — Dedup (engine as owner)

**Goal:** One schema and one tile table; pipeline is a thin exporter.

| Task | Status | Notes |
|------|--------|-------|
| Pipeline depends on `@danm7/2d-tile-engine` | **done** | Point at `chips-challenge-web/packages/2d-tile-engine` |
| Remove `gameLevelTypes`, `layerCompact`, `countCollectibles` duplicates | **done** | Use `@engine/*` |
| `pipeline/tiles.ts` re-exports `@tile-engine/tiles` | **done** | |
| `tools/gamePackOut.mjs` — output only to web game pack | **done** | `CC1_GAME_PACK_OUT` override |
| `docs/EXPORT.md` in pipeline | **done** | |
| Web `compactLevelJson.ts` uses engine `compactLayer` | **done** | `npx tsx` script |
| Engine barrel `engine/index.ts` exports | **done** | `ruleset/` + public API |
| Pipeline `package.json` `exports` map | **done** | `./pipeline/*` |

**Verification:** `npm test` in pipeline and engine; re-export one level and diff JSON.

---

## Phase C — Structure (ongoing)

**Goal:** Maintainable web client and incremental ruleset migration.

| Task | Status | Notes |
|------|--------|-------|
| Split `PlayScene.ts` (~1.7k lines) into focused modules | **done** | `play/PlayBoardPresenter.ts`, `constants`, `boardState` |
| Implement `game-data-model.md` ruleset path incrementally | **done** | `resolveRulesetContext` on level load; MS sim unchanged |
| Web smoke tests OR remove empty `vitest` config | **done** | `apps/.../test/gamePack.test.ts` |
| Keep `ms-cc1-rules.md` in sync with engine tests | | Portfolio: shows intentional coverage |

---

## Phase D — Monorepo (optional)

**Goal:** One clone for contributors; only if three remotes become painful.

| Task | Status | Notes |
|------|--------|-------|
| pnpm workspace: `packages/{engine,pipeline,web}` | | |
| Shared `cc1-install.local.json` at root | | |
| Drop repeated `file:../2d-tile-engine` paths | **done** | Engine vendored in `packages/2d-tile-engine` |

**Not required** for solo deploy or portfolio if sibling repos stay documented.

---

## Phase E — Mobile-ready deploy

**Goal:** `npm run build` artifact is self-contained; playable on phone browser.

| Task | Status | Notes |
|------|--------|-------|
| MS tiles in game pack + `sync:ms-pack` | **done** | `syncMsPackAssets.mjs`; no build-time copy |
| Preview/dev LAN (`preview:lan`, `dev:lan`) | **done** | `preview.host: true` |
| Touch D-pad + swipe | **done** | CSS + `DirectionInput.bindSwipe` |
| `manifest.webmanifest` | **done** | Add to home screen |
| Service worker / offline | | Deferred |

See [mobile-readiness.md](./mobile-readiness.md).

---

## Related repos

| Repo | Role in cleanup |
|------|-----------------|
| [packages/2d-tile-engine](../../packages/2d-tile-engine) | Schema + simulation (in this repo) |
| [cc1-asset-extraction-pipeline](https://github.com/danm7/cc1-asset-extraction-pipeline) | Standalone extractor; no committed game levels |
| **chips-challenge-web** (this repo) | Committed game pack + Phaser client |
