import type { Direction } from "@engine/types";
import type { DirectionInput } from "@engine/DirectionInput";

export { getForceFloorTileAt } from "@engine/msCc1/msCc1Sliding";

export function getHeldDirection(input: DirectionInput | undefined): Direction | null {
  return input?.getActiveDirection() ?? null;
}

export function directionInputIsActive(input: DirectionInput | undefined): boolean {
  return input?.hasActiveDirection() ?? false;
}
