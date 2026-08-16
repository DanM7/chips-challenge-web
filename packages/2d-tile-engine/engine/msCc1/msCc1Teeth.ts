import type { MsCc1ButtonPressContext } from "./msCc1Buttons.js";
import type { MonsterFacing } from "./monsterDirection.js";
import type { MsCc1MonsterState } from "./msCc1Monsters.js";

/** MS CC1 teeth use `frog_*` creature tiles in the DAT. */
export const TEETH_MONSTER_KIND = "frog";

export type MsStepParity = "even" | "odd";

/**
 * MS odd/even step for teeth (default MSCC = even).
 * Odd: teeth act on the 2nd move boundary (1, 3, 5…).
 * Even: teeth act on the 3rd move boundary (2, 4, 6…).
 */
export function teethMovesThisBoundary(
  moveBoundary: number,
  parity: MsStepParity = "even",
): boolean {
  if (parity === "odd") {
    return moveBoundary % 2 === 1;
  }
  return moveBoundary >= 2 && moveBoundary % 2 === 0;
}

/** Advance the shared move-boundary counter once per monster-list tick. */
export function advanceMoveBoundary(
  mechanics?: Pick<MsCc1ButtonPressContext, "moveBoundary" | "stepParity">,
): number {
  const next = (mechanics?.moveBoundary ?? 0) + 1;
  if (mechanics) {
    mechanics.moveBoundary = next;
  }
  return next;
}

type CanEnter = (x: number, y: number, facing: MonsterFacing) => boolean;

/**
 * MS teeth: step on the axis farther from Chip; vertical wins ties.
 * If the preferred direction is blocked, try the other axis; else stay put.
 */
export function chooseTeethStepFacing(
  monster: MsCc1MonsterState,
  chipPosition: { x: number; y: number },
  canEnter: CanEnter,
): MonsterFacing | null {
  const dx = chipPosition.x - monster.x;
  const dy = chipPosition.y - monster.y;
  if (dx === 0 && dy === 0) {
    return null;
  }

  const vertical: MonsterFacing | null =
    dy < 0 ? "north" : dy > 0 ? "south" : null;
  const horizontal: MonsterFacing | null =
    dx < 0 ? "west" : dx > 0 ? "east" : null;

  const preferVertical = Math.abs(dy) >= Math.abs(dx);
  const primary = preferVertical ? vertical : horizontal;
  const secondary = preferVertical ? horizontal : vertical;

  if (primary && canStep(monster, primary, canEnter)) {
    return primary;
  }
  if (secondary && canStep(monster, secondary, canEnter)) {
    return secondary;
  }
  return null;
}

function canStep(
  monster: MsCc1MonsterState,
  facing: MonsterFacing,
  canEnter: CanEnter,
): boolean {
  const delta =
    facing === "north"
      ? { dx: 0, dy: -1 }
      : facing === "south"
        ? { dx: 0, dy: 1 }
        : facing === "east"
          ? { dx: 1, dy: 0 }
          : { dx: -1, dy: 0 };
  return canEnter(monster.x + delta.dx, monster.y + delta.dy, facing);
}
