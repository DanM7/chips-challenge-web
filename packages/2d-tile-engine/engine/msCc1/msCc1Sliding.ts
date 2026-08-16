import type { Direction } from "../types.js";
import { CHIP_TILE_IDS } from "../../tile-engine/tiles.js";
import { cellTile, getCompositeTile, getFloorTileId } from "../levelRuntime.js";
import {
  combineMoveIntents,
  isZeroMoveIntent,
  moveIntentFromDirection,
  type MoveIntent,
} from "../moveIntent.js";
import type { LevelData } from "../types.js";
import type { MsCc1PlayerState } from "./types.js";

export const ICE_STRAIGHT_TILE_ID = "ice";

export const ICE_CORNER_TILE_IDS = new Set([
  "ice_se",
  "ice_sw",
  "ice_nw",
  "ice_ne",
]);

export const FORCE_FLOOR_TILE_IDS = new Set([
  "force_n",
  "force_s",
  "force_e",
  "force_w",
  "force_any",
]);

/** Floor tiles that end an involuntary ice / force slide (MS gray floor). */
export const SLIDE_STOP_FLOOR_TILE_IDS = new Set(["empty", "gravel"]);

export function isIceStraightTile(tileId: string): boolean {
  return tileId === ICE_STRAIGHT_TILE_ID;
}

export function isIceCornerTile(tileId: string): boolean {
  return ICE_CORNER_TILE_IDS.has(tileId);
}

export function isForceFloorTile(tileId: string): boolean {
  return FORCE_FLOOR_TILE_IDS.has(tileId);
}

/**
 * MS ice-corner deflection while sliding (entry = direction Chip moved onto the tile).
 * @see https://wiki.bitbusters.club/Ice
 */
const ICE_CORNER_EXIT: Record<string, Partial<Record<Direction, Direction>>> = {
  ice_nw: { right: "up", down: "left" },
  ice_ne: { left: "up", down: "right" },
  ice_sw: { right: "down", up: "left" },
  ice_se: { left: "down", up: "right" },
};

export function iceCornerExitDirection(
  tileId: string,
  entryDirection: Direction,
): Direction | null {
  return ICE_CORNER_EXIT[tileId]?.[entryDirection] ?? null;
}

/** Terrain drawn under Chip and composited with masked walk sprites (MS columns 7–12). */
export function isTerrainVisibleUnderChip(tileId: string): boolean {
  return (
    tileId === "water" ||
    tileId === "fire" ||
    isIceStraightTile(tileId) ||
    isIceCornerTile(tileId) ||
    isForceFloorTile(tileId)
  );
}

/** Tile to draw under Chip at a cell (ice under a chip marker, water, force floors). */
export function getTerrainTileUnderChip(
  level: LevelData,
  x: number,
  y: number,
): string | null {
  const composite = getCompositeTile(level, x, y);
  if (CHIP_TILE_IDS.has(composite)) {
    const floor = getFloorTileId(level, x, y);
    return isTerrainVisibleUnderChip(floor) ? floor : null;
  }
  if (isTerrainVisibleUnderChip(composite)) {
    return composite;
  }
  return null;
}

/**
 * Force-floor tile at a cell (MS often stores these on upper or lower layer).
 * `getFloorTileId` alone misses force on upper when that layer is non-empty.
 */
export function getForceFloorTileAt(
  level: LevelData,
  x: number,
  y: number,
): string | null {
  const upper = cellTile(level, "upper", x, y);
  if (isForceFloorTile(upper)) {
    return upper;
  }
  const lower = cellTile(level, "lower", x, y);
  if (isForceFloorTile(lower)) {
    return lower;
  }
  return null;
}

/**
 * Force on an orthogonally adjacent cell that pushes Chip at (x, y) onto that tile.
 * E.g. force_s at (x, y+1) pushes Chip at (x, y) south.
 */
export function getAdjacentForcePushOntoChip(
  level: LevelData,
  x: number,
  y: number,
  state: MsCc1PlayerState,
): MoveIntent | null {
  if (hasSuctionBoots(state)) {
    return null;
  }
  const checks: Array<{ nx: number; ny: number; push: MoveIntent }> = [
    { nx: x, ny: y + 1, push: { dx: 0, dy: 1 } },
    { nx: x, ny: y - 1, push: { dx: 0, dy: -1 } },
    { nx: x + 1, ny: y, push: { dx: 1, dy: 0 } },
    { nx: x - 1, ny: y, push: { dx: -1, dy: 0 } },
  ];
  for (const { nx, ny, push } of checks) {
    const tile = getForceFloorTileAt(level, nx, ny);
    if (!tile) {
      continue;
    }
    const dir = forceFloorDirection(tile);
    if (!dir) {
      continue;
    }
    const forcePush = moveIntentFromDirection(dir);
    if (forcePush.dx === push.dx && forcePush.dy === push.dy) {
      return forcePush;
    }
  }
  return null;
}

/** Active force-floor push at a cell (null with suction boots or no force tile). */
export function getForceFloorIntentAt(
  level: LevelData,
  x: number,
  y: number,
  state: MsCc1PlayerState,
): MoveIntent | null {
  if (hasSuctionBoots(state)) {
    return null;
  }
  const tile = getForceFloorTileAt(level, x, y);
  const direction = tile ? forceFloorDirection(tile) : null;
  return direction ? moveIntentFromDirection(direction) : null;
}

/** Involuntary force slide uses force axis; held input only when it combines non-zero. */
export function resolveForceSlideIntent(
  forceIntent: MoveIntent,
  heldDirection: Direction | null,
): MoveIntent {
  if (!heldDirection) {
    return forceIntent;
  }
  const combined = combineMoveIntents(forceIntent, moveIntentFromDirection(heldDirection));
  // MS: opposing hold overrides the pad (Lynx cannot).
  return isZeroMoveIntent(combined) ? moveIntentFromDirection(heldDirection) : combined;
}

export function forceFloorDirection(tileId: string): Direction | null {
  switch (tileId) {
    case "force_n":
      return "up";
    case "force_s":
      return "down";
    case "force_e":
      return "right";
    case "force_w":
      return "left";
    case "force_any":
      return "right";
    default:
      return null;
  }
}

function hasIceSkates(state: MsCc1PlayerState): boolean {
  return state.tools.includes("ice_skates");
}

function hasSuctionBoots(state: MsCc1PlayerState): boolean {
  return state.tools.includes("suction_boots");
}

/**
 * After Chip lands on `tileId`, continue sliding in this direction (or stop).
 * Ice corners turn 90°; straight ice continues on `entryDirection`.
 */
export function slideDirectionAfterLanding(
  tileId: string,
  state: MsCc1PlayerState,
  entryDirection: Direction,
): Direction | null {
  if (SLIDE_STOP_FLOOR_TILE_IDS.has(tileId)) {
    return null;
  }
  if (isIceCornerTile(tileId)) {
    if (hasIceSkates(state)) {
      return null;
    }
    return iceCornerExitDirection(tileId, entryDirection);
  }
  if (isIceStraightTile(tileId)) {
    return hasIceSkates(state) ? null : entryDirection;
  }
  if (isForceFloorTile(tileId)) {
    if (hasSuctionBoots(state)) {
      return null;
    }
    return forceFloorDirection(tileId);
  }
  return null;
}

export function standingTileAt(
  level: LevelData,
  x: number,
  y: number,
): string {
  return getCompositeTile(level, x, y);
}
