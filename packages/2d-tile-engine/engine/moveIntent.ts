import type { Direction } from "./types.js";

export interface MoveIntent {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

export const ZERO_MOVE_INTENT: MoveIntent = { dx: 0, dy: 0 };

export function moveIntentFromDirection(direction: Direction): MoveIntent {
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

export function normalizeMoveInput(input: Direction | MoveIntent): MoveIntent {
  if (typeof input === "string") {
    return moveIntentFromDirection(input);
  }
  return input;
}

function clampAxis(sum: number): -1 | 0 | 1 {
  if (sum === 0) return 0;
  return sum > 0 ? 1 : -1;
}

/** Merge force-floor push with held input (e.g. force down + hold right → down-right). */
export function combineMoveIntents(a: MoveIntent, b: MoveIntent): MoveIntent {
  return {
    dx: clampAxis(a.dx + b.dx),
    dy: clampAxis(a.dy + b.dy),
  };
}

/** Chip facing / animation when a step uses combined axes (vertical preferred). */
export function directionFromMoveIntent(intent: MoveIntent): Direction {
  if (intent.dy < 0) return "up";
  if (intent.dy > 0) return "down";
  if (intent.dx < 0) return "left";
  return "right";
}

export function isZeroMoveIntent(intent: MoveIntent): boolean {
  return intent.dx === 0 && intent.dy === 0;
}

/** True when intents move on different axes (e.g. force south + input east). */
export function isPerpendicularMoveIntent(a: MoveIntent, b: MoveIntent): boolean {
  return (
    (a.dx !== 0 && b.dy !== 0) || (a.dy !== 0 && b.dx !== 0)
  );
}
