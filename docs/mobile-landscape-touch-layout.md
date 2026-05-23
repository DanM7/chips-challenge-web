# Mobile landscape touch layout — postmortem

This document records a long-running layout bug: the D-pad looked right-aligned or “split” in landscape touch mode, and the black input pane appeared cut in half. It explains what we tried, what was actually wrong, and how the fix works.

## Symptom

On phone landscape (controls on the right):

- The blue header band looked correct: from the game window’s edge to the screen edge.
- Below the header, the “input pane” looked **split vertically down the middle**: black on the left, D-pad / controls on the right.
- D-pad buttons had inconsistent spacing; the left arrow often sat far from the play window while the right arrow hugged the screen edge.
- Debug backgrounds (magenta, cyan, purple, orange) on `control-rail`, `touch-controls`, and `touch-input-area` were misleading: cyan often filled only the **right half** of the column; orange/purple sometimes never appeared at all.

## What we wanted

In the control column below the header:

- **Left / right** arrows ~10px from the column edges (left ≈ game edge, right ≈ screen edge).
- **Up / down** arrows centered on the column, ~10px from top/bottom.
- One continuous black input region matching the header’s horizontal span.

## DOM structure (relevant)

```
#play-row.play-row--touch-active.play-row--landscape   ← position: relative
├── .play-stage                                        ← flex: 1; game canvas inside
└── aside.control-rail                                 ← fixed width column
    ├── header.app-header                              ← position: absolute (band via JS)
    └── .touch-controls                                ← black background, flex child
        └── .touch-input-area
            └── nav.dpad                               ← position: absolute; inset + grid
```

The header lives **inside** `control-rail` but is positioned against **`#play-row`** because that is the nearest positioned ancestor.

## Wrong hypotheses (why iteration took so long)

### 1. “Center the D-pad cluster with flex/grid”

We treated the problem as **D-pad alignment inside a correctly sized box**. Many passes changed:

- `width: fit-content` vs `100%` on `.dpad`
- `margin: auto`, `place-items: center`, `1fr` grid columns
- `position: absolute; inset: 0` on `.dpad` with edge-aligned `grid-area`s

Those approaches can work **only if the input pane’s box is correct**. Ours was not.

### 2. “`touch-input-area` only fills half the column”

Debug colors showed cyan on the **right half** and black on the **left**. We assumed `touch-input-area` had the wrong width and tried:

- `position: absolute; left: 0; right: 0` on `.touch-input-area` relative to `.touch-controls`
- `position: relative` on `.control-rail` vs `.touch-controls`
- Removing landscape padding, etc.

The cyan box **was** filling its containing block correctly. The containing block was the wrong coordinate system (see root cause).

### 3. “Orange/purple debug never shows — CSS not loading”

When `background: red !important` on `.touch-controls` did not appear, we suspected cache or specificity. Often the real issue was **stacking and geometry**: parent backgrounds were covered, or the element we colored was not the visible region (e.g. only a sliver behind the absolutely positioned child).

### 4. “Dead zone in `play-stage`” (partially true, not the half-split)

The game canvas uses aspect ratio `511 / 351` with `height: 100%` and `width: auto`. With `justify-content: center` on `.play-stage`, the canvas sat in the **middle** of the wide play area, leaving black **play-stage** to the right of the canvas but **left of** `control-rail`.

That gap made the **left arrow** feel far from the game. Fixing it required:

```css
.play-row--touch-active.play-row--landscape .play-stage {
  justify-content: flex-end; /* controls on right */
}
.play-row--touch-active.play-row--landscape .play-stage {
  justify-content: flex-start; /* controls on right → game left-aligned */
}
.play-row--touch-active.play-row--landscape.play-row--controls-left .play-stage {
  justify-content: flex-end; /* controls on left → game right-aligned */
}
```

That aligns the canvas to the control column but **does not** fix the input pane “50/50” split below the header if the input band still uses the wrong containing block.

### 5. “Make `control-rail` the positioning context”

Setting `position: relative` on `.control-rail` and `header.style.left = "0"` broke the header: it started at the **center** of the screen because the header band is computed from **`game-container` getBoundingClientRect()** relative to **`#play-row`**, not relative to the rail’s left edge.

**Lesson:** header and input pane must share the **same** positioning root and the **same** horizontal metrics.

## Root cause

**The header and the input pane used different positioning contexts and horizontal math.**

| Piece | Containing block | Horizontal placement |
|--------|------------------|----------------------|
| `.app-header` (landscape) | `#play-row` (`position: relative`) | JS: `left` = `gameRect.right - rowRect.left`, `width` = `rowRect.right - gameRect.right` |
| `.touch-input-area` (before fix) | `.touch-controls` (`position: relative`) | CSS: `left: 0; right: 0` within the rail column only |

The header span is measured from the **game canvas edge** to the **screen edge** (the control band). The input area was anchored to **the full width of `touch-controls` inside `control-rail`**, but visually users compare it to the **header band**. With nested absolute layers and black `touch-controls` background, the left half of the band looked “empty” (parent background) and the right half looked like the real input pane (cyan debug) — a **vertical 50/50 split in the band below the header**.

So it was not “CSS can’t center a D-pad”; it was **two different horizontal coordinate systems** for two UI layers that should have been one band.

## Solution

### 1. One band metric in JavaScript

`updateMobileHeaderBand()` in `apps/chips-challenge-web/src/ui/mobileHeaderBand.ts` sets on `#play-row`:

| CSS variable | Purpose |
|--------------|---------|
| `--header-band-height` | Header height → input `top` |
| `--control-band-left` | Same `left` as header (px from play-row left) |
| `--control-band-width` | Same `width` as header |

Controls on the right:

- `bandLeft = gameRect.right - rowRect.left`
- `bandWidth = rowRect.right - gameRect.right`

Controls on the left:

- `bandLeft = 0`
- `bandWidth = gameRect.left - rowRect.left`

### 2. Input pane uses play-row band (not touch-controls box)

In `style.css`, landscape `.touch-input-area`:

- `position: absolute`
- **No** `position: relative` on landscape `.touch-controls` (so the positioned ancestor is `#play-row`)
- `top: var(--header-band-height)`
- `left: var(--control-band-left)`
- `width: var(--control-band-width)`
- `bottom: 0`

### 3. D-pad fills the input pane

`.dpad` uses `position: absolute; inset: 0; padding: var(--dpad-pad)` (10px) and a 3×3 grid with explicit `grid-area` per direction so edges and center alignment are predictable.

### 4. Game flush to controls (separate UX fix)

Landscape `.play-stage` uses `justify-content: flex-start` by default (controls on the right → game left-aligned) and `flex-end` when `play-row--controls-left` (game right-aligned, widening the header/input band on the left).

## Files to read when touching this again

| File | Role |
|------|------|
| `apps/chips-challenge-web/src/ui/mobileHeaderBand.ts` | Band `left` / `width` / `height` from game + row rects |
| `apps/chips-challenge-web/src/ui/touchControls.ts` | Touch classes, `ResizeObserver`, calls `updateMobileHeaderBand` |
| `apps/chips-challenge-web/src/style.css` | Landscape play-row, play-stage, touch-input-area, dpad grid |
| `apps/chips-challenge-web/index.html` | `play-row` → `play-stage` + `control-rail` → header + touch-controls |

## Settings panel placement

The settings overlay must use **`#game-container` getBoundingClientRect()** for its edges (see `settingsPanelLayout.ts`), not `.play-stage` or `.control-rail`. The play-stage flex area is wider than the canvas when the game is letterboxed; the control-rail column is wider than the touch input band. Using the rail’s left edge placed the panel ~15px from the **middle** of the visible input pane instead of 15px from the canvas / input boundary (same line as `gameRect.right` in `mobileHeaderBand.ts`).

## Debugging checklist (next time)

1. **Identify the containing block** for each `position: absolute` element (`offsetParent` / computed `position` on ancestors).
2. **Compare `getBoundingClientRect()`** for `#game-container`, `.touch-input-area`, and `.app-header` — they should share the same horizontal span below the header.
3. **Do not trust debug color on a parent** until you know which child paints on top; color the band element that JS sizes.
4. If the split is at **screen center**, suspect header `left`/`width` vs game rect mismatch, not D-pad grid.
5. If the left arrow is far from the game but the column looks one piece, suspect **play-stage** centering, not the rail.

## Why it took so long

1. **Wrong problem framing** — “center the four buttons” instead of “define one rectangle for the control band.”
2. **Misleading visuals** — black `touch-controls` + half-width cyan `touch-input-area` looked like a width bug on one element, not a coordinate mismatch between header and input.
3. **Header lived in rail, positioned on row** — easy to forget that `left` on the header is relative to `play-row`, while children defaulted to `touch-controls`.
4. **Many valid CSS techniques** — flex, grid, and absolute all “work” in isolation; none fix wrong containing blocks.
5. **Partial fixes** — play-stage `flex-end` helped arrow distance but not the band split; rail `position: relative` regressed the header.

## Related docs

- [known-issues.md](./known-issues.md) — resolved entries (input pane split + **game-container vs play-stage/rail**)
- [ui-and-hud.md](./ui-and-hud.md) — in-canvas MS window HUD (separate from HTML touch chrome)
- [status/mobile-readiness.md](./status/mobile-readiness.md) — broader mobile deploy checklist
