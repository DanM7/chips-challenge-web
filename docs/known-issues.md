# Known issues

Active bugs and investigation notes for the chips-challenge-web prototype. Remove or update entries when fixed.

---

## Resolved

### Mobile landscape: input pane split / D-pad misaligned

**Status:** Resolved (May 2026)  
**Severity:** Touch UX — landscape controls column  
**Repos:** `chips-challenge-web` (`apps/chips-challenge-web`)

#### Symptom (was)

- Below the blue header, the black “input pane” looked **split down the middle** (black left, controls right).
- D-pad arrows had uneven spacing; left arrow often far from the play window, right arrow against the screen edge.
- Many CSS passes (flex centering, grid, `touch-input-area` `left:0; right:0` on `.touch-controls`) did not fix it.

#### Root cause

The header band and the input pane used **different positioning contexts**. The header is `position: absolute` on `#play-row` with `left` / `width` from `game-container` rects in `mobileHeaderBand.ts`. The input pane was anchored to `.touch-controls` (`position: relative`), so it did not share the same horizontal band as the header.

A separate contributor: `.play-stage` centered the game canvas, leaving black dead space between the canvas and the control column (`justify-content: flex-end` / `flex-start` when controls are on the left).

#### Fix

- `updateMobileHeaderBand()` sets `--control-band-left` and `--control-band-width` on `#play-row` (same values as the header).
- Landscape `.touch-input-area` uses those variables; landscape `.touch-controls` is **not** a positioning context.
- D-pad: `position: absolute; inset: 0` with 10px padding and explicit grid areas per direction.

#### Full write-up

See [mobile-landscape-touch-layout.md](./mobile-landscape-touch-layout.md) (postmortem, wrong hypotheses, debugging checklist).

| Area | Path |
|------|------|
| Band metrics (JS) | `apps/chips-challenge-web/src/ui/mobileHeaderBand.ts` |
| Touch layout / observer | `apps/chips-challenge-web/src/ui/touchControls.ts` |
| CSS | `apps/chips-challenge-web/src/style.css` |

---

### Layout bounds: use `#game-container`, not play-stage or control-rail

**Status:** Resolved (May 2026)  
**Severity:** Touch UX — settings panel width, header/input alignment (related)  
**Repos:** `chips-challenge-web` (`apps/chips-challenge-web`)

#### Symptom (was)

- VS-style settings panel ended ~**15px from the input pane’s midpoint**, not 15px from the edge of the play window / input boundary.
- Same class of mistake as the landscape “split pane” work: layout looked like it should use the black column or flex `play-stage`, but visually wrong by ~half a column.

#### Root cause

Three different horizontal boxes were treated as interchangeable:

| Element | What it is | Common mistake |
|---------|------------|----------------|
| `#game-container` | Phaser canvas — **actual play window** | Skipped; use this for edges |
| `.play-stage` | Flex area around the canvas | Used for “game view”; includes letterbox dead space |
| `.control-rail` | Full settings + input **column** | Used for “input pane”; wider than the touch band |

The touch input band and header band are sized from **`game-container` getBoundingClientRect()** in `mobileHeaderBand.ts`. The settings panel initially used `.play-stage` and `.control-rail.left`, which do not match that edge — so the panel stopped near the **middle** of the visible input region instead of at the canvas edge.

#### Fix

- `settingsPanelLayout.ts` positions the settings overlay from **`#game-container`** rects (15px inset), same horizontal line as the header band.
- Landscape (controls on right): `right = gameRect.right - 15px`. Portrait: `bottom` capped at `control-rail.top - 15px` (input strip below the canvas).

#### Rule for future work

When something must align with the **play window** or sit **15px from the input pane**, measure **`#game-container`**, not `.play-stage` or `.control-rail`. Only use the rail for vertical limits when the input strip is **below** the game (portrait).

#### Full write-up

See [mobile-landscape-touch-layout.md](./mobile-landscape-touch-layout.md) — sections *Root cause*, *Settings panel placement*, and *Debugging checklist*.

| Area | Path |
|------|------|
| Settings panel bounds | `apps/chips-challenge-web/src/ui/settingsPanelLayout.ts` |
| Header / input band metrics | `apps/chips-challenge-web/src/ui/mobileHeaderBand.ts` |
| Settings UI | `apps/chips-challenge-web/src/ui/AppHeaderMenu.ts`, `index.html` (`#settings-panel`) |

---

## Open

## MS force-floor override (blocks Trinity / level 11 bold)

**Status:** Open — **priority after levels 1–20 Auto Play wave**  
**Severity:** Engine parity — blocks bold Auto Play for Trinity and any level needing post-slide override  
**Repos:** `2d-tile-engine` (`msCc1Sliding` / `msCc1Movement`), consumed by `chips-challenge-web`

### Symptom

After an involuntary force-floor slide, Chip cannot override onto a new force direction the way MS allows. On Trinity, after the opening path Chip sticks around `(11,20)`: stepping north into `force_s` at `(11,19)` bounces back, so the west / red-key maze never opens (~55 reachable cells). TWS CNPE also fails to collect keys/tools under current simulation.

### Expected (MS)

Chip may override force floors (including after an involuntary slide / boost timing) so routes like StrategyWiki Trinity (bold **211**) are reachable.

### Notes

- Flagged while solving levels 1–20; level 11 status is `blocked` in `cc1-ms-solutions/status-1-20.json`.
- Related playtests: level 9 force-hold input tests already exist; override-after-slide is the gap for Trinity.

---

## Lesson 5 (TQKB): glider not visible on the board

**Status:** Open (paused March 2026)  
**Severity:** Blocks Lesson 5 trap puzzle  
**Repos:** `chips-challenge-web`, `2d-tile-engine`

### Expected behavior (MS Chip’s Challenge)

In the upper room of Lesson 5:

| Map marker | Tile / entity | Position (approx.) |
|------------|---------------|---------------------|
| Large brown dot | `button_brown` | (16, 7) and (16, 10) |
| Small brown dot | `trap` (linked via `trapLinks`) | (18, 7) and (18, 10) |
| Pointy shield enemy | MS **glider** (`ghost_*` in code/DAT) | Starts on first brown button; trap choreography moves it |

Intended flow: glider parked on first brown button → stepping first trap moves glider to second brown button → second trap releases glider north → wall turn (glider rule) → bomb clears exit.

### What the user sees

- **Pink ball** and **fireball** render and behave as monsters on the level.
- **Glider does not appear** at (16, 7) on the first brown button (or elsewhere), after dev server restart and hard refresh (Ctrl+Shift+R).
- Lesson 5 is launched via `/?password=TQKB` (see `apps/chips-challenge-web/src/main.ts` and `vite.config.ts` `server.open`).

### What we verified (engine / data)

These work in **Node/vitest** against the committed `level-005.json`:

| Check | Result |
|-------|--------|
| `trapLinks` present (2 links) | Yes |
| Map has `ghost_n` at (18, 11) before runtime | Yes |
| `createMsCc1Monsters` + `parkGliderOnFirstBrownButton` | Glider ends at **(16, 7)**, `button_brown` on lower, `ghost_n` on upper |
| Mask/overlay columns in `vendor/.../generated/tiles.png` for `ghost_n` (0x50) | Non-empty (see `2d-tile-engine/test/msGhostMask.test.ts`) |
| `compositeMsMaskedPixels` ghost over `button_brown` floor | Non-empty output (see `2d-tile-engine/test/msGhostComposite.test.ts`) |

Tests added in `2d-tile-engine`:

- `test/level005Glider.test.ts` — real level JSON parking
- `test/msCc1Traps.test.ts` — trap / parking behavior
- `test/msGhostMask.test.ts`, `test/msGhostComposite.test.ts` — asset/composite sanity

**Conclusion so far:** Logic and assets look correct offline; failure appears **browser / Phaser rendering or runtime wiring**, not trap rules in isolation.

### Level data notes

Exported `public/games/chips-challenge-1/levels/level-005.json` (as of investigation):

- `monsters`: pink ball (17, 15), fireball (18, 18), glider list entry (18, 11).
- **(16, 7)** in JSON: `button_brown` on **upper** layer (MS normally uses lower for buttons); runtime `syncMonsterTilesOnLevel` moves button to lower when a creature occupies the cell.
- Re-export via `npm run dat:levels` can overwrite manual JSON edits; runtime parking is meant to compensate.

### MS sprite layout (why rendering is hard)

Creatures in object-code **columns 4–6** use MS “masked” layout on `tiles.png` (13×16 grid, 32×32 cells):

- Column `floor(code/16)`: floor-background cell (often empty-looking for gliders).
- Column +3: overlay (creature on light background).
- Column +6: mask (white = creature pixels).

| Creature | Object code (e.g. facing north) | Column | User-visible in browser? |
|----------|----------------------------------|--------|---------------------------|
| Fireball | 0x44 | 4 | Yes |
| Pink ball | 0x48 | 4 | Yes |
| Glider | 0x50 | 5 | **No** |

Pink ball and fireball use the same masked/compositing code paths as the glider in most iterations; glider-specific failure suggests **position/parking**, **wrong frame/column**, or **browser-only composite/texture failure**, not “monsters disabled globally.”

### Engine work already merged (`2d-tile-engine`)

Trap / brown-button / glider parking:

- `engine/msCc1/msCc1Traps.ts` — `parkGliderOnFirstBrownButton`, `openTrapFromTrapStep`, `teleportMonster`, traps stay on map when opened (`openTraps` set).
- `engine/msCc1/msCc1Buttons.ts` — brown buttons no longer delete trap tiles.
- `engine/msCc1/msCc1Monsters.ts` — preserve buttons/toggles/traps under creatures; `appendMapMonstersMissingFromList` (map creatures if DAT list disagrees).
- `engine/levelRuntime.ts` — `openTraps` in blocking checks.
- `engine/msMaskedComposite.ts` — masked compositing helpers.

### Web / PlayScene attempts (`apps/chips-challenge-web/src/scenes/PlayScene.ts`)

Chronological summary of what was tried; **none produced a visible glider for the user**:

1. **Cell grid only** — `refreshCellAt` / `placeBoardSprite`; raw `ghost_n` frame index points at column-5 floor cell → effectively blank.
2. **`monsterOverlaySprites` + masked figure-only texture** — `ensureCreatureMaskedPreviewTexture` (same idea as clone-machine preview); floor drawn separately.
3. **Dedicated `monsterLayer` + `syncMonsterSprites`** — creatures as Phaser sprites; `cameras.main.ignore` for board camera (same pattern as Chip). Still invisible.
4. **Masked figure on `monsterLayer`** — `ensureCreatureMaskedPreviewTexture` in `syncMonsterSprites`; still invisible.
5. **Occupant branch fix** — `refreshCellAt` previously drew **floor only** for runtime monsters (no overlay); added overlay drawing. Still invisible.
6. **Removed `monsterLayer`** — `syncMonsterOverlays()` refreshes cells; masked creatures on `tileLayer` with clone-machine-style overlays.
7. **Baked floor composite** — `ensureCreatureMaskedFloorTexture` + `compositeMsMaskedFromSheet` (button + ghost in one canvas texture); `placeCreatureCompositeOverlay`. Still invisible.
8. **Glider-specific overlay column** — `placeGhostFigureOnFloor`: floor `placeBoardSprite` + spritesheet **overlay frame** (`msMaskedChipFrameTriple(code).overlay`) via `placeCreatureSheetFrameOverlay`. Still invisible.
9. **Tiles cache bust** — `tiles.png` load query `?v=6` (was `?v=5`) to drop stale canvas textures.

Related wiring (kept): `buttonPressCtx.openTraps`, `createMsCc1Monsters` before board build, `syncMonsterOverlays` after moves/ticks.

### Other hypotheses not fully ruled out

- **Camera viewport** — Board camera follows Chip (~20, 19); glider at (16, 7) is off-screen until the upper room is entered. User reported checking the puzzle area; still worth confirming they were at (16, 7) and not only (18, 7).
- **Parking not applied in browser** — e.g. stale bundle, wrong level file from `dist/` vs `public/`, or level load without `trapLinks`. Engine tests use `public/.../level-005.json` and pass.
- **Phaser canvas texture upload** — `uploadChipCanvasTexture` falls back to `MS_TILES_KEY` if canvas creation fails; could mis-bind textures (would likely affect other composites too).
- **Wrong tile sheet at runtime** — `assets.json` loads `/games/chips-challenge-1/sprites/ms-tiles.png` (committed via `npm run sync:ms-pack` after `ms:extract`). Dev falls back to vendor; production needs committed pack tiles.
- **Z-order / `cellSprites` hidden** — composite path hides floor cell sprite; if overlay missing, cell looks like empty floor or button only.
- **Level export** — `button_brown` on upper at (16, 7) in JSON; if parking failed, cell might show only a brown dot with no creature.

### Key files

| Area | Path |
|------|------|
| Play scene / rendering | `apps/chips-challenge-web/src/scenes/PlayScene.ts` |
| Level 5 data | `apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json` |
| Tile sheet (generated) | `apps/chips-challenge-web/vendor/chips-challenge-ms/generated/tiles.png` |
| Asset manifest | `apps/chips-challenge-web/public/games/chips-challenge-1/assets.json` |
| Traps / parking | `2d-tile-engine/engine/msCc1/msCc1Traps.ts` |
| Monsters | `2d-tile-engine/engine/msCc1/msCc1Monsters.ts` |
| Masked compositing | `2d-tile-engine/engine/msMaskedComposite.ts` |
| Architecture context | `docs/architecture.md` |

### Suggested next steps (when resuming)

1. **Runtime debug in browser** — After `createMsCc1Monsters`, log `monsters` and `cellTile(level, 'upper', 16, 7)` / lower; confirm parking in DevTools, not only vitest.
2. **Phaser debug gfx** — Temporary bright rectangle or text at (16, 7) to confirm board coordinates and camera visibility.
3. **Inspect live sprites** — Phaser Scene Inspector or log `monsterOverlaySprites.get('16,7')` visibility, texture key, frame, alpha.
4. **Compare (18, 11) vs (16, 7)** — If parking fails in browser, ghost might only exist on map at (18, 11); check that cell visually.
5. **Single-sprite fallback** — Force `placeBoardSprite(x, y, 'ghost_n')` with overlay frame index only (no floor split) as a one-line experiment.
6. **Export fix** — Pipeline: park glider in `chipToGameLevel` / DAT export so JSON has glider at (16, 7) on load (reduces dependence on runtime parking).
7. **End-to-end trap test** — Once visible, verify `openTrapFromTrapStep` choreography and glider movement toward bomb.

### Typecheck note (unrelated)

`npx tsc --noEmit` in the web app reported pre-existing errors in `msCc1Buttons.ts`, `msCc1Monsters.ts`, and `MsOopsDialog.ts`; not tracked as part of this glider issue.
