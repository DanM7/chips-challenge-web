import type { Direction, LevelData } from "@engine/types";
import { cellTile } from "@engine/levelRuntime";
import type { DirectionInput } from "@engine/DirectionInput";
import { isForceFloorTile } from "@engine/msCc1/msCc1Sliding";

/** Works with published engine before `getForceFloorTileAt` was added. */
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

/** Works with published engine before `hasActiveDirection` was added. */
export function getHeldDirection(input: DirectionInput | undefined): Direction | null {
  if (!input) {
    return null;
  }
  const extended = input as DirectionInput & {
    getActiveDirection?: () => Direction | null;
    hasActiveDirection?: () => boolean;
    activeDirection?: Direction | null;
  };
  if (typeof extended.getActiveDirection === "function") {
    return extended.getActiveDirection();
  }
  if (typeof extended.hasActiveDirection === "function" && !extended.hasActiveDirection()) {
    return null;
  }
  const legacy = extended.activeDirection;
  return legacy ?? null;
}

export function directionInputIsActive(input: DirectionInput | undefined): boolean {
  if (!input) {
    return false;
  }
  const extended = input as DirectionInput & {
    hasActiveDirection?: () => boolean;
  };
  if (typeof extended.hasActiveDirection === "function") {
    return extended.hasActiveDirection();
  }
  const legacy = input as unknown as { activeDirection?: Direction | null };
  return legacy.activeDirection != null;
}
