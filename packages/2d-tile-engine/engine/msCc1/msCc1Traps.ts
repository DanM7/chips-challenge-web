import { cellTile } from "../levelRuntime.js";
import type { LevelData } from "../types.js";
import type { MsCc1CellChange } from "./types.js";
import type { MsCc1MonsterState } from "./msCc1Monsters.js";
import type { MsCc1ButtonPressContext } from "./msCc1Buttons.js";

export const TRAP_TILE_ID = "trap";

export function trapCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isTrapCell(level: LevelData, x: number, y: number): boolean {
  return (
    cellTile(level, "upper", x, y) === TRAP_TILE_ID ||
    cellTile(level, "lower", x, y) === TRAP_TILE_ID
  );
}

export function isTrapOpen(
  ctx: Pick<MsCc1ButtonPressContext, "openTraps">,
  x: number,
  y: number,
): boolean {
  return ctx.openTraps.has(trapCellKey(x, y));
}

/**
 * Closed trap occupied by a stuck creature — impassable to others.
 * Empty closed traps may be entered (creature becomes stuck).
 */
export type TrapMechanicsCtx = Pick<MsCc1ButtonPressContext, "openTraps"> & {
  stuckOnTraps?: Set<string>;
};

export function isTrapBlockingEntry(
  level: LevelData,
  x: number,
  y: number,
  ctx: TrapMechanicsCtx,
): boolean {
  if (!isTrapCell(level, x, y) || isTrapOpen(ctx, x, y)) {
    return false;
  }
  return (ctx.stuckOnTraps ?? new Set()).has(trapCellKey(x, y));
}

/** @deprecated Use {@link isTrapBlockingEntry}. */
export function isClosedTrapAt(
  level: LevelData,
  x: number,
  y: number,
  ctx: TrapMechanicsCtx,
): boolean {
  return isTrapBlockingEntry(level, x, y, ctx);
}

export function isCreatureStuckOnTrap(
  ctx: { stuckOnTraps?: Set<string> },
  x: number,
  y: number,
): boolean {
  return (ctx.stuckOnTraps ?? new Set()).has(trapCellKey(x, y));
}

/** MS: stepping a closed bear trap holds the creature until the trap opens. */
export function stickCreatureOnTrap(
  level: LevelData,
  x: number,
  y: number,
  ctx: TrapMechanicsCtx & { stuckOnTraps: Set<string> },
): boolean {
  if (!isTrapCell(level, x, y) || isTrapOpen(ctx, x, y)) {
    return false;
  }
  ctx.stuckOnTraps.add(trapCellKey(x, y));
  return true;
}

function brownButtonKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * MS: a block on a brown button holds it and opens the linked trap(s).
 * Releases creatures stuck on the linked trap.
 */
export function applyBrownButtonHeldByBlock(
  level: LevelData,
  buttonX: number,
  buttonY: number,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): void {
  if (!brownButtonTileAt(level, buttonX, buttonY)) {
    return;
  }
  ctx.heldBrownButtons.add(brownButtonKey(buttonX, buttonY));
  openTrapForBrownButton(level, buttonX, buttonY, monsters, cellChanges, ctx);
}

function findTrapLinkByButton(level: LevelData, buttonX: number, buttonY: number) {
  return level.trapLinks?.find(
    (link) => link.button.x === buttonX && link.button.y === buttonY,
  );
}

function findTrapLinkByTrap(level: LevelData, trapX: number, trapY: number) {
  return level.trapLinks?.find(
    (link) => link.trap.x === trapX && link.trap.y === trapY,
  );
}

function recordTrapOpened(cellChanges: MsCc1CellChange[], x: number, y: number): void {
  cellChanges.push({ x, y, placedTileId: TRAP_TILE_ID });
}

/**
 * MS: brown button opens its linked trap (tile stays; marked open in ctx).
 * Releases any creature stuck on that trap so it can move on the next tick.
 */
export function openTrapForBrownButton(
  level: LevelData,
  buttonX: number,
  buttonY: number,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): boolean {
  const link = findTrapLinkByButton(level, buttonX, buttonY);
  if (!link) {
    return false;
  }
  return openLinkedTrap(level, link, monsters, cellChanges, ctx);
}

/** Open a trap by its cell (same effect as pressing its linked brown button). */
export function openTrapFromTrapStep(
  level: LevelData,
  trapX: number,
  trapY: number,
  monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): boolean {
  const link = findTrapLinkByTrap(level, trapX, trapY);
  if (!link) {
    return false;
  }
  return openLinkedTrap(level, link, monsters, cellChanges, ctx);
}

function openLinkedTrap(
  level: LevelData,
  link: NonNullable<LevelData["trapLinks"]>[number],
  _monsters: MsCc1MonsterState[],
  cellChanges: MsCc1CellChange[],
  ctx: MsCc1ButtonPressContext,
): boolean {
  const { x, y } = link.trap;
  if (!isTrapCell(level, x, y)) {
    return false;
  }

  const key = trapCellKey(x, y);
  if (ctx.openTraps.has(key)) {
    return false;
  }

  ctx.openTraps.add(key);
  ctx.stuckOnTraps.delete(key);
  recordTrapOpened(cellChanges, x, y);

  return true;
}

/** Brown button under a creature (lower) or on the surface (upper). */
export function brownButtonTileAt(level: LevelData, x: number, y: number): string | null {
  const lower = cellTile(level, "lower", x, y);
  if (lower === "button_brown") {
    return lower;
  }
  const upper = cellTile(level, "upper", x, y);
  if (upper === "button_brown") {
    return upper;
  }
  return null;
}
