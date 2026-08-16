import type { Direction, LevelData } from "../types.js";
import { cellTile, getCompositeTile, isBlockedCell, isDirtCell, isWetDirtCell } from "../levelRuntime.js";
import { brownButtonTileAt } from "./msCc1Traps.js";
import {
  CHIP_TILE_IDS,
  isBlockTile,
  isDoorTile,
  isMonsterTile,
  isSocketTile,
} from "../../tile-engine/tiles.js";

const EXIT_TILE_IDS = new Set(["exit", "chip_exit", "exit_3a", "exit_3b"]);

function isExitTile(tileId: string): boolean {
  return EXIT_TILE_IDS.has(tileId);
}
import type { MsCc1PlayerState } from "./types.js";

export const TELEPORT_TILE_ID = "teleport";

export function directionDelta(direction: Direction): { dx: number; dy: number } {
  switch (direction) {
    case "up":
      return { dx: 0, dy: -1 };
    case "down":
      return { dx: 0, dy: 1 };
    case "left":
      return { dx: -1, dy: 0 };
    case "right":
      return { dx: 1, dy: 0 };
  }
}

/** MS reverse wrappable reading order: next cell before (x, y). */
export function reverseWrappableNext(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (x > 0) {
    return { x: x - 1, y };
  }
  if (y > 0) {
    return { x: width - 1, y: y - 1 };
  }
  return { x: width - 1, y: height - 1 };
}

/** MS: only upper-layer `teleport` participates in the network. */
export function isFunctioningTeleportAt(
  level: LevelData,
  x: number,
  y: number,
): boolean {
  return cellTile(level, "upper", x, y) === TELEPORT_TILE_ID;
}

/** Composite shows teleport but pad does not work (lower-only or hidden). */
export function isNonFunctioningTeleportAt(
  level: LevelData,
  x: number,
  y: number,
): boolean {
  return (
    getCompositeTile(level, x, y) === TELEPORT_TILE_ID &&
    !isFunctioningTeleportAt(level, x, y)
  );
}

export function canChipStepOnto(
  level: LevelData,
  x: number,
  y: number,
  state: MsCc1PlayerState,
  openTraps?: Set<string>,
  stuckOnTraps?: Set<string>,
): boolean {
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
    return false;
  }
  const tile = getCompositeTile(level, x, y);
  if (isMonsterTile(tile) || isBlockTile(tile) || isDoorTile(tile)) {
    return false;
  }
  if (isSocketTile(tile) && state.chipsRemainingOnMap > 0) {
    return false;
  }
  if (isExitTile(tile) && state.chipsRemainingOnMap > 0) {
    return false;
  }
  if (CHIP_TILE_IDS.has(tile)) {
    return false;
  }
  if (
    isBlockedCell(level, x, y, {
      chipsRemainingOnMap: state.chipsRemainingOnMap,
      openTraps,
      stuckOnTraps,
      allowAppearingWall: true,
    })
  ) {
    return false;
  }
  return true;
}

/** Whether a movable block may occupy a cell (push / teleport exit). */
export function canBlockLandAt(
  level: LevelData,
  x: number,
  y: number,
  chipsRemainingOnMap: number,
  openTraps?: Set<string>,
  stuckOnTraps?: Set<string>,
): boolean {
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
    return false;
  }
  const tile = getCompositeTile(level, x, y);
  if (tile === "water") {
    return true;
  }
  if (isDirtCell(level, x, y) || isWetDirtCell(level, x, y)) {
    return false;
  }
  if (tile === "empty" || tile === "gravel") {
    return true;
  }
  if (brownButtonTileAt(level, x, y)) {
    return true;
  }
  if (isFunctioningTeleportAt(level, x, y)) {
    return true;
  }
  if (isBlockTile(tile) || isMonsterTile(tile) || isDoorTile(tile) || isExitTile(tile)) {
    return false;
  }
  if (isSocketTile(tile) && chipsRemainingOnMap > 0) {
    return false;
  }
  if (tile === "chip" || tile.startsWith("chip_") || tile.startsWith("key_")) {
    return false;
  }
  if (isBlockedCell(level, x, y, {
    chipsRemainingOnMap,
    openTraps,
    stuckOnTraps,
    allowAppearingWall: true,
  })) {
    return false;
  }
  return false;
}

export type BlueTeleportResolution =
  | { kind: "warp"; x: number; y: number }
  | { kind: "through"; x: number; y: number }
  | { kind: "bounce" };

function resolveBlueTeleportWith(
  level: LevelData,
  inX: number,
  inY: number,
  entryDir: Direction,
  canOccupy: (x: number, y: number) => boolean,
  options?: { entryIsFunctioningPad?: boolean },
): BlueTeleportResolution {
  const { dx, dy } = directionDelta(entryDir);
  const throughX = inX + dx;
  const throughY = inY + dy;

  const failAsIce = (): BlueTeleportResolution => {
    if (canOccupy(throughX, throughY)) {
      return { kind: "through", x: throughX, y: throughY };
    }
    return { kind: "bounce" };
  };

  const entryOk =
    options?.entryIsFunctioningPad === true ||
    isFunctioningTeleportAt(level, inX, inY);
  if (!entryOk) {
    return failAsIce();
  }

  const w = level.width;
  const h = level.height;
  let cx = inX;
  let cy = inY;

  for (let scanned = 0; scanned < w * h; scanned++) {
    const next = reverseWrappableNext(cx, cy, w, h);
    cx = next.x;
    cy = next.y;
    if (cx === inX && cy === inY) {
      break;
    }
    if (!isFunctioningTeleportAt(level, cx, cy)) {
      continue;
    }
    const exitX = cx + dx;
    const exitY = cy + dy;
    if (canOccupy(exitX, exitY)) {
      return { kind: "warp", x: exitX, y: exitY };
    }
  }

  return failAsIce();
}

/**
 * MS blue teleport at (inX, inY) with entry movement direction `entryDir`.
 * Exit is the cell on the exit face of the destination pad (same direction as travel).
 */
export function resolveBlueTeleport(
  level: LevelData,
  inX: number,
  inY: number,
  entryDir: Direction,
  state: MsCc1PlayerState,
  openTraps?: Set<string>,
  stuckOnTraps?: Set<string>,
): BlueTeleportResolution {
  const { dx, dy } = directionDelta(entryDir);
  return resolveBlueTeleportWith(level, inX, inY, entryDir, (x, y) => {
    if (canChipStepOnto(level, x, y, state, openTraps, stuckOnTraps)) {
      return true;
    }
    if (isBlockTile(getCompositeTile(level, x, y))) {
      return canBlockLandAt(
        level,
        x + dx,
        y + dy,
        state.chipsRemainingOnMap,
        openTraps,
        stuckOnTraps,
      );
    }
    return false;
  });
}

/** Same pad network as Chip, using block occupancy rules on the exit face. */
export function resolveBlueTeleportForBlock(
  level: LevelData,
  inX: number,
  inY: number,
  entryDir: Direction,
  chipsRemainingOnMap: number,
): BlueTeleportResolution {
  return resolveBlueTeleportWith(
    level,
    inX,
    inY,
    entryDir,
    (x, y) => canBlockLandAt(level, x, y, chipsRemainingOnMap),
    { entryIsFunctioningPad: true },
  );
}
