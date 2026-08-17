import type { LevelData } from "../types.js";
import type { MsCc1CellChange } from "./types.js";
import {
  cellTile,
  getCompositeTile,
  isBlockedCell,
  isCloneMachineAt,
  isDirtCell,
  isDoorTile,
  isSocketTile,
  removeTileAt,
  setLowerTile,
  setUpperTile,
} from "../levelRuntime.js";
import {
  COLLECTIBLE_CHIP_TILE_ID,
  isBlockTile,
  isButtonTile,
  isMonsterTile,
  isToggleWallTile,
} from "../../tile-engine/tiles.js";
import {
  isCreatureStuckOnTrap,
  isTrapBlockingEntry,
  TRAP_TILE_ID,
  type TrapMechanicsCtx,
} from "./msCc1Traps.js";
import type { MsCc1ButtonPressContext } from "./msCc1Buttons.js";
import {
  facingFromMonsterTileId,
  monsterFacingDelta,
  monsterKindFromTileId,
  monsterTileId,
  reverseMonsterFacing,
  turnMonsterLeft,
  turnMonsterRight,
  type MonsterFacing,
} from "./monsterDirection.js";
import {
  advanceMoveBoundary,
  chooseTeethStepFacing,
  teethMovesThisBoundary,
} from "./msCc1Teeth.js";

/** Called after a creature step (Chip or monster) for button / clone / trap effects. */
export type MsCc1AfterStepHook = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  cellChanges: MsCc1CellChange[],
) => void;

const EXIT_TILE_IDS = new Set(["exit", "chip_exit", "exit_3a", "exit_3b"]);

function isExitTile(tileId: string): boolean {
  return EXIT_TILE_IDS.has(tileId);
}

/** Options for {@link tickMsCc1Monsters} (client idle clock vs Chip-move tick). */
export interface MsCc1MonsterTickOptions {
  /**
   * When false (idle monster clock), fireballs and other monsters still step;
   * teeth odd/even boundaries do not advance. Default true.
   */
  advanceTeethBoundary?: boolean;
}

export const MS_DEATH_CREATURES = "Ooops! Look out for creatures!";

/** MS: five move boundaries per in-game second (monsters tick each move, not only when Chip moves). */
export const MS_MOVES_PER_GAME_SECOND = 5;
export const MS_MOVE_INTERVAL_MS = 1000 / MS_MOVES_PER_GAME_SECOND;
/** Chip walk / slide: one tile per MS game step (~5 tiles per second). */
export const MS_CHIP_WALK_STEP_MS = MS_MOVE_INTERVAL_MS;

export interface MsCc1MonsterState {
  x: number;
  y: number;
  direction: MonsterFacing;
  kind: string;
  tileId: string;
  alive: boolean;
  /** MS tanks stop when blocked until reversed by a blue button. */
  stopped?: boolean;
}

export interface MsCc1MonsterTickResult {
  cellChanges: MsCc1CellChange[];
  chipDied: boolean;
}

function recordRemoval(
  cellChanges: MsCc1CellChange[],
  x: number,
  y: number,
  tileId: string,
): void {
  cellChanges.push({ x, y, removedTileId: tileId });
}

function recordPlacement(
  cellChanges: MsCc1CellChange[],
  x: number,
  y: number,
  tileId: string,
): void {
  cellChanges.push({ x, y, placedTileId: tileId });
}

/** Build runtime monster list from DAT field 10 order (reading order). */
export function createMsCc1Monsters(level: LevelData): MsCc1MonsterState[] {
  const entries =
    (level.monsters && level.monsters.length > 0
      ? level.monsters
      : scanMonsterCellsOnMap(level)) ?? [];
  const monsters: MsCc1MonsterState[] = [];

  for (const entry of entries) {
    if (isCloneMachineAt(level, entry.x, entry.y)) {
      continue;
    }
    const tileId = getCompositeTile(level, entry.x, entry.y);
    const kind = monsterKindFromTileId(tileId);
    if (!kind) {
      continue;
    }
    const facing = facingFromMonsterTileId(tileId) ?? msDirectionToFacing(entry.direction);
    monsters.push({
      x: entry.x,
      y: entry.y,
      direction: facing,
      kind,
      tileId,
      alive: true,
      stopped: false,
    });
  }

  appendMapMonstersMissingFromList(level, monsters);

  syncMonsterTilesOnLevel(level, monsters);

  return monsters;
}

/** Write each live creature onto the map (brown buttons / traps stay underneath). */
export function syncMonsterTilesOnLevel(
  level: LevelData,
  monsters: MsCc1MonsterState[],
): void {
  for (const monster of monsters) {
    if (!monster.alive) {
      continue;
    }
    const { x, y } = monster;
    const tileId = monsterTileId(monster.kind, monster.direction);
    const upper = cellTile(level, "upper", x, y);
    if (upper === "button_brown") {
      setLowerTile(level, x, y, "button_brown");
    }
    if (cellTile(level, "lower", x, y) === "trap") {
      const i = y * level.width + x;
      if (level.layers.upper[i] === "trap") {
        level.layers.upper[i] = "empty";
      }
    }
    setUpperTile(level, x, y, tileId);
    monster.tileId = tileId;
  }
}

function msDirectionToFacing(
  dir: "north" | "east" | "south" | "west",
): MonsterFacing {
  return dir === "north"
    ? "north"
    : dir === "east"
      ? "east"
      : dir === "south"
        ? "south"
        : "west";
}

/** DAT field 10 can disagree with the creature tile on the map; always register map creatures. */
function appendMapMonstersMissingFromList(
  level: LevelData,
  monsters: MsCc1MonsterState[],
): void {
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (isCloneMachineAt(level, x, y)) {
        continue;
      }
      if (monsters.some((m) => m.alive && m.x === x && m.y === y)) {
        continue;
      }
      const tileId = cellTile(level, "upper", x, y);
      const kind = monsterKindFromTileId(tileId);
      if (!kind) {
        continue;
      }
      const facing = facingFromMonsterTileId(tileId) ?? "north";
      monsters.push({
        x,
        y,
        direction: facing,
        kind,
        tileId,
        alive: true,
        stopped: false,
      });
    }
  }
}

function scanMonsterCellsOnMap(level: LevelData): LevelData["monsters"] {
  const found: NonNullable<LevelData["monsters"]> = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (isCloneMachineAt(level, x, y)) {
        continue;
      }
      const tileId = getCompositeTile(level, x, y);
      const kind = monsterKindFromTileId(tileId);
      if (!kind) {
        continue;
      }
      const facing = facingFromMonsterTileId(tileId) ?? "north";
      found.push({
        x,
        y,
        direction:
          facing === "north"
            ? "north"
            : facing === "east"
              ? "east"
              : facing === "south"
                ? "south"
                : "west",
      });
    }
  }
  return found;
}

type MonsterEnterResult = "ok" | "blocked" | "drown" | "die" | "explode";

/** Map chip pickup (`chip` tile), not Chip's avatar sprites. */
function isMapCollectibleChipAt(level: LevelData, x: number, y: number): boolean {
  return (
    cellTile(level, "upper", x, y) === COLLECTIBLE_CHIP_TILE_ID ||
    cellTile(level, "lower", x, y) === COLLECTIBLE_CHIP_TILE_ID
  );
}

/**
 * MS acting-wall chips: pink balls and walkers (classic), plus teeth (frog).
 * Teeth must not path through uncollected chips — required for Digger (CC1 #19).
 */
function monsterTreatsChipAsWall(kind: string): boolean {
  return kind === "ball_pink" || kind === "walker" || kind === "frog";
}

function canMonsterEnter(
  level: LevelData,
  x: number,
  y: number,
  kind: string,
  chipsLeft: number,
  occupied: Set<string>,
  mechanics?: TrapMechanicsCtx,
): MonsterEnterResult {
  if (x < 0 || x >= level.width || y < 0 || y >= level.height) {
    return "blocked";
  }

  const key = `${x},${y}`;
  if (occupied.has(key)) {
    return "blocked";
  }

  const composite = getCompositeTile(level, x, y);
  if (composite === "water") {
    return kind === "ghost" ? "ok" : "drown";
  }
  if (composite === "fire") {
    if (kind === "fireball") {
      return "ok";
    }
    if (kind === "ghost") {
      return "die";
    }
    return "blocked";
  }
  if (composite === "bomb") {
    return "explode";
  }
  if (isDirtCell(level, x, y)) {
    return "blocked";
  }
  if (composite === "gravel") {
    return "blocked";
  }
  if (monsterTreatsChipAsWall(kind) && isMapCollectibleChipAt(level, x, y)) {
    return "blocked";
  }
  if (isBlockTile(composite) || isDoorTile(composite) || isExitTile(composite)) {
    return "blocked";
  }
  if (isSocketTile(composite) && chipsLeft > 0) {
    return "blocked";
  }
  if (isMonsterTile(composite)) {
    return "blocked";
  }
  if (mechanics && isTrapBlockingEntry(level, x, y, mechanics)) {
    return "blocked";
  }
  if (
    isBlockedCell(level, x, y, {
      chipsRemainingOnMap: chipsLeft,
      openTraps: mechanics?.openTraps,
      stuckOnTraps: mechanics?.stuckOnTraps,
    })
  ) {
    return "blocked";
  }

  return "ok";
}

function removeMonsterFromMap(
  level: LevelData,
  monster: MsCc1MonsterState,
  cellChanges: MsCc1CellChange[],
): void {
  const { x, y } = monster;
  removeTileAt(level, x, y, monster.tileId);
  recordRemoval(cellChanges, x, y, monster.tileId);
  restoreButtonAfterMonsterLeaves(level, x, y, cellChanges);
  restoreToggleWallAfterMonsterLeaves(level, x, y, cellChanges);
  restoreTrapAfterMonsterLeaves(level, x, y, cellChanges);
  restoreChipCollectibleAfterMonsterLeaves(level, x, y, cellChanges);
  monster.alive = false;
}

/** MS: buttons stay on the floor when a creature steps on them. */
function restoreButtonAfterMonsterLeaves(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const lower = cellTile(level, "lower", x, y);
  if (!isButtonTile(lower)) {
    return;
  }
  setUpperTile(level, x, y, lower);
  setLowerTile(level, x, y, "empty");
  recordPlacement(cellChanges, x, y, lower);
}

function preserveButtonBeforeMonsterEnters(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const upper = cellTile(level, "upper", x, y);
  if (!isButtonTile(upper)) {
    return;
  }
  setLowerTile(level, x, y, upper);
  recordPlacement(cellChanges, x, y, upper);
}

/** MS: map chips stay when creatures step on them (only Chip collects). */
function restoreChipCollectibleAfterMonsterLeaves(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const lower = cellTile(level, "lower", x, y);
  if (lower !== COLLECTIBLE_CHIP_TILE_ID) {
    return;
  }
  setUpperTile(level, x, y, COLLECTIBLE_CHIP_TILE_ID);
  setLowerTile(level, x, y, "empty");
  recordPlacement(cellChanges, x, y, COLLECTIBLE_CHIP_TILE_ID);
}

function preserveChipCollectibleBeforeMonsterEnters(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const upper = cellTile(level, "upper", x, y);
  if (upper !== COLLECTIBLE_CHIP_TILE_ID) {
    return;
  }
  setLowerTile(level, x, y, COLLECTIBLE_CHIP_TILE_ID);
  recordPlacement(cellChanges, x, y, COLLECTIBLE_CHIP_TILE_ID);
}

/** MS: open/closed toggle walls stay under creatures (same as buttons). */
function restoreToggleWallAfterMonsterLeaves(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const lower = cellTile(level, "lower", x, y);
  if (!isToggleWallTile(lower)) {
    return;
  }
  setUpperTile(level, x, y, lower);
  setLowerTile(level, x, y, "empty");
  recordPlacement(cellChanges, x, y, lower);
}

function preserveToggleWallBeforeMonsterEnters(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const upper = cellTile(level, "upper", x, y);
  if (!isToggleWallTile(upper)) {
    return;
  }
  setLowerTile(level, x, y, upper);
  recordPlacement(cellChanges, x, y, upper);
}

/** MS: fire is floor; creatures pass over it without removing the tile. */
function preserveTrapBeforeMonsterEnters(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const upper = cellTile(level, "upper", x, y);
  if (upper !== TRAP_TILE_ID) {
    return;
  }
  setLowerTile(level, x, y, TRAP_TILE_ID);
  recordPlacement(cellChanges, x, y, TRAP_TILE_ID);
  const i = y * level.width + x;
  if (level.layers.upper[i] === TRAP_TILE_ID) {
    level.layers.upper[i] = "empty";
    recordRemoval(cellChanges, x, y, TRAP_TILE_ID);
  }
}

function restoreTrapAfterMonsterLeaves(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const lower = cellTile(level, "lower", x, y);
  if (lower !== TRAP_TILE_ID) {
    return;
  }
  setUpperTile(level, x, y, TRAP_TILE_ID);
  setLowerTile(level, x, y, "empty");
  recordPlacement(cellChanges, x, y, TRAP_TILE_ID);
}

/** MS: fire is floor; creatures pass over it without removing the tile. */
function preserveFireBeforeMonsterEnters(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const upper = cellTile(level, "upper", x, y);
  if (upper !== "fire") {
    return;
  }
  if (cellTile(level, "lower", x, y) === "empty") {
    setLowerTile(level, x, y, "fire");
    recordPlacement(cellChanges, x, y, "fire");
  }
  const i = y * level.width + x;
  if (level.layers.upper[i] === "fire") {
    level.layers.upper[i] = "empty";
    recordRemoval(cellChanges, x, y, "fire");
  }
}

function moveMonsterOnMap(
  level: LevelData,
  monster: MsCc1MonsterState,
  toX: number,
  toY: number,
  newFacing: MonsterFacing,
  cellChanges: MsCc1CellChange[],
): { fromX: number; fromY: number } {
  const fromX = monster.x;
  const fromY = monster.y;
  const oldTileId = monster.tileId;

  removeTileAt(level, fromX, fromY, oldTileId);
  recordRemoval(cellChanges, fromX, fromY, oldTileId);
  restoreButtonAfterMonsterLeaves(level, fromX, fromY, cellChanges);
  restoreToggleWallAfterMonsterLeaves(level, fromX, fromY, cellChanges);
  restoreTrapAfterMonsterLeaves(level, fromX, fromY, cellChanges);
  restoreChipCollectibleAfterMonsterLeaves(level, fromX, fromY, cellChanges);

  preserveButtonBeforeMonsterEnters(level, toX, toY, cellChanges);
  preserveToggleWallBeforeMonsterEnters(level, toX, toY, cellChanges);
  preserveTrapBeforeMonsterEnters(level, toX, toY, cellChanges);
  if (!monsterTreatsChipAsWall(monster.kind)) {
    preserveChipCollectibleBeforeMonsterEnters(level, toX, toY, cellChanges);
  }
  preserveFireBeforeMonsterEnters(level, toX, toY, cellChanges);

  const newTileId = monsterTileId(monster.kind, newFacing);
  setUpperTile(level, toX, toY, newTileId);
  recordPlacement(cellChanges, toX, toY, newTileId);

  monster.x = toX;
  monster.y = toY;
  monster.direction = newFacing;
  monster.tileId = newTileId;

  return { fromX, fromY };
}

function setMonsterFacingInPlace(
  level: LevelData,
  monster: MsCc1MonsterState,
  facing: MonsterFacing,
  cellChanges: MsCc1CellChange[],
): void {
  if (monster.direction === facing) {
    return;
  }
  removeTileAt(level, monster.x, monster.y, monster.tileId);
  recordRemoval(cellChanges, monster.x, monster.y, monster.tileId);
  const newTileId = monsterTileId(monster.kind, facing);
  setUpperTile(level, monster.x, monster.y, newTileId);
  recordPlacement(cellChanges, monster.x, monster.y, newTileId);
  monster.direction = facing;
  monster.tileId = newTileId;
}

type MonsterStepResult = "moved" | "blocked" | "removed";

function tryMonsterStep(
  level: LevelData,
  monster: MsCc1MonsterState,
  facing: MonsterFacing,
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  afterStep?: MsCc1AfterStepHook,
  mechanics?: TrapMechanicsCtx,
): MonsterStepResult {
  if (mechanics && isCreatureStuckOnTrap(mechanics, monster.x, monster.y)) {
    return "blocked";
  }
  const { dx, dy } = monsterFacingDelta(facing);
  const nx = monster.x + dx;
  const ny = monster.y + dy;
  const enter = canMonsterEnter(
    level,
    nx,
    ny,
    monster.kind,
    chipsLeft,
    occupied,
    mechanics,
  );

  if (enter === "drown" || enter === "die" || enter === "explode") {
    const fromX = monster.x;
    const fromY = monster.y;
    removeMonsterFromMap(level, monster, cellChanges);
    occupied.delete(`${fromX},${fromY}`);
    // MS: creature + bomb both clear; fire/water deaths leave the terrain.
    if (enter === "explode") {
      if (removeTileAt(level, nx, ny, "bomb")) {
        recordRemoval(cellChanges, nx, ny, "bomb");
      }
    }
    return "removed";
  }
  if (enter === "blocked") {
    return "blocked";
  }

  occupied.delete(`${monster.x},${monster.y}`);
  const { fromX, fromY } = moveMonsterOnMap(level, monster, nx, ny, facing, cellChanges);
  occupied.add(`${nx},${ny}`);

  afterStep?.({ x: fromX, y: fromY }, { x: nx, y: ny }, cellChanges);

  return "moved";
}

/** MS bug: prefer left, then forward, then right (left-wall follower). */
function stepBug(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  monsters: MsCc1MonsterState[],
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
): boolean {
  if (!monster.alive) {
    return false;
  }

  const tryFacings: MonsterFacing[] = [
    turnMonsterLeft(monster.direction),
    monster.direction,
    turnMonsterRight(monster.direction),
  ];

  for (const facing of tryFacings) {
    const result = tryMonsterStep(
      level,
      monster,
      facing,
      chipsLeft,
      occupied,
      cellChanges,
      afterStep,
      mechanics,
    );
    if (result === "removed") {
      return false;
    }
    if (result === "moved") {
      return monster.x === chipPosition.x && monster.y === chipPosition.y;
    }
  }

  return false;
}

/** MS tank: move forward only; stop when blocked. */
function stepTank(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  monsters: MsCc1MonsterState[],
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
): boolean {
  if (!monster.alive || monster.stopped) {
    return false;
  }

  const result = tryMonsterStep(
    level,
    monster,
    monster.direction,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    mechanics,
  );
  if (result === "removed") {
    return false;
  }
  if (result === "blocked") {
    monster.stopped = true;
    return false;
  }

  return monster.x === chipPosition.x && monster.y === chipPosition.y;
}

/** MS glider (ghost): forward; on block try left, right, then reverse. Survives water, dies in fire. */
function stepGlider(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  monsters: MsCc1MonsterState[],
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
): boolean {
  if (!monster.alive) {
    return false;
  }

  const forward = tryMonsterStep(
    level,
    monster,
    monster.direction,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    mechanics,
  );
  if (forward === "removed") {
    return false;
  }
  if (forward === "moved") {
    return monster.x === chipPosition.x && monster.y === chipPosition.y;
  }

  const tryFacings: MonsterFacing[] = [
    turnMonsterLeft(monster.direction),
    turnMonsterRight(monster.direction),
    reverseMonsterFacing(monster.direction),
  ];
  for (const facing of tryFacings) {
    const result = tryMonsterStep(
      level,
      monster,
      facing,
      chipsLeft,
      occupied,
      cellChanges,
      afterStep,
      mechanics,
    );
    if (result === "removed") {
      return false;
    }
    if (result === "moved") {
      return monster.x === chipPosition.x && monster.y === chipPosition.y;
    }
  }

  return false;
}

/** MS fireball: forward; on block try right, left, then reverse. Survives fire, drowns in water. */
function stepFireball(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  monsters: MsCc1MonsterState[],
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
): boolean {
  if (!monster.alive) {
    return false;
  }

  const forward = tryMonsterStep(
    level,
    monster,
    monster.direction,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    mechanics,
  );
  if (forward === "removed") {
    return false;
  }
  if (forward === "moved") {
    return monster.x === chipPosition.x && monster.y === chipPosition.y;
  }

  const tryFacings: MonsterFacing[] = [
    turnMonsterRight(monster.direction),
    turnMonsterLeft(monster.direction),
    reverseMonsterFacing(monster.direction),
  ];
  for (const facing of tryFacings) {
    const result = tryMonsterStep(
      level,
      monster,
      facing,
      chipsLeft,
      occupied,
      cellChanges,
      afterStep,
      mechanics,
    );
    if (result === "removed") {
      return false;
    }
    if (result === "moved") {
      return monster.x === chipPosition.x && monster.y === chipPosition.y;
    }
  }

  return false;
}

/** MS pink ball: forward; when blocked, reverse and continue in that direction. */
function stepBallPink(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  monsters: MsCc1MonsterState[],
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
): boolean {
  if (!monster.alive) {
    return false;
  }

  const first = tryMonsterStep(
    level,
    monster,
    monster.direction,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    mechanics,
  );
  if (first === "removed") {
    return false;
  }
  if (first === "moved") {
    return monster.x === chipPosition.x && monster.y === chipPosition.y;
  }

  const reversed = reverseMonsterFacing(monster.direction);
  setMonsterFacingInPlace(level, monster, reversed, cellChanges);

  const second = tryMonsterStep(
    level,
    monster,
    reversed,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    mechanics,
  );
  if (second === "removed") {
    return false;
  }
  if (second === "moved") {
    return monster.x === chipPosition.x && monster.y === chipPosition.y;
  }

  return false;
}

const WALKER_FACINGS: MonsterFacing[] = ["north", "east", "south", "west"];

/**
 * MS walker: move forward; when blocked, pick a random legal direction (MS never
 * chooses a blocked facing when any open facing exists). Dies in water/bombs; fire is a wall.
 */
function pickRandomUnblockedWalkerFacing(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipsLeft: number,
  occupied: Set<string>,
  mechanics?: TrapMechanicsCtx,
): MonsterFacing | null {
  const options: MonsterFacing[] = [];
  for (const facing of WALKER_FACINGS) {
    const { dx, dy } = monsterFacingDelta(facing);
    const enter = canMonsterEnter(
      level,
      monster.x + dx,
      monster.y + dy,
      monster.kind,
      chipsLeft,
      occupied,
      mechanics,
    );
    if (enter === "ok") {
      options.push(facing);
    }
  }
  if (options.length === 0) {
    return null;
  }
  return options[Math.floor(Math.random() * options.length)]!;
}

function stepWalker(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  monsters: MsCc1MonsterState[],
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
): boolean {
  if (!monster.alive) {
    return false;
  }

  const trapMechanics: TrapMechanicsCtx | undefined = mechanics;

  const forward = tryMonsterStep(
    level,
    monster,
    monster.direction,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    trapMechanics,
  );
  if (forward === "removed") {
    return false;
  }
  if (forward === "moved") {
    return monster.x === chipPosition.x && monster.y === chipPosition.y;
  }

  const facing = pickRandomUnblockedWalkerFacing(
    level,
    monster,
    chipsLeft,
    occupied,
    trapMechanics,
  );
  if (!facing) {
    return false;
  }

  if (facing !== monster.direction) {
    setMonsterFacingInPlace(level, monster, facing, cellChanges);
  }

  const turnStep = tryMonsterStep(
    level,
    monster,
    facing,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    trapMechanics,
  );
  if (turnStep === "removed") {
    return false;
  }
  if (turnStep === "moved") {
    return monster.x === chipPosition.x && monster.y === chipPosition.y;
  }

  return false;
}

/** MS teeth (frog): chase Chip every other move boundary; dirt/gravel block. */
function stepTeeth(
  level: LevelData,
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  chipsLeft: number,
  occupied: Set<string>,
  cellChanges: MsCc1CellChange[],
  moveBoundary: number,
  boundaryAdvanced: boolean,
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
): boolean {
  if (!monster.alive) {
    return false;
  }

  const trapMechanics: TrapMechanicsCtx | undefined = mechanics;
  const parity = mechanics?.stepParity ?? "even";
  if (!boundaryAdvanced) {
    return false;
  }
  if (mechanics?.chipIgnoresTeeth) {
    return false;
  }
  if (!teethMovesThisBoundary(moveBoundary, parity)) {
    return false;
  }

  const canEnter = (x: number, y: number, facing: MonsterFacing): boolean => {
    const enter = canMonsterEnter(
      level,
      x,
      y,
      monster.kind,
      chipsLeft,
      occupied,
      trapMechanics,
    );
    return enter === "ok";
  };

  const facing = chooseTeethStepFacing(monster, chipPosition, canEnter);
  if (!facing) {
    return false;
  }

  const result = tryMonsterStep(
    level,
    monster,
    facing,
    chipsLeft,
    occupied,
    cellChanges,
    afterStep,
    trapMechanics,
  );
  if (result === "removed") {
    return false;
  }
  if (result === "moved") {
    return monster.x === chipPosition.x && monster.y === chipPosition.y;
  }
  return false;
}

/**
 * MS: after Chip's voluntary move, process the monster list front-to-back.
 * Mutates `level` layers and `monsters` state.
 */
export function tickMsCc1Monsters(
  level: LevelData,
  monsters: MsCc1MonsterState[],
  chipPosition: { x: number; y: number },
  chipsRemainingOnMap: number,
  afterStep?: MsCc1AfterStepHook,
  mechanics?: MsCc1ButtonPressContext,
  options: MsCc1MonsterTickOptions = {},
): MsCc1MonsterTickResult {
  const cellChanges: MsCc1CellChange[] = [];
  let chipDied = false;
  const advanceTeethBoundary = options.advanceTeethBoundary !== false;
  const moveBoundary = advanceTeethBoundary
    ? advanceMoveBoundary(mechanics)
    : (mechanics?.moveBoundary ?? 0);

  const occupied = new Set<string>();
  for (const monster of monsters) {
    if (monster.alive) {
      occupied.add(`${monster.x},${monster.y}`);
    }
  }

  for (const monster of monsters) {
    if (!monster.alive) {
      continue;
    }
    let hitChip = false;
    if (monster.kind === "bug") {
      hitChip = stepBug(
        level,
        monster,
        chipPosition,
        chipsRemainingOnMap,
        occupied,
        cellChanges,
        monsters,
        afterStep,
        mechanics,
      );
    } else if (monster.kind === "tank") {
      hitChip = stepTank(
        level,
        monster,
        chipPosition,
        chipsRemainingOnMap,
        occupied,
        cellChanges,
        monsters,
        afterStep,
        mechanics,
      );
    } else if (monster.kind === "ghost") {
      hitChip = stepGlider(
        level,
        monster,
        chipPosition,
        chipsRemainingOnMap,
        occupied,
        cellChanges,
        monsters,
        afterStep,
        mechanics,
      );
    } else if (monster.kind === "fireball") {
      hitChip = stepFireball(
        level,
        monster,
        chipPosition,
        chipsRemainingOnMap,
        occupied,
        cellChanges,
        monsters,
        afterStep,
        mechanics,
      );
    } else if (monster.kind === "ball_pink") {
      hitChip = stepBallPink(
        level,
        monster,
        chipPosition,
        chipsRemainingOnMap,
        occupied,
        cellChanges,
        monsters,
        afterStep,
        mechanics,
      );
    } else if (monster.kind === "walker") {
      hitChip = stepWalker(
        level,
        monster,
        chipPosition,
        chipsRemainingOnMap,
        occupied,
        cellChanges,
        monsters,
        afterStep,
        mechanics,
      );
    } else if (monster.kind === "frog") {
      hitChip = stepTeeth(
        level,
        monster,
        chipPosition,
        chipsRemainingOnMap,
        occupied,
        cellChanges,
        moveBoundary,
        advanceTeethBoundary,
        afterStep,
        mechanics,
      );
    }
    if (hitChip) {
      chipDied = true;
    }
  }

  return { cellChanges, chipDied };
}

/** Clone monster runtime state for level restart snapshots. */
export function cloneMsCc1Monsters(monsters: MsCc1MonsterState[]): MsCc1MonsterState[] {
  return monsters.map((m) => ({ ...m }));
}
