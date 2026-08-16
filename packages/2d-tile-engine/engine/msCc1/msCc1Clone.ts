import { cellTile, getCompositeTile, removeTileAt, setUpperTile } from "../levelRuntime.js";
import type { LevelData } from "../types.js";
import type { MsCc1CellChange } from "./types.js";
import type { MsCc1MonsterState } from "./msCc1Monsters.js";
import {
  facingFromMonsterTileId,
  monsterFacingDelta,
  monsterKindFromTileId,
  monsterTileId,
  type MonsterFacing,
} from "./monsterDirection.js";
import { isMonsterTile } from "../../tile-engine/tiles.js";

function recordChange(
  cellChanges: MsCc1CellChange[],
  x: number,
  y: number,
  removed?: string,
  placed?: string,
): void {
  const change: MsCc1CellChange = { x, y };
  if (removed) {
    change.removedTileId = removed;
  }
  if (placed) {
    change.placedTileId = placed;
  }
  cellChanges.push(change);
}

function monsterOnCloner(level: LevelData, cloneX: number, cloneY: number): {
  kind: string;
  facing: MonsterFacing;
  tileId: string;
} | null {
  const upper = cellTile(level, "upper", cloneX, cloneY);
  if (isMonsterTile(upper)) {
    const kind = monsterKindFromTileId(upper);
    const facing = facingFromMonsterTileId(upper);
    if (kind && facing) {
      return { kind, facing, tileId: upper };
    }
  }
  return null;
}

function isSpawnCellClear(
  level: LevelData,
  x: number,
  y: number,
  monsters: MsCc1MonsterState[],
): boolean {
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
    return false;
  }
  for (const monster of monsters) {
    if (monster.alive && monster.x === x && monster.y === y) {
      return false;
    }
  }
  const composite = getCompositeTile(level, x, y);
  if (composite === "wall" || composite === "block_toggle_closed" || composite === "cloner") {
    return false;
  }
  if (isMonsterTile(composite)) {
    return false;
  }
  return true;
}

/** MS: red button → clone machine (DAT field 5). Spawns one monster in its facing direction. */
export function applyRedButtonClone(
  level: LevelData,
  buttonX: number,
  buttonY: number,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
): boolean {
  const links = level.cloneLinks;
  if (!links || links.length === 0) {
    return false;
  }

  const link = links.find((l) => l.button.x === buttonX && l.button.y === buttonY);
  if (!link) {
    return false;
  }

  const source = monsterOnCloner(level, link.clone.x, link.clone.y);
  if (!source) {
    return false;
  }

  // MS: clone exits one tile in the preview creature's facing (Lesson 5: west / left of box).
  const { dx, dy } = monsterFacingDelta(source.facing);
  const spawnX = link.clone.x + dx;
  const spawnY = link.clone.y + dy;
  if (!isSpawnCellClear(level, spawnX, spawnY, monsters)) {
    return false;
  }

  const newTileId = monsterTileId(source.kind, source.facing);
  setUpperTile(level, spawnX, spawnY, newTileId);
  recordChange(cellChanges, spawnX, spawnY, undefined, newTileId);

  monsters.push({
    x: spawnX,
    y: spawnY,
    direction: source.facing,
    kind: source.kind,
    tileId: newTileId,
    alive: true,
    stopped: false,
  });

  return true;
}

