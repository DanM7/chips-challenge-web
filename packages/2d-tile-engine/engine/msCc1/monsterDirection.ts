/** MS monster facing (matches DAT field 10 / creature tile suffix). */
export type MonsterFacing = "north" | "east" | "south" | "west";

const DELTA: Record<MonsterFacing, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
};

export function monsterFacingDelta(facing: MonsterFacing): { dx: number; dy: number } {
  return DELTA[facing];
}

export function turnMonsterLeft(facing: MonsterFacing): MonsterFacing {
  switch (facing) {
    case "north":
      return "west";
    case "west":
      return "south";
    case "south":
      return "east";
    case "east":
      return "north";
  }
}

export function turnMonsterRight(facing: MonsterFacing): MonsterFacing {
  switch (facing) {
    case "north":
      return "east";
    case "east":
      return "south";
    case "south":
      return "west";
    case "west":
      return "north";
  }
}

export function monsterTileId(kind: string, facing: MonsterFacing): string {
  const suffix =
    facing === "north" ? "n" : facing === "east" ? "e" : facing === "south" ? "s" : "w";
  return `${kind}_${suffix}`;
}

export function monsterKindFromTileId(tileId: string): string | null {
  if (tileId.startsWith("bug_")) return "bug";
  if (tileId.startsWith("tank_")) return "tank";
  if (tileId.startsWith("ghost_")) return "ghost";
  if (tileId.startsWith("ball_pink_")) return "ball_pink";
  if (tileId.startsWith("walker_")) return "walker";
  if (tileId.startsWith("fireball_")) return "fireball";
  /** MS teeth (angry teeth) use frog facing tiles in CC1 DAT. */
  if (tileId.startsWith("frog_")) return "frog";
  return null;
}

export function reverseMonsterFacing(facing: MonsterFacing): MonsterFacing {
  switch (facing) {
    case "north":
      return "south";
    case "south":
      return "north";
    case "east":
      return "west";
    case "west":
      return "east";
  }
}

export function facingFromMonsterTileId(tileId: string): MonsterFacing | null {
  if (tileId.endsWith("_n")) return "north";
  if (tileId.endsWith("_e")) return "east";
  if (tileId.endsWith("_s")) return "south";
  if (tileId.endsWith("_w")) return "west";
  return null;
}
