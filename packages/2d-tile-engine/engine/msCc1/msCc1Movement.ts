import type { Direction, LevelData } from "../types.js";
import {
  combineMoveIntents,
  directionFromMoveIntent,
  isPerpendicularMoveIntent,
  isZeroMoveIntent,
  moveIntentFromDirection,
  type MoveIntent,
} from "../moveIntent.js";
import {
  cellTile,
  doorToKeyId,
  dryDirtCell,
  getCompositeTile,
  getFloorTileId,
  isBlockedCell,
  isDirtCell,
  isDoorTile,
  isKeyConsumedWhenOpeningDoor,
  isKeyTile,
  isSocketTile,
  isWetDirtCell,
  removeCollectibleAt,
  removeTileAt,
  setLowerTile,
  setUpperTile,
} from "../levelRuntime.js";
import {
  BLOCK_MOVABLE_TILE_ID,
  CHIP_BURNED_TILE_ID,
  CHIP_DROWNING_TILE_ID,
  CHIP_TILE_IDS,
  COLLECTIBLE_CHIP_TILE_ID,
  FIRE_BOOTS_TILE_ID,
  FLIPPERS_TILE_ID,
  isBlockTile,
  isMonsterTile,
  SOCKET_TILE_ID,
  TOOL_TILE_IDS,
  FAKE_BLUE_WALL_TILE_ID,
  MS_POPUP_WALL_TILE_IDS,
  PASS_ONCE_TILE_ID,
  WALL_APPEARING_TILE_ID,
  THIN_WALL_ORTHOGONAL_TILE_IDS,
  thinWallBlocksMove,
} from "../../tile-engine/tiles.js";
import { MS_DEATH_CREATURES } from "./msCc1Monsters.js";
import {
  getAdjacentForcePushOntoChip,
  getForceFloorIntentAt,
  getForceFloorTileAt,
  slideDirectionAfterLanding,
} from "./msCc1Sliding.js";
import {
  directionDelta,
  isFunctioningTeleportAt,
  isNonFunctioningTeleportAt,
  resolveBlueTeleport,
  resolveBlueTeleportForBlock,
  TELEPORT_TILE_ID,
} from "./msCc1Teleports.js";
import type { MsCc1ButtonPressContext } from "./msCc1Buttons.js";
import {
  applyBrownButtonHeldByBlock,
  brownButtonTileAt,
  isCreatureStuckOnTrap,
  stickCreatureOnTrap,
} from "./msCc1Traps.js";
import type { MsCc1MonsterState } from "./msCc1Monsters.js";

export type MsCc1MoveMechanics = Pick<
  MsCc1ButtonPressContext,
  "openTraps" | "stuckOnTraps"
>;

function moveMechanics(
  trapCtx?: MsCc1ButtonPressContext,
): MsCc1MoveMechanics | undefined {
  if (!trapCtx) {
    return undefined;
  }
  return {
    openTraps: trapCtx.openTraps,
    stuckOnTraps: trapCtx.stuckOnTraps,
  };
}
import type {
  MsCc1CellChange,
  MsCc1MoveResult,
  MsCc1MoveStep,
  MsCc1PlayerState,
} from "./types.js";

export type { MsCc1MoveStep } from "./types.js";

const EXIT_TILE_IDS = new Set(["exit", "chip_exit", "exit_3a", "exit_3b"]);

/** MS death message when stepping on water without flippers. */
export const MS_DEATH_NO_FLIPPERS = "Ooops! Chip can't swim without flippers!";

/** MS death message when stepping on fire without fire boots (CHIPS.EXE). */
export const MS_DEATH_NO_FIRE_BOOTS =
  "Ooops! Don't step in the fire without fire boots!";

/** MS death message when stepping on a bomb (CHIPS.EXE). */
export const MS_DEATH_NO_BOMBS = "Ooops! Don't touch the bombs!";

export const THIEF_TILE_ID = "thief";

export function isExitTile(tileId: string): boolean {
  return EXIT_TILE_IDS.has(tileId);
}

/**
 * Merge force push with voluntary input.
 * Perpendicular: diagonal boost. Matching: ride the force.
 * Opposing: MS Chip can **override** and walk in the input direction
 * (Lynx cannot). Involuntary slides pass the force direction as input, so
 * they still ride the force.
 * @see https://wiki.bitbusters.club/Force_floor
 */
function combineForceWithInput(forceIntent: MoveIntent, inputIntent: MoveIntent): MoveIntent {
  const combined = combineMoveIntents(forceIntent, inputIntent);
  if (isZeroMoveIntent(combined)) {
    return inputIntent;
  }
  return combined;
}

/**
 * First-step intent on/near force floors.
 * MS: on a force tile, or entering from upstream with perpendicular input → combine push + input.
 */
function stepIntentOnForceFloor(
  level: LevelData,
  x: number,
  y: number,
  inputDirection: Direction,
  state: MsCc1PlayerState,
): { intent: MoveIntent; direction: Direction; onForceFloor: boolean } {
  const inputIntent = moveIntentFromDirection(inputDirection);
  const standingForce = getForceFloorIntentAt(level, x, y, state);
  if (standingForce) {
    const intent = combineForceWithInput(standingForce, inputIntent);
    return {
      intent,
      direction: directionFromMoveIntent(intent),
      onForceFloor: true,
    };
  }

  const upstreamForce = getAdjacentForcePushOntoChip(level, x, y, state);
  if (
    upstreamForce &&
    isPerpendicularMoveIntent(upstreamForce, inputIntent)
  ) {
    const intent = combineForceWithInput(upstreamForce, inputIntent);
    return {
      intent,
      direction: directionFromMoveIntent(intent),
      onForceFloor: true,
    };
  }

  return { intent: inputIntent, direction: inputDirection, onForceFloor: false };
}

function hasKey(state: MsCc1PlayerState, keyId: string): boolean {
  return state.keys.includes(keyId);
}

function hasFlippers(state: MsCc1PlayerState): boolean {
  return state.tools.includes(FLIPPERS_TILE_ID);
}

function hasFireBoots(state: MsCc1PlayerState): boolean {
  return state.tools.includes(FIRE_BOOTS_TILE_ID);
}

function isFireCell(level: LevelData, x: number, y: number): boolean {
  return getCompositeTile(level, x, y) === "fire";
}

function thinWallAt(level: LevelData, x: number, y: number): string {
  const upper = cellTile(level, "upper", x, y);
  if (THIN_WALL_ORTHOGONAL_TILE_IDS.has(upper)) return upper;
  const lower = cellTile(level, "lower", x, y);
  if (THIN_WALL_ORTHOGONAL_TILE_IDS.has(lower)) return lower;
  return "empty";
}

function isBombCell(level: LevelData, x: number, y: number): boolean {
  return getCompositeTile(level, x, y) === "bomb";
}

function consumeKey(state: MsCc1PlayerState, keyId: string): void {
  const index = state.keys.indexOf(keyId);
  if (index >= 0) {
    state.keys.splice(index, 1);
  }
}

function tryAddKey(state: MsCc1PlayerState, keyId: string): boolean {
  if (!isKeyTile(keyId)) {
    return false;
  }
  // MS: colored keys stack (one lock per key). Green is infinite — keep a single copy.
  if (keyId === "key_green") {
    if (!state.keys.includes(keyId)) {
      state.keys.push(keyId);
    }
    return true;
  }
  state.keys.push(keyId);
  return true;
}

function tryAddTool(state: MsCc1PlayerState, toolId: string): boolean {
  if (!TOOL_TILE_IDS.has(toolId) || state.tools.includes(toolId)) {
    return false;
  }
  state.tools.push(toolId);
  return true;
}

function recordRemoval(
  cellChanges: MsCc1CellChange[],
  x: number,
  y: number,
  tileId: string,
): void {
  cellChanges.push({ x, y, removedTileId: tileId });
}

function isWaterCell(level: LevelData, x: number, y: number): boolean {
  return getCompositeTile(level, x, y) === "water";
}

/** MS: leaving a cell clears the Chip facing marker (`chip_n` / `chip_s` / …) on the floor. */
/** MS: Chip turns dirt (and underlying water) into permanent floor when stepping on it. */
function dryDirtUnderChip(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  if (!isDirtCell(level, x, y)) {
    return;
  }
  for (const tileId of dryDirtCell(level, x, y)) {
    recordRemoval(cellChanges, x, y, tileId);
  }
}

/** MS fake blue wall ($1E): permanent floor when Chip steps on it (acting dirt). */
function applyFakeBlueWall(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  if (!removeTileAt(level, x, y, FAKE_BLUE_WALL_TILE_ID)) {
    return;
  }
  recordRemoval(cellChanges, x, y, FAKE_BLUE_WALL_TILE_ID);
}

/**
 * MS pass-once ($2E) becomes `wall` behind Chip; wall appearing ($2C) stays open permanently.
 */
function applyPopupWallOnStep(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const upper = cellTile(level, "upper", x, y);
  const lower = cellTile(level, "lower", x, y);
  const tileId = MS_POPUP_WALL_TILE_IDS.has(upper)
    ? upper
    : MS_POPUP_WALL_TILE_IDS.has(lower)
      ? lower
      : null;
  if (!tileId) {
    return;
  }
  removeTileAt(level, x, y, tileId);
  if (tileId === PASS_ONCE_TILE_ID) {
    setUpperTile(level, x, y, "wall");
    cellChanges.push({
      x,
      y,
      removedTileId: tileId,
      placedTileId: "wall",
    });
    return;
  }
  if (tileId === WALL_APPEARING_TILE_ID) {
    recordRemoval(cellChanges, x, y, tileId);
  }
}

function clearChipMarkerOnDepart(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  const i = y * level.width + x;
  const upper = level.layers.upper[i];
  if (!upper || !CHIP_TILE_IDS.has(upper)) {
    return;
  }
  removeTileAt(level, x, y, upper);
  recordRemoval(cellChanges, x, y, upper);
}

function applyDrowningSplash(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  removeTileAt(level, x, y, "water");
  setUpperTile(level, x, y, CHIP_DROWNING_TILE_ID);
  cellChanges.push({
    x,
    y,
    removedTileId: "water",
    placedTileId: CHIP_DROWNING_TILE_ID,
  });
}

function applyFireBurnSplash(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  removeTileAt(level, x, y, "fire");
  setUpperTile(level, x, y, CHIP_BURNED_TILE_ID);
  cellChanges.push({
    x,
    y,
    removedTileId: "fire",
    placedTileId: CHIP_BURNED_TILE_ID,
  });
}

/** MS: bomb detonates with no splash tile (unlike fire). */
function applyBombDetonation(
  level: LevelData,
  x: number,
  y: number,
  cellChanges: MsCc1CellChange[],
): void {
  if (removeTileAt(level, x, y, "bomb")) {
    recordRemoval(cellChanges, x, y, "bomb");
  }
}

/** Where a pushed block may land (MS: water becomes wet dirt; dirt blocks blocks). */
function blockPushDestination(
  level: LevelData,
  x: number,
  y: number,
  chipsLeft: number,
  mechanics?: MsCc1MoveMechanics,
): "floor" | "water" | "bomb" | null {
  const tile = getCompositeTile(level, x, y);
  if (tile === "bomb") return "bomb";
  if (tile === "water") return "water";
  if (isDirtCell(level, x, y) || isWetDirtCell(level, x, y)) return null;
  if (tile === "empty" || tile === "gravel") return "floor";
  if (brownButtonTileAt(level, x, y)) return "floor";
  if (isFunctioningTeleportAt(level, x, y)) return "floor";
  if (isBlockTile(tile) || isMonsterTile(tile)) return null;
  if (isDoorTile(tile) || isExitTile(tile)) return null;
  if (isSocketTile(tile) && chipsLeft > 0) return null;
  if (tile === COLLECTIBLE_CHIP_TILE_ID || isKeyTile(tile)) return null;
  if (CHIP_TILE_IDS.has(tile)) return null;
  if (
    isBlockedCell(level, x, y, {
      chipsRemainingOnMap: chipsLeft,
      openTraps: mechanics?.openTraps,
      stuckOnTraps: mechanics?.stuckOnTraps,
    })
  ) {
    return null;
  }
  return null;
}

function tryPushBlock(
  level: LevelData,
  blockX: number,
  blockY: number,
  dx: number,
  dy: number,
  chipsLeft: number,
  cellChanges: MsCc1CellChange[],
  mechanics?: MsCc1MoveMechanics,
  monsters?: MsCc1MonsterState[],
  buttonCtx?: MsCc1ButtonPressContext,
): boolean {
  const beyondX = blockX + dx;
  const beyondY = blockY + dy;
  if (beyondX < 0 || beyondX >= level.width || beyondY < 0 || beyondY >= level.height) {
    return false;
  }

  const dest = blockPushDestination(level, beyondX, beyondY, chipsLeft, mechanics);
  if (!dest) {
    return false;
  }

  const destButton = brownButtonTileAt(level, beyondX, beyondY);

  recordRemoval(cellChanges, blockX, blockY, BLOCK_MOVABLE_TILE_ID);
  removeTileAt(level, blockX, blockY, BLOCK_MOVABLE_TILE_ID);

  if (dest === "bomb") {
    applyBombDetonation(level, beyondX, beyondY, cellChanges);
    return true;
  }

  if (dest === "water") {
    // MS wet dirt: dirt on upper; water stays on lower until Chip dries the cell.
    if (cellTile(level, "upper", beyondX, beyondY) === "water") {
      removeTileAt(level, beyondX, beyondY, "water");
    }
    setUpperTile(level, beyondX, beyondY, "dirt");
    cellChanges.push({ x: beyondX, y: beyondY, placedTileId: "dirt" });
  } else if (destButton) {
    setLowerTile(level, beyondX, beyondY, "button_brown");
    setUpperTile(level, beyondX, beyondY, BLOCK_MOVABLE_TILE_ID);
    cellChanges.push({ x: beyondX, y: beyondY, placedTileId: BLOCK_MOVABLE_TILE_ID });
    if (monsters && buttonCtx) {
      applyBrownButtonHeldByBlock(
        level,
        beyondX,
        beyondY,
        monsters,
        cellChanges,
        buttonCtx,
      );
    }
  } else {
    setUpperTile(level, beyondX, beyondY, BLOCK_MOVABLE_TILE_ID);
    cellChanges.push({ x: beyondX, y: beyondY, placedTileId: BLOCK_MOVABLE_TILE_ID });
  }

  return true;
}

/** After a push onto a pad, MS warps the block to the paired portal exit face. */
function tryTeleportPushedBlock(
  level: LevelData,
  padX: number,
  padY: number,
  entryDir: Direction,
  chipsLeft: number,
  cellChanges: MsCc1CellChange[],
): void {
  const resolution = resolveBlueTeleportForBlock(level, padX, padY, entryDir, chipsLeft);
  if (resolution.kind !== "warp") {
    return;
  }

  removeTileAt(level, padX, padY, BLOCK_MOVABLE_TILE_ID);
  setUpperTile(level, padX, padY, TELEPORT_TILE_ID);
  cellChanges.push({
    x: padX,
    y: padY,
    removedTileId: BLOCK_MOVABLE_TILE_ID,
    placedTileId: TELEPORT_TILE_ID,
  });

  const { x: exitX, y: exitY } = resolution;
  const dest = blockPushDestination(level, exitX, exitY, chipsLeft, undefined);
  if (dest === "water") {
    if (cellTile(level, "upper", exitX, exitY) === "water") {
      removeTileAt(level, exitX, exitY, "water");
    }
    setUpperTile(level, exitX, exitY, "dirt");
    cellChanges.push({ x: exitX, y: exitY, placedTileId: "dirt" });
  } else {
    setUpperTile(level, exitX, exitY, BLOCK_MOVABLE_TILE_ID);
    cellChanges.push({ x: exitX, y: exitY, placedTileId: BLOCK_MOVABLE_TILE_ID });
  }
}

/** MS thief (spy): steals all boots; keys stay. Thief tile remains on the map. */
function applyThiefSteal(
  level: LevelData,
  x: number,
  y: number,
  state: MsCc1PlayerState,
): void {
  if (getCompositeTile(level, x, y) !== THIEF_TILE_ID) {
    return;
  }
  state.tools = [];
}

function pickUpAt(
  level: LevelData,
  x: number,
  y: number,
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
): void {
  const tile = getCompositeTile(level, x, y);

  if (tile === COLLECTIBLE_CHIP_TILE_ID) {
    if (!removeCollectibleAt(level, x, y, COLLECTIBLE_CHIP_TILE_ID)) return;
    recordRemoval(cellChanges, x, y, COLLECTIBLE_CHIP_TILE_ID);
    if (state.chipsRemainingOnMap > 0) {
      state.chipsRemainingOnMap -= 1;
    }
    return;
  }

  if (isKeyTile(tile)) {
    if (!tryAddKey(state, tile)) return;
    if (!removeCollectibleAt(level, x, y, tile)) return;
    recordRemoval(cellChanges, x, y, tile);
    return;
  }

  if (TOOL_TILE_IDS.has(tile)) {
    if (!tryAddTool(state, tile)) return;
    if (!removeCollectibleAt(level, x, y, tile)) return;
    recordRemoval(cellChanges, x, y, tile);
  }
}

function noMove(
  position: { x: number; y: number },
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
  direction: Direction,
): MsCc1MoveResult {
  return {
    moved: false,
    position,
    state,
    cellChanges,
    completedLevel: false,
    direction,
    steps: [],
  };
}

function clonePlayerState(state: MsCc1PlayerState): MsCc1PlayerState {
  return {
    keys: [...state.keys],
    tools: [...state.tools],
    chipsRemainingOnMap: state.chipsRemainingOnMap,
  };
}

function completeSuccessfulMove(
  level: LevelData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
  direction: Direction,
  trapCtx?: MsCc1ButtonPressContext,
): MsCc1MoveResult {
  clearChipMarkerOnDepart(level, from.x, from.y, cellChanges);
  pickUpAt(level, to.x, to.y, state, cellChanges);
  applyThiefSteal(level, to.x, to.y, state);
  applyFakeBlueWall(level, to.x, to.y, cellChanges);
  applyPopupWallOnStep(level, to.x, to.y, cellChanges);
  dryDirtUnderChip(level, to.x, to.y, cellChanges);

  if (isWaterCell(level, to.x, to.y) && !hasFlippers(state)) {
    applyDrowningSplash(level, to.x, to.y, cellChanges);
    return {
      moved: true,
      position: to,
      state,
      cellChanges,
      completedLevel: false,
      direction,
      playerDied: true,
      deathMessage: MS_DEATH_NO_FLIPPERS,
      steps: [],
    };
  }

  if (isFireCell(level, to.x, to.y) && !hasFireBoots(state)) {
    applyFireBurnSplash(level, to.x, to.y, cellChanges);
    return {
      moved: true,
      position: to,
      state,
      cellChanges,
      completedLevel: false,
      direction,
      playerDied: true,
      deathMessage: MS_DEATH_NO_FIRE_BOOTS,
      steps: [],
    };
  }

  if (isBombCell(level, to.x, to.y)) {
    applyBombDetonation(level, to.x, to.y, cellChanges);
    return {
      moved: true,
      position: to,
      state,
      cellChanges,
      completedLevel: false,
      direction,
      playerDied: true,
      deathMessage: MS_DEATH_NO_BOMBS,
      steps: [],
    };
  }

  const standingTile = getCompositeTile(level, to.x, to.y);
  const completedLevel = isExitTile(standingTile) && state.chipsRemainingOnMap === 0;

  if (trapCtx) {
    stickCreatureOnTrap(level, to.x, to.y, trapCtx);
  }

  return {
    moved: true,
    position: to,
    state,
    cellChanges,
    completedLevel,
    direction,
    steps: [],
  };
}

function recordStep(
  from: { x: number; y: number },
  step: MsCc1MoveResult,
  steps: MsCc1MoveStep[],
): void {
  steps.push({
    from,
    to: { ...step.position },
    moved: step.moved,
    direction: step.direction,
    state: clonePlayerState(step.state),
    cellChanges: [...step.cellChanges],
    completedLevel: step.completedLevel,
    playerDied: step.playerDied,
    deathMessage: step.deathMessage,
  });
}

/**
 * One grid step along `dx`/`dy` (orthogonal or diagonal). No ice/force chain.
 * Mutates `level` layers and returns updated player state.
 */
export function tryMsCc1StepDelta(
  level: LevelData,
  position: { x: number; y: number },
  dx: number,
  dy: number,
  state: MsCc1PlayerState,
  trapCtx?: MsCc1ButtonPressContext,
  direction?: Direction,
  monsters?: MsCc1MonsterState[],
): MsCc1MoveResult {
  const mechanics = moveMechanics(trapCtx);
  const cellChanges: MsCc1CellChange[] = [];
  const nextState = clonePlayerState(state);
  const stepDirection =
    direction ?? directionFromMoveIntent({ dx: dx as -1 | 0 | 1, dy: dy as -1 | 0 | 1 });

  if (dx === 0 && dy === 0) {
    return noMove(position, nextState, cellChanges, stepDirection);
  }

  const nx = position.x + dx;
  const ny = position.y + dy;

  if (nx < 0 || nx >= level.width || ny < 0 || ny >= level.height) {
    return noMove(position, nextState, cellChanges, stepDirection);
  }

  const destTile = getCompositeTile(level, nx, ny);
  const fromThin = thinWallAt(level, position.x, position.y);
  const destThin = thinWallAt(level, nx, ny);
  const chipsLeft = nextState.chipsRemainingOnMap;

  if (thinWallBlocksMove(fromThin, destThin, dx, dy)) {
    return noMove(position, nextState, cellChanges, stepDirection);
  }

  if (isMonsterTile(destTile)) {
    clearChipMarkerOnDepart(level, position.x, position.y, cellChanges);
    return {
      moved: true,
      position: { x: nx, y: ny },
      state: nextState,
      cellChanges,
      completedLevel: false,
      direction: stepDirection,
      playerDied: true,
      deathMessage: MS_DEATH_CREATURES,
      steps: [],
    };
  }

  if (isBlockTile(destTile)) {
    const padX = nx + dx;
    const padY = ny + dy;
    const pushOntoTeleport = isFunctioningTeleportAt(level, padX, padY);
    if (
      !tryPushBlock(
        level,
        nx,
        ny,
        dx,
        dy,
        chipsLeft,
        cellChanges,
        mechanics,
        monsters,
        trapCtx,
      )
    ) {
      return noMove(position, nextState, cellChanges, stepDirection);
    }
    if (pushOntoTeleport) {
      tryTeleportPushedBlock(
        level,
        padX,
        padY,
        stepDirection,
        chipsLeft,
        cellChanges,
      );
    }
    return completeSuccessfulMove(
      level,
      position,
      { x: nx, y: ny },
      nextState,
      cellChanges,
      stepDirection,
    );
  }

  if (isDoorTile(destTile)) {
    const keyId = doorToKeyId(destTile);
    if (!keyId || !hasKey(nextState, keyId)) {
      return noMove(position, nextState, cellChanges, stepDirection);
    }
    if (isKeyConsumedWhenOpeningDoor(keyId)) {
      consumeKey(nextState, keyId);
    }
    removeTileAt(level, nx, ny, destTile);
    recordRemoval(cellChanges, nx, ny, destTile);
  } else if (isSocketTile(destTile)) {
    if (chipsLeft > 0) {
      return noMove(position, nextState, cellChanges, stepDirection);
    }
    removeTileAt(level, nx, ny, SOCKET_TILE_ID);
    recordRemoval(cellChanges, nx, ny, SOCKET_TILE_ID);
  } else if (isExitTile(destTile)) {
    if (chipsLeft > 0) {
      return noMove(position, nextState, cellChanges, stepDirection);
    }
  } else if (THIN_WALL_ORTHOGONAL_TILE_IDS.has(destThin) || THIN_WALL_ORTHOGONAL_TILE_IDS.has(destTile)) {
    // Directional thin wall: allowed edges already passed thinWallBlocksMove.
  } else if (
    isBlockedCell(level, nx, ny, {
      chipsRemainingOnMap: chipsLeft,
      openTraps: mechanics?.openTraps,
      stuckOnTraps: mechanics?.stuckOnTraps,
      allowAppearingWall: true,
    })
  ) {
    return noMove(position, nextState, cellChanges, stepDirection);
  }

  if (CHIP_TILE_IDS.has(destTile)) {
    return noMove(position, nextState, cellChanges, stepDirection);
  }

  return completeSuccessfulMove(
    level,
    position,
    { x: nx, y: ny },
    nextState,
    cellChanges,
    stepDirection,
    trapCtx,
  );
}

/**
 * One voluntary grid step (no ice/force chain).
 * Mutates `level` layers and returns updated player state.
 */
export function tryMsCc1SingleStep(
  level: LevelData,
  position: { x: number; y: number },
  direction: Direction,
  state: MsCc1PlayerState,
  trapCtx?: MsCc1ButtonPressContext,
  monsters?: MsCc1MonsterState[],
): MsCc1MoveResult {
  const { dx, dy } = moveIntentFromDirection(direction);
  return tryMsCc1StepDelta(
    level,
    position,
    dx,
    dy,
    state,
    trapCtx,
    direction,
    monsters,
  );
}

const MAX_SLIDE_STEPS = 64;

function isOnTeleportPad(level: LevelData, x: number, y: number): boolean {
  return (
    isFunctioningTeleportAt(level, x, y) || isNonFunctioningTeleportAt(level, x, y)
  );
}

/** MS blue teleport after stepping onto a pad (warp, ice-through, or bounce). */
function tryTeleportAfterLanding(
  level: LevelData,
  from: { x: number; y: number },
  position: { x: number; y: number },
  entryDirection: Direction,
  state: MsCc1PlayerState,
  cellChanges: MsCc1CellChange[],
  trapCtx?: MsCc1ButtonPressContext,
): MsCc1MoveResult | null {
  const mechanics = moveMechanics(trapCtx);
  if (!isOnTeleportPad(level, position.x, position.y)) {
    return null;
  }

  const resolution = resolveBlueTeleport(
    level,
    position.x,
    position.y,
    entryDirection,
    state,
    mechanics?.openTraps,
    mechanics?.stuckOnTraps,
  );

  if (resolution.kind === "bounce") {
    return completeSuccessfulMove(
      level,
      position,
      from,
      state,
      cellChanges,
      entryDirection,
      trapCtx,
    );
  }

  let destX = resolution.x;
  let destY = resolution.y;
  if (resolution.kind === "warp") {
    const { dx, dy } = directionDelta(entryDirection);
    const exitTile = getCompositeTile(level, destX, destY);
    if (isBlockTile(exitTile)) {
      if (
        !tryPushBlock(
          level,
          destX,
          destY,
          dx,
          dy,
          state.chipsRemainingOnMap,
          cellChanges,
          mechanics,
          undefined,
          trapCtx,
        )
      ) {
        return completeSuccessfulMove(
          level,
          position,
          from,
          state,
          cellChanges,
          entryDirection,
          trapCtx,
        );
      }
    }
  }

  return completeSuccessfulMove(
    level,
    position,
    { x: destX, y: destY },
    state,
    cellChanges,
    entryDirection,
    trapCtx,
  );
}

/**
 * MS Chip's Challenge grid step: chips, keys, doors, socket, blocks, exit,
 * then involuntary ice / force-floor slides.
 */
export function tryMsCc1Move(
  level: LevelData,
  position: { x: number; y: number },
  direction: Direction,
  state: MsCc1PlayerState,
  trapCtx?: MsCc1ButtonPressContext,
  monsters?: MsCc1MonsterState[],
): MsCc1MoveResult {
  const steps: MsCc1MoveStep[] = [];
  let pos = { ...position };
  let playerState = clonePlayerState(state);
  const inputIntent = moveIntentFromDirection(direction);

  if (trapCtx && isCreatureStuckOnTrap(trapCtx, position.x, position.y)) {
    return {
      ...noMove(position, playerState, [], direction),
      steps,
    };
  }

  const firstOnForce = stepIntentOnForceFloor(
    level,
    pos.x,
    pos.y,
    direction,
    playerState,
  );
  let first = firstOnForce.onForceFloor
    ? tryMsCc1StepDelta(
        level,
        pos,
        firstOnForce.intent.dx,
        firstOnForce.intent.dy,
        playerState,
        trapCtx,
        firstOnForce.direction,
        monsters,
      )
    : tryMsCc1SingleStep(level, pos, direction, playerState, trapCtx, monsters);
  // Adjacent/upstream force boost is optional: if the diagonal is blocked,
  // MS still walks in the held direction. Standing-on-pad combines stay as-is.
  if (
    !first.moved &&
    firstOnForce.onForceFloor &&
    getForceFloorIntentAt(level, pos.x, pos.y, playerState) === null
  ) {
    first = tryMsCc1SingleStep(level, pos, direction, playerState, trapCtx, monsters);
  }
  recordStep(pos, first, steps);
  if (!first.moved) {
    return { ...first, steps };
  }

  let result: MsCc1MoveResult = { ...first, steps };
  pos = { ...first.position };
  playerState = first.state;
  let prevPos = { ...position };

  const firstTeleport = tryTeleportAfterLanding(
    level,
    position,
    pos,
    result.direction,
    playerState,
    result.cellChanges,
    trapCtx,
  );
  if (firstTeleport) {
    recordStep(pos, firstTeleport, steps);
    result = {
      ...firstTeleport,
      steps,
      moved: true,
      cellChanges: [...first.cellChanges, ...firstTeleport.cellChanges],
    };
    prevPos = pos;
    pos = { ...firstTeleport.position };
    playerState = firstTeleport.state;
    if (firstTeleport.playerDied || firstTeleport.completedLevel) {
      return result;
    }
  }

  for (let i = 0; i < MAX_SLIDE_STEPS; i++) {
    const teleportStep = tryTeleportAfterLanding(
      level,
      prevPos,
      pos,
      result.direction,
      playerState,
      [],
      trapCtx,
    );
    if (teleportStep) {
      recordStep(pos, teleportStep, steps);
      result = {
        moved: true,
        position: teleportStep.position,
        state: teleportStep.state,
        cellChanges: [...result.cellChanges, ...teleportStep.cellChanges],
        completedLevel: teleportStep.completedLevel,
        direction: teleportStep.direction,
        steps,
        playerDied: result.playerDied || teleportStep.playerDied,
        deathMessage: teleportStep.deathMessage ?? result.deathMessage,
      };
      if (teleportStep.playerDied || teleportStep.completedLevel) {
        return result;
      }
      prevPos = pos;
      pos = { ...teleportStep.position };
      playerState = teleportStep.state;
      continue;
    }

    const composite = getCompositeTile(level, pos.x, pos.y);
    const floor = getFloorTileId(level, pos.x, pos.y);
    const forceTile = getForceFloorTileAt(level, pos.x, pos.y);
    const slideSurface =
      forceTile ?? (CHIP_TILE_IDS.has(composite) ? floor : composite);
    const slideDir = slideDirectionAfterLanding(
      slideSurface,
      playerState,
      result.direction,
    );
    if (!slideDir) {
      break;
    }

    const slideStep = forceTile
      ? (() => {
          const forceIntent = moveIntentFromDirection(slideDir);
          const slideIntent = combineForceWithInput(forceIntent, inputIntent);
          const slideDirection = directionFromMoveIntent(slideIntent);
          return tryMsCc1StepDelta(
            level,
            pos,
            slideIntent.dx,
            slideIntent.dy,
            playerState,
            trapCtx,
            slideDirection,
            monsters,
          );
        })()
      : tryMsCc1SingleStep(level, pos, slideDir, playerState, trapCtx, monsters);
    recordStep(pos, slideStep, steps);
    result = {
      moved: result.moved || slideStep.moved,
      position: slideStep.moved ? slideStep.position : result.position,
      state: slideStep.state,
      cellChanges: [...result.cellChanges, ...slideStep.cellChanges],
      completedLevel: slideStep.completedLevel,
      direction: slideStep.direction,
      steps,
      playerDied: result.playerDied || slideStep.playerDied,
      deathMessage: slideStep.deathMessage ?? result.deathMessage,
    };

    if (slideStep.playerDied || slideStep.completedLevel) {
      return result;
    }
    if (!slideStep.moved) {
      break;
    }
    prevPos = pos;
    pos = { ...slideStep.position };
    playerState = slideStep.state;
  }

  return result;
}

/** Build player state from run session counters. */
export function msCc1StateFromRun(
  keys: string[],
  chipsRemainingOnMap: number,
  tools: string[] = [],
): MsCc1PlayerState {
  return { keys: [...keys], tools: [...tools], chipsRemainingOnMap };
}
