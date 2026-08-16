import { cellTile, getCompositeTile, removeTileAt, setUpperTile } from "../levelRuntime.js";
import type { LevelData } from "../types.js";
import type { MsCc1CellChange } from "./types.js";
import type { MsCc1MonsterState } from "./msCc1Monsters.js";
import { reverseMonsterFacing } from "./monsterDirection.js";
import { monsterTileId } from "./monsterDirection.js";
import { applyRedButtonClone } from "./msCc1Clone.js";
import {
  openTrapForBrownButton,
  stickCreatureOnTrap,
} from "./msCc1Traps.js";
import { isButtonTile, isToggleWallTile } from "../../tile-engine/tiles.js";

/** Button under a creature (lower layer) or on the surface (upper only). */
function buttonTileAt(level: LevelData, x: number, y: number): string | null {
  const lower = cellTile(level, "lower", x, y);
  if (isButtonTile(lower)) {
    return lower;
  }
  const upper = cellTile(level, "upper", x, y);
  if (isButtonTile(upper)) {
    return upper;
  }
  return null;
}

import type { MsStepParity } from "./msCc1Teeth.js";

export interface MsCc1ButtonPressContext {
  /** Red buttons that can still fire a clone on the next step onto them. */
  redButtonArmed: Set<string>;
  /** Trap cells opened by brown buttons (tile remains; MS acting floor). */
  openTraps: Set<string>;
  /** Closed traps holding a creature until opened. */
  stuckOnTraps: Set<string>;
  /** Brown buttons held down by a block (linked traps stay open). */
  heldBrownButtons: Set<string>;
  /** MS move boundaries since level start (incremented each monster-list tick). */
  moveBoundary: number;
  /** Teeth / blob cadence; MSCC defaults to even step. */
  stepParity?: MsStepParity;
  /**
   * MS: teeth ignore Chip while he slides on ice or force floors.
   * Set by the client for the duration of involuntary slide chains.
   */
  chipIgnoresTeeth?: boolean;
}

const TOGGLE_CLOSED = "block_toggle_closed";
const TOGGLE_OPEN = "block_toggle_open";

function recordToggle(
  cellChanges: MsCc1CellChange[],
  x: number,
  y: number,
  removed: string,
  placed: string,
): void {
  cellChanges.push({ x, y, removedTileId: removed, placedTileId: placed });
}

/** MS: green button toggles every toggle wall on the level. */
export function toggleAllToggleWalls(
  level: LevelData,
  cellChanges: MsCc1CellChange[],
): void {
  const { width, height, layers } = level;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const upper = layers.upper[i]!;
      const lower = layers.lower[i]!;

      if (upper === TOGGLE_CLOSED) {
        layers.upper[i] = TOGGLE_OPEN;
        recordToggle(cellChanges, x, y, TOGGLE_CLOSED, TOGGLE_OPEN);
      } else if (upper === TOGGLE_OPEN) {
        layers.upper[i] = TOGGLE_CLOSED;
        recordToggle(cellChanges, x, y, TOGGLE_OPEN, TOGGLE_CLOSED);
      } else if (lower === TOGGLE_CLOSED) {
        layers.lower[i] = TOGGLE_OPEN;
        recordToggle(cellChanges, x, y, TOGGLE_CLOSED, TOGGLE_OPEN);
      } else if (lower === TOGGLE_OPEN) {
        layers.lower[i] = TOGGLE_CLOSED;
        recordToggle(cellChanges, x, y, TOGGLE_OPEN, TOGGLE_CLOSED);
      }
    }
  }
}

function updateTankFacingOnMap(
  level: LevelData,
  monster: MsCc1MonsterState,
  cellChanges: MsCc1CellChange[],
): void {
  const oldTile = monster.tileId;
  if (removeTileAt(level, monster.x, monster.y, oldTile)) {
    cellChanges.push({ x: monster.x, y: monster.y, removedTileId: oldTile });
  }
  const newTile = monsterTileId("tank", monster.direction);
  setUpperTile(level, monster.x, monster.y, newTile);
  cellChanges.push({ x: monster.x, y: monster.y, placedTileId: newTile });
  monster.tileId = newTile;
}

/** MS: blue button reverses all non-sliding tanks 180°. */
export function reverseAllTanks(
  level: LevelData,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
): void {
  for (const monster of monsters) {
    if (!monster.alive || monster.kind !== "tank") {
      continue;
    }
    monster.direction = reverseMonsterFacing(monster.direction);
    monster.stopped = false;
    updateTankFacingOnMap(level, monster, cellChanges);
  }
}

/** Collect all red-button cells on the map (armed at level start). */
export function collectRedButtonCells(level: LevelData): Set<string> {
  const armed = new Set<string>();
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (getCompositeTile(level, x, y) === "button_red") {
        armed.add(`${x},${y}`);
      }
    }
  }
  return armed;
}

/** Apply MS button effects after a move from `from` to `to`. */
export function applyButtonPressAt(
  level: LevelData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): void {
  if (buttonTileAt(level, from.x, from.y) === "button_red") {
    ctx.redButtonArmed.add(`${from.x},${from.y}`);
  }

  const toButton = buttonTileAt(level, to.x, to.y);
  if (toButton === "button_green") {
    toggleAllToggleWalls(level, cellChanges);
  } else if (toButton === "button_blue") {
    reverseAllTanks(level, monsters, cellChanges);
  } else if (toButton === "button_brown") {
    openTrapForBrownButton(level, to.x, to.y, monsters, cellChanges, ctx);
  } else if (toButton === "button_red") {
    const key = `${to.x},${to.y}`;
    if (ctx.redButtonArmed.has(key)) {
      applyRedButtonClone(level, to.x, to.y, monsters, cellChanges);
      ctx.redButtonArmed.delete(key);
    }
  }

  stickCreatureOnTrap(level, to.x, to.y, ctx);
}

export { isToggleWallTile };

export function isToggleWallClosed(level: LevelData, x: number, y: number): boolean {
  const upper = cellTile(level, "upper", x, y);
  const lower = cellTile(level, "lower", x, y);
  return upper === TOGGLE_CLOSED || lower === TOGGLE_CLOSED;
}
