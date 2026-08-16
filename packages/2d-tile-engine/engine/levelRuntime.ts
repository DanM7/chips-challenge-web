import type { LevelData } from "./types";
import {
  BLOCKING_TILE_IDS,
  CHIP_TILE_IDS,
  DOOR_TILE_IDS,
  doorToKeyId,
  isDoorTile,
  isKeyConsumedWhenOpeningDoor,
  isKeyTile,
  isBlockTile,
  isMonsterTile,
  isSocketTile,
  BLOCK_MOVABLE_TILE_ID,
  SOCKET_TILE_ID,
  MS_POPUP_WALL_TILE_IDS,
} from "../tile-engine/tiles.js";

export {
  isKeyConsumedWhenOpeningDoor,
  isBlockTile,
  isSocketTile,
  BLOCK_MOVABLE_TILE_ID,
  SOCKET_TILE_ID,
};

export interface BlockedCellOptions {
  /** MS chip pickups still on the map; socket is passable only when this is 0. */
  chipsRemainingOnMap?: number;
  /** MS bear-trap cells opened by brown buttons (still drawn; passable). */
  openTraps?: Set<string>;
  /** Closed traps with a creature stuck on them (impassable to others). */
  stuckOnTraps?: Set<string>;
  /** When true, recessed walls do not block (Chip may step on them once). */
  allowAppearingWall?: boolean;
}

const NON_FLOOR = new Set(["empty", ...BLOCKING_TILE_IDS, ...MS_POPUP_WALL_TILE_IDS]);

function index(level: LevelData, x: number, y: number): number {
  return y * level.width + x;
}

export function cellTile(level: LevelData, layer: "upper" | "lower", x: number, y: number): string {
  const layers = level.layers;
  const arr = layer === "upper" ? layers.upper : layers.lower;
  if (!arr?.length) return "empty";
  return arr[index(level, x, y)] ?? "empty";
}

/** Topmost visible tile at a cell (upper wins when not empty). */
export function getCompositeTile(level: LevelData, x: number, y: number): string {
  const upper = cellTile(level, "upper", x, y);
  if (upper !== "empty") return upper;
  return cellTile(level, "lower", x, y);
}

/** MS: dirt on upper with water still on lower (block pushed into water, not yet dried by Chip). */
export function isWetDirtCell(level: LevelData, x: number, y: number): boolean {
  return (
    cellTile(level, "upper", x, y) === "dirt" && cellTile(level, "lower", x, y) === "water"
  );
}

/** Dirt on either layer (acting dirt for blocks). */
export function isDirtCell(level: LevelData, x: number, y: number): boolean {
  const upper = cellTile(level, "upper", x, y);
  const lower = cellTile(level, "lower", x, y);
  return upper === "dirt" || lower === "dirt";
}

/** Chip stepped on dirt: remove dirt and any underlying water → permanent floor. */
export function dryDirtCell(level: LevelData, x: number, y: number): string[] {
  const removed: string[] = [];
  if (removeTileAt(level, x, y, "dirt")) {
    removed.push("dirt");
  }
  if (removeTileAt(level, x, y, "water")) {
    removed.push("water");
  }
  return removed;
}

/** Walkable floor under a collectible or other upper-layer tile. */
export function getFloorTileId(level: LevelData, x: number, y: number): string {
  const lower = cellTile(level, "lower", x, y);
  const upper = cellTile(level, "upper", x, y);
  if (upper !== "empty") {
    return lower !== "empty" ? lower : "empty";
  }
  return lower;
}

export function isBlockedCell(
  level: LevelData,
  x: number,
  y: number,
  options?: BlockedCellOptions,
): boolean {
  const upper = cellTile(level, "upper", x, y);
  const lower = cellTile(level, "lower", x, y);
  const chipsLeft = options?.chipsRemainingOnMap;

  if (isSocketTile(upper) || isSocketTile(lower)) {
    return chipsLeft === undefined || chipsLeft > 0;
  }
  if (DOOR_TILE_IDS.has(upper) || DOOR_TILE_IDS.has(lower)) return true;
  const trapKey = `${x},${y}`;
  const isTrap = upper === "trap" || lower === "trap";
  if (isTrap) {
    const trapOpen = options?.openTraps?.has(trapKey) ?? false;
    if (trapOpen) {
      return false;
    }
    return options?.stuckOnTraps?.has(trapKey) ?? false;
  }
  if (
    (MS_POPUP_WALL_TILE_IDS.has(upper) || MS_POPUP_WALL_TILE_IDS.has(lower)) &&
    !options?.allowAppearingWall
  ) {
    return true;
  }
  if (BLOCKING_TILE_IDS.has(upper) && upper !== "trap") return true;
  if (BLOCKING_TILE_IDS.has(lower) && lower !== "trap") return true;
  if (CHIP_TILE_IDS.has(upper)) return false;
  return false;
}

export { doorToKeyId, isDoorTile, isKeyTile };

export function isRenderableFloor(tileId: string): boolean {
  return !NON_FLOOR.has(tileId) || tileId === "empty";
}

/** Remove a tile from either layer at a cell. */
export function removeTileAt(
  level: LevelData,
  x: number,
  y: number,
  tileId: string,
): boolean {
  const i = index(level, x, y);
  let removed = false;
  if (level.layers.upper[i] === tileId) {
    level.layers.upper[i] = "empty";
    removed = true;
  }
  if (level.layers.lower[i] === tileId) {
    level.layers.lower[i] = "empty";
    removed = true;
  }
  return removed;
}

/** Set the upper-layer tile at a cell (MS objects sit on the top layer). */
export function setUpperTile(level: LevelData, x: number, y: number, tileId: string): void {
  const i = index(level, x, y);
  level.layers.upper[i] = tileId;
}

/** Set the lower-layer tile at a cell (floor / buttons under actors). */
export function setLowerTile(level: LevelData, x: number, y: number, tileId: string): void {
  const i = index(level, x, y);
  level.layers.lower[i] = tileId;
}

export function isCloneMachineAt(level: LevelData, x: number, y: number): boolean {
  return cellTile(level, "lower", x, y) === "cloner";
}

/** Lower-layer tile to draw under a creature (toggle walls, fire, buttons, etc.). */
export function getLowerTileUnderMonster(
  level: LevelData,
  x: number,
  y: number,
): string | null {
  const upper = cellTile(level, "upper", x, y);
  if (!isMonsterTile(upper)) {
    return null;
  }
  const lower = cellTile(level, "lower", x, y);
  return lower !== "empty" ? lower : null;
}

/** Remove a collectible tile from the map (e.g. chip or key picked up). */
export function removeCollectibleAt(
  level: LevelData,
  x: number,
  y: number,
  tileId = "chip",
): boolean {
  return removeTileAt(level, x, y, tileId);
}

export function tileDisplayColor(tileId: string): number {
  if (
    tileId === "wall" ||
    tileId === "wall_appearing" ||
    tileId === "hint_tile" ||
    tileId === "invisible_wall"
  ) {
    return 0x4a4a62;
  }
  if (tileId === "water") return 0x2a4a8a;
  if (tileId === "fire") return 0x8a3a2a;
  if (tileId === "chip" || tileId.startsWith("chip_")) return 0x3a5a3a;
  if (tileId === "dirt" || tileId === "gravel") return 0x5a4a3a;
  if (tileId.startsWith("door_")) return 0x6a5a2a;
  if (tileId.startsWith("key_")) return 0x8a8a2a;
  if (tileId === "exit") return 0x2a8a4a;
  return 0x2e2e42;
}
