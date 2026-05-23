# Documentation

Chip's Challenge web port — architecture and cleanup for portfolio readers and contributors.

## Core docs

| Document | Contents |
|----------|----------|
| [architecture.md](./architecture.md) | Three-repo layout, data flows, build vs runtime |
| [game-data-model.md](./game-data-model.md) | Ruleset, content pack, level JSON (target architecture) |
| [ms-cc1-rules.md](./ms-cc1-rules.md) | MS CC1 behavior checklist, smoke tests, gap detection |
| [ui-and-hud.md](./ui-and-hud.md) | MS window HUD layout and run state binding |
| [mobile-landscape-touch-layout.md](./mobile-landscape-touch-layout.md) | Landscape D-pad / input pane layout postmortem (positioning bug) |
| [known-issues.md](./known-issues.md) | Open gameplay and UX gaps |

## Status and roadmap

| Document | Contents |
|----------|----------|
| [status/cleanup.md](./status/cleanup.md) | Phased cleanup plan (A–D) and verification checklist |
| [status/mobile-readiness.md](./status/mobile-readiness.md) | Deploy-on-phone gaps (after Phase A manual test) |
| [deployment.md](./deployment.md) | Netlify, GitHub engine dep, `sync:ms-pack`, committed tiles |

## Repo root

- [README.md](../README.md) — quick start and npm scripts
- [VENDOR_SETUP.md](../VENDOR_SETUP.md) — licensed `CHIPS.DAT` / `CHIPS.EXE` setup

## Related repositories

- [2d-tile-engine](https://github.com/danm7/2d-tile-engine) — simulation and `LevelData` schema
- [cc1-asset-extraction-pipeline](https://github.com/danm7/cc1-asset-extraction-pipeline) — offline DAT/EXE export (no committed levels)
